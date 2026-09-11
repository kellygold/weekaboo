import { test, expect } from '@playwright/test';
import { AndroidAuthorization } from '../src/platform/android-authorization';
import { googleReader } from '../src/engine/providers/google';
import { oauthConnection } from '../src/engine/connections';
import { standaloneServices } from '../src/engine/services';
import type { AuthorizationRequest } from '../src/platform/authorization';
import type { HttpTransport } from '../src/platform/ports';

function fixture() {
  const requests: AuthorizationRequest[] = [], forgotten: string[] = [];
  let subject = 'google-subject', verified = true, discoveryFails = false, rejectOnce = false;
  const transport: HttpTransport = { async request(input) {
    if (input.url.endsWith('/userinfo')) {
      if (rejectOnce) { rejectOnce = false; return { status: 401, headers: {}, body: '{}' }; }
      return { status: 200, headers: {}, body: JSON.stringify({ sub: subject, email: 'selected@example.test', email_verified: verified }) };
    }
    return { status: discoveryFails ? 503 : 200, headers: {}, body: JSON.stringify({ items: [{ id: 'primary', summary: 'Personal', accessRole: 'owner' }] }) };
  } };
  const reader = googleReader(transport);
  const auth = new AndroidAuthorization(reader.identity, {
    async setup() { return {} as any; },
    async acquire(request) {
      requests.push(request);
      // Match the native Android result: no accountRef, including after consent.
      return { accessToken: 'synthetic-token', scopes: ['https://www.googleapis.com/auth/calendar'] };
    },
    async forget(input) { forgotten.push(input.accountRef); },
  });
  const connection = oauthConnection('google', auth, reader);
  const rows = new Map<string, { revision: number; value: string }>();
  const services = standaloneServices({ documents: {
    async read(key) { return rows.get(key) || { revision: 0, value: null }; },
    async compareAndSet(key, revision, value) { if ((rows.get(key)?.revision || 0) !== revision) return false; rows.set(key, { revision: revision + 1, value }); return true; },
  }, providers: { google: connection }, availability: async () => ({ google: true, microsoft: false, icloud: false }) });
  return { auth, connection, services, requests, forgotten, rows,
    unverify() { verified = false; }, changeSubject() { subject = 'different-subject'; }, failDiscovery() { discoveryFails = true; }, rejectToken() { rejectOnce = true; } };
}

test('Android token-only consent connects with verified email SDK reference and persists no token', async () => {
  const f = fixture();
  await f.services.accounts.connect({ provider: 'google' });
  expect(await f.services.accounts.list()).toHaveLength(1);
  const prepared = await f.connection.prepare({ provider: 'google' });
  expect(prepared.account.authorizationRef).toBe('selected@example.test');
  expect(prepared.account.subject).toBe('google-subject');
  expect(prepared.calendars).toHaveLength(1);
  await f.connection.access(prepared.account);
  expect(f.requests.at(-1)).toMatchObject({ accountRef: 'selected@example.test', interactive: false });
  expect(JSON.stringify([...f.rows])).not.toContain('synthetic-token');
});

test('Android unverified identity and discovery failure cannot persist an account', async () => {
  const f = fixture(); f.unverify();
  await expect(f.services.accounts.connect({ provider: 'google' })).rejects.toThrow();
  expect(await f.services.accounts.list()).toEqual([]); expect(f.forgotten).toEqual([]);
  const g = fixture(); g.failDiscovery();
  await expect(g.services.accounts.connect({ provider: 'google' })).rejects.toThrow();
  expect(await g.services.accounts.list()).toEqual([]); expect(g.forgotten).toEqual(['selected@example.test']);
});

test('Android still renews rejected tokens once and rejects a different provider subject', async () => {
  const f = fixture(), prepared = await f.connection.prepare({ provider: 'google' });
  f.rejectToken(); await f.connection.access(prepared.account);
  expect(f.requests.at(-1)).toMatchObject({ accountRef: 'selected@example.test', interactive: false, rejectedAccessToken: 'synthetic-token' });
  f.changeSubject();
  await expect(f.connection.access(prepared.account)).rejects.toThrow('different account');
});

test('Android Microsoft preserves its opaque reference without invoking Google identity', async () => {
  let lookedUp = false;
  const auth = new AndroidAuthorization(async () => { lookedUp = true; throw new Error('must not run'); }, {
    async setup() { return {} as any; }, async acquire() { return { accessToken: 'fixture', scopes: [], accountRef: 'msal-opaque' }; }, async forget() {},
  });
  expect((await auth.acquire({ provider: 'microsoft', interactive: true })).accountRef).toBe('msal-opaque');
  expect(lookedUp).toBe(false);
});
