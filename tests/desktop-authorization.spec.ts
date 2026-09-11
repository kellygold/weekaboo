import { test, expect } from '@playwright/test';
import { DesktopAuthorization } from '../desktop/authorization.mjs';
import { OAuth2Client } from 'google-auth-library';
const scopes = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar'];
const config = { google: { clientId: '123-fixture.apps.googleusercontent.com', clientSecret: '' }, microsoft: { clientId: '11111111-2222-3333-4444-555555555555' } };
function fixture() {
  const values = new Map<string, string>(); let subject = 'one', wrongAudience = false, denied = false, failStore = false, invalidExpiry = false; const requests: any[] = [];
  const vault = { vaultGet: ({ reference }: any) => ({ value: values.get(reference) ?? null }), vaultPut: ({ reference, value }: any) => { if (failStore) throw new Error('private storage diagnostic'); values.set(reference, value); }, vaultRemove: ({ reference }: any) => values.delete(reference) };
  const google = (options: any) => new OAuth2Client({ ...options, transporterOptions: { ...options.transporterOptions, fetchImplementation: async (url: any, input: any) => {
    requests.push({ url: String(url), body: String(input.body), headers: Object.fromEntries(new Headers(input.headers)) });
    const tokenInfo = String(url).includes('tokeninfo');
    return new Response(JSON.stringify(tokenInfo ? { aud: wrongAudience ? 'foreign' : config.google.clientId, sub: subject, scope: (denied ? scopes.slice(0, 2) : scopes).join(' '), expires_in: invalidExpiry ? 'bad' : 3600 } : { access_token: 'fixture-' + subject, refresh_token: 'refresh-' + subject, expires_in: 3600, token_type: 'Bearer', scope: scopes.join(' ') }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } } });
  const authorize = async ({ buildUrl }: any) => {
    const uri = await buildUrl({ redirectUri: 'http://127.0.0.1:45000/', state: 'fixture-state', challenge: 'fixture-challenge' });
    const url = new URL(uri); expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.searchParams.get('state')).toBe('fixture-state');
    return { code: 'fixture-code', redirectUri: 'http://127.0.0.1:45000/', verifier: 'fixture-verifier' };
  };
  const auth = new DesktopAuthorization(config, vault, async () => {}, { google, authorize });
  return { auth, values, requests, vault, google, authorize, setSubject(value: string) { subject = value; }, deny() { denied = true; }, wrongAudience() { wrongAudience = true; }, failStore() { failStore = true; }, invalidExpiry() { invalidExpiry = true; } };
}
test('Google desktop SDK uses PKCE and retains separate accounts across adapter restart and forced refresh', async () => {
  const f = fixture(); const one = await f.auth.acquire({ provider: 'google', interactive: true });
  f.setSubject('two'); const two = await f.auth.acquire({ provider: 'google', interactive: true });
  expect(one.accountRef).not.toBe(two.accountRef); expect(f.values.size).toBe(2);
  expect(new URLSearchParams(f.requests[0].body).get('code_verifier')).toBe('fixture-verifier');
  f.setSubject('one'); const restarted = new DesktopAuthorization(config, f.vault, async () => {}, { google: f.google, authorize: f.authorize });
  await restarted.acquire({ provider: 'google', interactive: false, accountRef: one.accountRef, rejectedAccessToken: 'fixture-one' });
  expect(f.requests.some(row => new URLSearchParams(row.body).get('grant_type') === 'refresh_token')).toBe(true);
  await restarted.forget({ provider: 'google', accountRef: one.accountRef }); expect(f.values.has(two.accountRef)).toBe(true); expect(f.values.has(one.accountRef)).toBe(false);
});
test('Google desktop wrong-account/audience/scope and failed storage never replace a working cache', async () => {
  for (const scenario of ['account', 'audience', 'scope', 'storage', 'expiry']) {
    const f = fixture(); const one = await f.auth.acquire({ provider: 'google', interactive: true }); const before = [...f.values];
    if (scenario === 'account') f.setSubject('two'); if (scenario === 'audience') f.wrongAudience(); if (scenario === 'scope') f.deny(); if (scenario === 'storage') f.failStore(); if (scenario === 'expiry') f.invalidExpiry();
    await expect(f.auth.acquire({ provider: 'google', interactive: true, accountRef: one.accountRef })).rejects.toHaveProperty('code');
    expect([...f.values]).toEqual(before);
  }
});
test('Microsoft desktop uses per-account silent refresh and commits only validated cache changes', async () => {
  const values = new Map<string, string>(); let selected = 'one', denied = false; const calls: any[] = [];
  const vault = { vaultGet: ({ reference }: any) => ({ value: values.get(reference) ?? null }), vaultPut: ({ reference, value }: any) => values.set(reference, value), vaultRemove: ({ reference }: any) => values.delete(reference) };
  const microsoft = () => {
    let accounts: any[] = [];
    const result = (request: any) => { const account = request.account || { homeAccountId: selected }; if (!accounts.some(a => a.homeAccountId === account.homeAccountId)) accounts.push(account); return { accessToken: 'fixture', account, scopes: denied ? [] : request.scopes, expiresOn: new Date(Date.now() + 3600000) }; };
    return { getTokenCache: () => ({ deserialize: (s: string) => { accounts = JSON.parse(s); }, serialize: () => JSON.stringify(accounts), getAccountByHomeId: async (id: string) => accounts.find(a => a.homeAccountId === id), removeAccount: async (a: any) => { accounts = accounts.filter(row => row.homeAccountId !== a.homeAccountId); } }),
      getAuthCodeUrl: async (request: any) => { calls.push(request); return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'; },
      acquireTokenByCode: async (request: any) => { calls.push(request); return result(request); },
      acquireTokenSilent: async (request: any) => { calls.push(request); return result(request); } };
  };
  const authorize = async ({ buildUrl, hostname }: any) => { expect(hostname).toBe('localhost'); await buildUrl({ redirectUri: 'http://localhost:45000/', state: 'fixture', challenge: 'challenge' }); return { code: 'code', redirectUri: 'http://localhost:45000/', verifier: 'verifier' }; };
  const auth = new DesktopAuthorization(config, vault, async () => {}, { microsoft, authorize });
  await auth.acquire({ provider: 'microsoft', interactive: true }); selected = 'two'; await auth.acquire({ provider: 'microsoft', interactive: true, sharedWorkCalendars: true });
  const before = [...values]; selected = 'wrong'; await expect(auth.acquire({ provider: 'microsoft', interactive: true, accountRef: 'one' })).rejects.toHaveProperty('code', 'interaction-required'); expect([...values]).toEqual(before);
  denied = true; await expect(auth.acquire({ provider: 'microsoft', interactive: false, accountRef: 'two' })).rejects.toHaveProperty('code', 'denied'); expect([...values]).toEqual(before); denied = false;
  await auth.acquire({ provider: 'microsoft', interactive: false, accountRef: 'two', rejectedAccessToken: 'fixture' }); expect(calls.at(-1)).toMatchObject({ account: { homeAccountId: 'two' }, forceRefresh: true });
  await auth.forget({ provider: 'microsoft', accountRef: 'one' }); expect(JSON.parse([...values.values()][0])).toEqual([{ homeAccountId: 'two' }]);
});
test('desktop cancellation and overlapping requests do not retain a late grant or leave the adapter busy', async () => {
  const f = fixture(); let release!: () => void;
  const auth = new DesktopAuthorization(config, f.vault, async () => {}, { google: f.google, authorize: async () => { await new Promise<void>(resolve => release = resolve); return { code: 'code', verifier: 'verifier', redirectUri: 'http://127.0.0.1:45000/' }; } });
  const pending = auth.acquire({ provider: 'google', interactive: true });
  await expect(auth.acquire({ provider: 'google', interactive: true })).rejects.toHaveProperty('code', 'busy'); auth.cancel(); release();
  await expect(pending).rejects.toHaveProperty('code', 'cancelled'); expect(f.values.size).toBe(0);
  await expect(auth.acquire({ provider: 'google', interactive: false, accountRef: 'missing' })).rejects.toHaveProperty('code', 'interaction-required');
});

test('desktop sign-in cancel bypasses waiting and does not abort silent refresh', async () => {
  const f = fixture(); let arrived!: () => void;
  const started = new Promise<void>(resolve => arrived=resolve);
  const auth = new DesktopAuthorization(config, f.vault, async()=>{}, {google:f.google,authorize:async({signal}:any)=>{
    arrived();
    await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled socket')),{once:true}));
  }});
  const pending=auth.acquire({provider:'google',interactive:true});
  await started;auth.cancelInteractive();
  await expect(pending).rejects.toHaveProperty('code','cancelled');
  expect(f.values.size).toBe(0);
  let finish!:()=>void, silentSignal:AbortSignal|undefined;
  const silent=auth.run(async(signal:AbortSignal)=>{silentSignal=signal;await new Promise<void>(resolve=>finish=resolve);});
  auth.cancelInteractive();expect(silentSignal?.aborted).toBe(false);finish();await silent;
});
