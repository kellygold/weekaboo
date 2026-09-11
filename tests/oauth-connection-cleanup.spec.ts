import { test, expect } from '@playwright/test';
import { oauthConnection } from '../src/engine/connections';
import { standaloneServices } from '../src/engine/services';
import type { DocumentStore, ProviderAccount, ProviderReader } from '../src/engine/state';

function fixture() {
  let ref = 'native-account', fail = '', subject = 'subject'; const removed: string[] = [];
  const rows = new Map<string, { revision: number; value: string }>();
  const documents: DocumentStore = {
    async read(key) { return rows.get(key) || { revision: 0, value: null }; },
    async compareAndSet(key, revision, value) { if (fail === 'commit') return false; rows.set(key, { revision: revision + 1, value }); return true; },
  };
  const auth = { async acquire() { return { accessToken: 'synthetic', accountRef: ref, scopes: [] }; }, async forget(_provider: string, value: string) { removed.push(value); } };
  const reader: ProviderReader = {
    async identity() { if (fail === 'identity') throw new Error('identity offline'); return { subject, email: 'display@example.test' }; },
    async calendars() { if (fail === 'discovery') throw new Error('discovery offline'); return []; }, async events() { return []; },
  };
  const connection = oauthConnection('google', auth, reader);
  const services = standaloneServices({ documents, providers: { google: connection }, availability: async () => ({ google: true, microsoft: false, icloud: false }) });
  return { services, connection, removed, fail: (stage: string) => { fail = stage; }, ref: (value: string) => { ref = value; }, subject: (value: string) => { subject = value; } };
}
test('new OAuth cache is removed if identity, discovery or metadata persistence fails', async () => {
  for (const stage of ['identity', 'discovery', 'commit']) {
    const f = fixture(); f.fail(stage);
    await expect(f.services.accounts.connect({ provider: 'google' })).rejects.toThrow();
    expect(f.removed).toEqual(['native-account']); expect(await f.services.accounts.list()).toEqual([]);
  }
});
test('failed reconnect never removes the existing account cache', async () => {
  for (const stage of ['identity', 'discovery', 'commit']) {
    const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.fail(stage);
    await expect(f.services.accounts.connect({ provider: 'google' })).rejects.toThrow();
    expect(f.removed).toEqual([]); expect(await f.services.accounts.list()).toHaveLength(1);
  }
});
test('a new account failing beside an existing one cleans only its own SDK reference', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.ref('new-native-account'); f.subject('other-subject'); f.fail('commit');
  await expect(f.services.accounts.connect({ provider: 'google' })).rejects.toThrow();
  expect(f.removed).toEqual(['new-native-account']); expect(await f.services.accounts.list()).toHaveLength(1);
});
test('SDK references stay opaque and subject matching protects an existing account with a changed reference', async () => {
  const f = fixture();
  const existing = [{ provider: 'google', subject: 'subject', authorizationRef: 'old-ref' }] as ProviderAccount[];
  const prepared = await f.connection.prepare({ provider: 'google' }, existing);
  expect(prepared.account.authorizationRef).toBe('native-account');
  await prepared.rollback!(); expect(f.removed).toEqual([]);
});
