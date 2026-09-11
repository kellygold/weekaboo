import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DesktopStorage } from '../desktop/storage.mjs';
import { request } from '../desktop/transport.mjs';
const encryption = { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString() }; // Fake crypto; real OS proof is separate.
test('desktop database rejects stale writes across connections, survives reopen and preserves unknown schemas', () => {
  const root = mkdtempSync(join(tmpdir(), 'weekaboo-db-test-'));
  try {
    const first = new DesktopStorage(root, encryption), second = new DesktopStorage(root, encryption);
    expect(first.writeTasks({ revision: 0, tasks: [{ id: 'a', title: 'Keep me' }] })).toEqual({ committed: true });
    expect(second.writeTasks({ revision: 0, tasks: [] })).toEqual({ committed: false });
    expect(() => second.writeTasks({ revision: 0.2, tasks: [] })).toThrow();
    first.close(); second.close();
    const reopened = new DesktopStorage(root, encryption); expect(reopened.readTasks().tasks[0].title).toBe('Keep me'); reopened.close();
    const db = new DatabaseSync(join(root, 'local.db')); db.exec('PRAGMA user_version=99'); db.close();
    expect(() => new DesktopStorage(root, encryption)).toThrow();
    const retained = new DatabaseSync(join(root, 'local.db')); expect(retained.prepare('SELECT value FROM documents').get()?.value).toContain('Keep me'); retained.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('desktop vault detects ciphertext moved to another reference and fails closed without OS encryption', () => {
  const root = mkdtempSync(join(tmpdir(), 'weekaboo-vault-test-'));
  try {
    const store = new DesktopStorage(root, encryption); store.vaultPut({ reference: 'one', value: 'synthetic' });
    store.db.exec("UPDATE credentials SET reference='two' WHERE reference='one'");
    expect(() => store.vaultGet({ reference: 'two' })).toThrow(); store.close();
    const unavailable = new DesktopStorage(root, { ...encryption, isEncryptionAvailable: () => false });
    expect(() => unavailable.vaultPut({ reference: 'new', value: 'synthetic' })).toThrow();
    expect(unavailable.vaultGet({ reference: 'new' })).toEqual({ value: null }); unavailable.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('desktop transport rejects unsafe provider destinations and headers before networking', async () => {
  for (const url of ['http://caldav.icloud.com/', 'https://caldav.icloud.com.attacker.test/', 'https://user:pass@caldav.icloud.com/', 'https://localhost/', 'https://p1-caldav.icloud.com:8443/']) await expect(request({ url, method: 'GET' })).rejects.toMatchObject({ code: 'validation' });
  for (const headers of [{ Host: 'attacker.test' }, { Authorization: 'value\r\nInjected: yes' }, { 'Content-Length': '0' }]) await expect(request({ url: 'https://caldav.icloud.com/', method: 'GET', headers })).rejects.toMatchObject({ code: 'validation' });
});
