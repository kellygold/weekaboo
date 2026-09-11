import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
export class DesktopFailure extends Error { constructor(code) { super('Native operation could not complete.'); this.code = code; } }
export const validate = condition => { if (!condition) throw new DesktopFailure('validation'); };
const keys = new Set(['task-snapshot', 'calendar-state', 'event-cache', 'event-operations']);
const bounded = (value, max) => typeof value === 'string' && Buffer.byteLength(value) <= max;
export class DesktopStorage {
  constructor(directory, encryption, { maxCredentialBytes = 65536 } = {}) {
    mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
    const file = join(directory, 'local.db'); this.db = new DatabaseSync(file); chmodSync(file, 0o600);
    validate(Number.isSafeInteger(maxCredentialBytes) && maxCredentialBytes >= 65536 && maxCredentialBytes <= 2_000_000);
    this.encryption = encryption; this.maxCredentialBytes = maxCredentialBytes;
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version === 0) {
      try { this.db.exec('BEGIN IMMEDIATE; CREATE TABLE documents (key TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL); CREATE TABLE credentials (reference TEXT PRIMARY KEY, ciphertext BLOB NOT NULL); PRAGMA user_version=1; COMMIT'); }
      catch { try { this.db.exec('ROLLBACK'); } finally { this.db.close(); } throw new DesktopFailure('unavailable'); }
    }
    else if (version !== 1) { this.db.close(); throw new DesktopFailure('unavailable'); }
  }
  readDocument({ key }) {
    validate(keys.has(key));
    const row = this.db.prepare('SELECT revision,value FROM documents WHERE key=?').get(key);
    if (row && (!Number.isSafeInteger(row.revision) || row.revision < 1)) throw new DesktopFailure('unavailable');
    return row || { revision: 0, value: null };
  }
  writeDocument({ key, revision, value }) {
    validate(keys.has(key) && Number.isSafeInteger(revision) && revision >= 0 && revision < Number.MAX_SAFE_INTEGER && bounded(value, 8_000_000));
    // Check valid JSON before entering the transaction; each shared store owns its schema.
    try { JSON.parse(value); } catch { throw new DesktopFailure('validation'); }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.readDocument({ key }).revision !== revision) { this.db.exec('ROLLBACK'); return { committed: false }; }
      this.db.prepare('INSERT INTO documents(key,revision,value) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,value=excluded.value').run(key, revision + 1, value);
      this.db.exec('COMMIT'); return { committed: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  readTasks() { const row = this.readDocument({ key: 'task-snapshot' }); return { revision: row.revision, tasks: row.value === null ? [] : JSON.parse(row.value) }; }
  writeTasks({ revision, tasks }) {
    validate(Array.isArray(tasks) && tasks.length <= 10000 && tasks.every(task => task && typeof task.id === 'string') && new Set(tasks.map(task => task.id)).size === tasks.length);
    return this.writeDocument({ key: 'task-snapshot', revision, value: JSON.stringify(tasks) });
  }
  reference(value) { validate(typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/.test(value)); }
  vaultGet({ reference }) {
    this.reference(reference);
    const row = this.db.prepare('SELECT ciphertext FROM credentials WHERE reference=?').get(reference);
    if (!row) return { value: null };
    if (!this.encryption.isEncryptionAvailable()) throw new DesktopFailure('unavailable');
    const stored = JSON.parse(this.encryption.decryptString(Buffer.from(row.ciphertext)));
    if (stored.reference !== reference || !bounded(stored.value, this.maxCredentialBytes)) throw new DesktopFailure('unavailable');
    return { value: stored.value };
  }
  vaultPut({ reference, value }) {
    this.reference(reference); validate(bounded(value, this.maxCredentialBytes));
    if (!this.encryption.isEncryptionAvailable()) throw new DesktopFailure('unavailable');
    const ciphertext = this.encryption.encryptString(JSON.stringify({ reference, value }));
    this.db.prepare('INSERT INTO credentials(reference,ciphertext) VALUES(?,?) ON CONFLICT(reference) DO UPDATE SET ciphertext=excluded.ciphertext').run(reference, ciphertext);
    return {};
  }
  vaultRemove({ reference }) { this.reference(reference); this.db.prepare('DELETE FROM credentials WHERE reference=?').run(reference); return {}; }
  close() { this.db.close(); }
}
