import { test, expect } from '@playwright/test';
import { oauthConnection } from '../src/engine/connections';
import { standaloneServices } from '../src/engine/services';
import { CalendarStateStore, type DocumentStore, type ProviderReader } from '../src/engine/state';
import { ProviderHttp } from '../src/engine/providers/http';
import { googleReader } from '../src/engine/providers/google';
import { microsoftReader } from '../src/engine/providers/microsoft';
import { AuthorizationError, type AuthorizationPort } from '../src/platform/authorization';
import type { HttpTransport } from '../src/platform/ports';

class MemoryDocuments implements DocumentStore {
  rows = new Map<string, { revision: number; value: string }>();
  async read(key: string) { return this.rows.get(key) || { revision: 0, value: null }; }
  async compareAndSet(key: string, revision: number, value: string) {
    if ((await this.read(key)).revision !== revision) return false;
    this.rows.set(key, { revision: revision + 1, value }); return true;
  }
}
const range = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-08T00:00:00Z') };
function fixture() {
  const documents = new MemoryDocuments();
  let offline = false, subject = 'a', failDiscovery = false;
  const calls: unknown[] = [];
  const auth: AuthorizationPort = {
    async acquire(input) { calls.push(input); if (offline) throw new AuthorizationError('unavailable', 'Offline'); return { accessToken: 'synthetic-private-token', scopes: ['calendar'], accountRef: subject }; },
    async forget(provider, ref) { calls.push({ forget: provider, ref }); },
  };
  const reader: ProviderReader = {
    async identity() { return { subject, email: `${subject}@example.test` }; },
    async calendars(_token, account) { if (failDiscovery) throw new Error('Incomplete pagination'); return [{ remoteId: 'remote', calendar: { id: `${account.id}:calendar`, accountId: account.id, provider: account.provider, name: 'Calendar', scope: 'personal', color: '#123456', enabled: true, writable: true } }]; },
    async events(_token, { calendar }) { return [{ id: `${calendar.id}:event`, calendarId: calendar.id, title: 'Fixture', start: '2026-10-03T09:00:00Z', end: '2026-10-03T10:00:00Z', allDay: false, editable: false }]; },
  };
  const services = standaloneServices({ documents, providers: { google: oauthConnection('google', auth, reader), microsoft: oauthConnection('microsoft', auth, reader) }, availability: async () => ({ google: true, microsoft: true, icloud: false }) });
  return { documents, services, calls, reader, offline: (value: boolean) => { offline = value; }, subject: (value: string) => { subject = value; }, failDiscovery: () => { failDiscovery = true; } };
}

test('calendar discovery continues after another account needs reconnecting and retains its settings', async () => {
  const f = fixture();
  await f.services.accounts.connect({ provider: 'google' });
  await f.services.accounts.connect({ provider: 'microsoft' });
  const google = (await f.services.calendars.listCalendars()).find(row => row.provider === 'google')!;
  await f.services.calendars.configure(google.id, { color: '#abcdef', scope: 'work', enabled: false });
  const discover = f.reader.calendars;
  const visited: string[] = [];
  f.reader.calendars = async (token, account) => {
    visited.push(account.provider);
    if (account.provider === 'google') throw new AuthorizationError('interaction-required', 'Synthetic reconnect required');
    return (await discover(token, account)).map(row => ({ ...row, calendar: { ...row.calendar, name: 'Updated Microsoft calendar' } }));
  };
  await f.services.calendars.refresh();
  expect(visited).toEqual(['google', 'microsoft']);
  expect((await f.services.calendars.listCalendars()).find(row => row.id === google.id)).toMatchObject({ color: '#abcdef', scope: 'work', enabled: false, syncError: expect.any(String) });
  expect((await f.services.calendars.listCalendars()).find(row => row.provider === 'microsoft')?.name).toBe('Updated Microsoft calendar');
  expect((await f.services.accounts.list()).find(row => row.provider === 'google')).toMatchObject({ status: 'needs_reauth', needsAttention: true });
  // A later successful discovery clears the connection warning without replacing the account.
  f.reader.calendars = discover;
  await f.services.calendars.refresh();
  expect((await f.services.accounts.list()).find(row => row.provider === 'google')).toMatchObject({ status: 'active', needsAttention: false });
  expect(await f.services.accounts.list()).toHaveLength(2);
});

test('all failed calendar discoveries report failure after trying every account without removing calendars', async () => {
  const f = fixture();
  await f.services.accounts.connect({ provider: 'google' });
  await f.services.accounts.connect({ provider: 'microsoft' });
  const before = (await f.services.calendars.listCalendars()).map(row => row.id);
  const visited: string[] = [];
  f.reader.calendars = async (_token, account) => { visited.push(account.provider); throw new Error('Synthetic provider outage'); };
  await expect(f.services.calendars.refresh()).rejects.toThrow('Synthetic provider outage');
  expect(visited).toEqual(['google', 'microsoft']);
  expect((await f.services.calendars.listCalendars()).map(row => row.id)).toEqual(before);
  expect((await f.services.accounts.list()).every(row => row.status === 'sync_error' && row.needsAttention)).toBe(true);
});

test('successful event reads preserve persisted incomplete calendar-discovery warnings', async () => {
  const f = fixture();
  await f.services.accounts.connect({ provider: 'google' });
  await f.services.accounts.connect({ provider: 'microsoft' });
  const discover = f.reader.calendars;
  f.reader.calendars = async (token, account) => {
    if (account.provider === 'google') throw new Error('Synthetic incomplete calendar list');
    return discover(token, account);
  };
  await f.services.calendars.refresh();
  expect(await f.services.calendars.listEvents(range)).toHaveLength(2);
  expect((await f.services.calendars.listCalendars()).find(row => row.provider === 'google')?.syncError).toBeTruthy();
  expect((await new CalendarStateStore(f.documents).read()).accounts.find(row => row.provider === 'google')).toMatchObject({ status: 'sync_error', needsAttention: true, discoveryNeedsAttention: true });
  f.reader.calendars = discover;
  await f.services.calendars.refresh();
  await f.services.calendars.listEvents(range);
  expect((await f.services.calendars.listCalendars()).find(row => row.provider === 'google')?.syncError).toBeUndefined();
});

test('native account persists only after identity and complete discovery, never exposing tokens', async () => {
  const f = fixture(); f.failDiscovery();
  await expect(f.services.accounts.connect({ provider: 'google' })).rejects.toThrow('pagination');
  expect(await f.services.accounts.list()).toEqual([]);
  const g = fixture(); await g.services.accounts.connect({ provider: 'google' });
  expect(await g.services.accounts.list()).toEqual([{ id: 'google:a', email: 'a@example.test', provider: 'google', status: 'active', needsAttention: false }]);
  expect(JSON.stringify([...g.documents.rows])).not.toContain('synthetic-private-token');
  expect((await g.services.calendars.listCalendars())[0].writable).toBe(false);
});

test('reconnecting preserves visibility, color and group rather than duplicating the account', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'microsoft', sharedWorkCalendars: true });
  const calendar = (await f.services.calendars.listCalendars())[0];
  await f.services.calendars.configure(calendar.id, { enabled: false, color: '#aabbcc', scope: 'work' });
  await f.services.accounts.connect({ provider: 'microsoft', sharedWorkCalendars: true });
  expect(await f.services.accounts.list()).toHaveLength(1);
  expect((await f.services.calendars.listCalendars())[0]).toMatchObject({ enabled: false, color: '#aabbcc', scope: 'work' });
  expect(f.calls[0]).toMatchObject({ sharedWorkCalendars: true, interactive: true });
});

test('offline reads retain cached events and disconnect clears only that account', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' });
  await f.services.calendars.listEvents(range);
  f.offline(true);
  expect((await f.services.calendars.listEvents(range))[0]).toMatchObject({ title: 'Fixture', syncState: 'cached' });
  expect((await f.services.accounts.list())[0].needsAttention).toBe(true);
  f.offline(false); f.subject('b'); await f.services.accounts.connect({ provider: 'google' });
  await f.services.accounts.disconnect('google:a');
  expect((await f.services.accounts.list()).map(a => a.id)).toEqual(['google:b']);
  expect((await f.documents.read('event-cache')).value).not.toContain('google:a');
});

test('silent account mismatch cannot read another account calendars', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.subject('someone-else');
  await expect(f.services.calendars.listEvents(range)).rejects.toMatchObject({ code: 'authentication' });
  expect((await f.services.accounts.list())[0].status).toBe('needs_reauth');
});

test('state CAS conflict does not overwrite a concurrent connection', async () => {
  const docs = new MemoryDocuments(); const store = new CalendarStateStore(docs);
  const snapshot = await docs.read('calendar-state');
  await store.change(state => state);
  expect(await docs.compareAndSet('calendar-state', snapshot.revision, 'discard')).toBe(false);
  expect((await store.read()).version).toBe(1);
});

test('remote pagination cannot send a token to another origin or loop forever', async () => {
  const calls: string[] = [];
  const transport: HttpTransport = { async request(input) { calls.push(input.url); return { status: 200, headers: {}, body: JSON.stringify({ value: [], '@odata.nextLink': 'https://attacker.example/v1.0/leak' }) }; } };
  const http = new ProviderHttp(transport, 'https://graph.microsoft.com/v1.0/');
  await expect(http.pages('secret', 'https://graph.microsoft.com/v1.0/me/events', 'value', b => String(b['@odata.nextLink']))).rejects.toThrow('unsafe');
  expect(calls).toHaveLength(1);
  await expect(http.pages('secret', 'https://graph.microsoft.com/v1.0/me/events', 'value', () => 'https://graph.microsoft.com/v1.0/me/events')).rejects.toThrow('repeated');
  expect(calls).toHaveLength(2);
});

test('Google moved recurring occurrences keep identity and all-day dates stay civil', async () => {
  let start = '2026-10-03T09:00:00+10:00';
  const transport: HttpTransport = { async request() { return { status: 200, headers: {}, body: JSON.stringify({ items: [{ id: 'instance', recurringEventId: 'series', originalStartTime: { dateTime: '2026-10-03T09:00:00+10:00' }, start: { dateTime: start }, end: { dateTime: '2026-10-03T12:00:00+10:00' }, summary: 'Moved' }, { id: 'all-day', start: { date: '2026-10-04' }, end: { date: '2026-10-05' } }] }) }; } };
  const reader = googleReader(transport), calendar: any = { remoteId: 'remote', calendar: { id: 'calendar' } };
  const original = await reader.events('token', calendar, range); start = '2026-10-03T10:00:00+10:00';
  const moved = await reader.events('token', calendar, range);
  expect(moved[0].id).toBe(original[0].id); expect(moved[0].start).not.toBe(original[0].start);
  expect(moved[1]).toMatchObject({ start: '2026-10-04', end: '2026-10-05', allDay: true });
});

test('Graph all-day events recover original civil dates across Sydney DST', async () => {
  const transport: HttpTransport = { async request(input) {
    expect(input.headers?.Prefer).toContain('ImmutableId');
    return { status: 200, headers: {}, body: JSON.stringify({ value: [{ id: 'stable', subject: 'DST day', isAllDay: true, originalStartTimeZone: 'AUS Eastern Standard Time', start: { dateTime: '2026-10-03T14:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-04T13:00:00.0000000', timeZone: 'UTC' }, attendees: [{ emailAddress: { address: 'guest@example.test' }, status: { response: 'declined' } }], onlineMeeting: { joinUrl: 'https://teams.live.com/meet/synthetic' } }] }) };
  } };
  const events = await microsoftReader(transport).events('token', { remoteId: 'r', calendar: { id: 'c' } } as any, range);
  expect(events[0]).toMatchObject({ start: '2026-10-04', end: '2026-10-05', allDay: true, meetingUrl: 'https://teams.live.com/meet/synthetic', attendees: [{ status: 'declined' }] });
});

test('Google missing items is an empty page; malformed present items remains an error', async () => {
  let body: unknown = {};
  const reader = googleReader({ async request() { return { status: 200, headers: {}, body: JSON.stringify(body) }; } });
  const calendar = { remoteId: 'r', calendar: { id: 'c' } } as any;
  expect(await reader.events('token', calendar, range)).toEqual([]);
  body = { items: null };
  await expect(reader.events('token', calendar, range)).rejects.toThrow('incomplete');
});
test('zero-duration provider events retain their true times', async () => {
  const google = googleReader({ async request() { return { status: 200, headers: {}, body: JSON.stringify({ items: [{ id: 'point', start: { dateTime: '2026-10-03T09:00:00Z' }, end: { dateTime: '2026-10-03T09:00:00Z' } }] }) }; } });
  const microsoft = microsoftReader({ async request() { return { status: 200, headers: {}, body: JSON.stringify({ value: [{ id: 'point', start: { dateTime: '2026-10-03T09:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-10-03T09:00:00', timeZone: 'UTC' } }] }) }; } });
  for (const reader of [google, microsoft]) {
    const events = await reader.events('token', { remoteId: 'r', calendar: { id: 'c' } } as any, range);
    expect(events).toHaveLength(1); expect(events[0].start).toBe(events[0].end);
  }
});
test('oversized old cache windows are evicted so new reads remain usable', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' });
  await f.documents.compareAndSet('event-cache', 0, JSON.stringify({ version: 1, entries: [{ accountId: 'old', calendarId: 'old', start: '2025-01-01', end: '2025-02-01', events: [{ description: 'x'.repeat(6500000) }] }] }));
  expect(await f.services.calendars.listEvents(range)).toHaveLength(1);
  expect((await f.documents.read('event-cache')).value!.length).toBeLessThan(6000000);
  expect((await f.services.accounts.list())[0].status).toBe('active');
});
test('Android adapter queues silent refresh behind interactive login without a busy failure', async () => {
  const { AndroidAuthorization } = await import('../src/platform/android-authorization');
  const calls: string[] = []; let release!: () => void;
  const native = {
    async setup() { return {} as any; },
    async acquire(input: { interactive: boolean }) {
      calls.push(input.interactive ? 'interactive' : 'silent');
      if (input.interactive) await new Promise<void>(resolve => { release = resolve; });
      return { accessToken: 'synthetic', scopes: [] };
    },
    async forget() { calls.push('forget'); },
  };
  const identify = async () => ({ email: 'existing@example.test' });
  const one = new AndroidAuthorization(identify, native), two = new AndroidAuthorization(identify, native);
  const login = one.acquire({ provider: 'google', interactive: true });
  await expect.poll(() => calls.length).toBe(1);
  const refresh = two.acquire({ provider: 'google', interactive: false, accountRef: 'existing@example.test' });
  const forget = two.forget('google', 'existing@example.test');
  await new Promise(resolve => setTimeout(resolve, 20)); expect(calls).toEqual(['interactive']);
  release(); await Promise.all([login, refresh, forget]); expect(calls).toEqual(['interactive', 'silent', 'forget']);
});

test('iCloud failed metadata commit rolls credentials back without exposing them in SQLite', async () => {
  const { icloudConnection } = await import('../src/engine/connections');
  const vault = new Map<string, string>();
  const stored = { async get(key: string) { return vault.get(key) ?? null; }, async put(key: string, value: string) { vault.set(key, value); }, async remove(key: string) { vault.delete(key); } };
  const dav = { async discover() { return { subject: '/123/principal/', home: 'https://p01-caldav.icloud.com/123/calendars/' }; }, async calendars() { return []; }, async events() { return []; } };
  const connection = icloudConnection(dav as any, stored);
  const docs = new MemoryDocuments();
  const services = standaloneServices({ documents: docs, providers: { icloud: connection }, availability: async () => ({ google: false, microsoft: false, icloud: true }) });
  const original = docs.compareAndSet.bind(docs);
  docs.compareAndSet = async () => false;
  await expect(services.accounts.connect({ provider: 'icloud', email: 'apple@example.test', appPassword: 'synthetic-password' })).rejects.toMatchObject({ code: 'conflict' });
  expect(vault.size).toBe(0); expect(await services.accounts.list()).toEqual([]);
  docs.compareAndSet = original;
  await services.accounts.connect({ provider: 'icloud', email: 'apple@example.test', appPassword: 'synthetic-password' });
  expect(JSON.stringify([...docs.rows])).not.toContain('synthetic-password');
  const old = [...vault.values()][0];
  docs.compareAndSet = async () => false;
  await expect(services.accounts.connect({ provider: 'icloud', email: 'apple@example.test', appPassword: 'replacement-password' })).rejects.toMatchObject({ code: 'conflict' });
  expect([...vault.values()][0]).toBe(old);
});

test('rejected cached identity token renews once; wrong account still fails without renewal', async () => {
  const { ServiceError } = await import('../src/services/errors');
  const requests: any[] = [];
  const auth: AuthorizationPort = { async acquire(input) { requests.push(input); return { accessToken: input.rejectedAccessToken ? 'fresh' : 'expired', scopes: [] }; }, async forget() {} };
  const reader = { async identity(token: string) { if (token === 'expired') throw new ServiceError('authentication', 'Rejected', 401); return { subject: 'expected', email: 'expected@example.test' }; } } as ProviderReader;
  const connection = oauthConnection('google', auth, reader);
  const account: any = { subject: 'expected', authorizationRef: 'expected@example.test', sharedWorkCalendars: false };
  expect(await connection.access(account)).toBe('fresh');
  expect(requests).toHaveLength(2); expect(requests[1].rejectedAccessToken).toBe('expired');
  reader.identity = async () => { throw new ServiceError('authentication', 'Still rejected', 401); };
  await expect(connection.access(account)).rejects.toMatchObject({ status: 401 });
  expect(requests).toHaveLength(4);
  reader.identity = async () => ({ subject: 'different', email: 'different@example.test' });
  await expect(connection.access(account)).rejects.toMatchObject({ code: 'authentication' });
  expect(requests).toHaveLength(5);
});

test('cancelled desktop discovery rolls back before publishing accounts and releases the queue', async () => {
  const documents = new MemoryDocuments(); let release!: () => void; let started!: () => void;
  const entered = new Promise<void>(resolve => started = resolve);
  let rollback = 0, abort = 0;
  const account: any = {id:'google:cancel',provider:'google',subject:'cancel',email:'fixture@example.test',authorizationRef:'fixture',status:'active',needsAttention:false};
  const provider: any = {prepare:async()=>{started(); await new Promise<void>(resolve=>release=resolve);return {account,calendars:[],rollback:async()=>{rollback++;}};}};
  const service = standaloneServices({documents,providers:{google:provider},availability:async()=>({google:true,microsoft:false,icloud:false}),cancelAuthorization:async()=>{abort++;}});
  const pending = service.accounts.connect({provider:'google'});
  await entered;
  await service.accounts.cancelConnection!();
  expect(abort).toBe(1);
  release();
  await expect(pending).rejects.toHaveProperty('code','cancelled');
  expect(rollback).toBe(1);expect(await service.accounts.list()).toEqual([]);
  provider.prepare=async()=>({account,calendars:[]});
  await service.accounts.connect({provider:'google'});
  expect(await service.accounts.list()).toHaveLength(1);
});

test('a connection cancelled before its queued operation starts never opens authorization', async () => {
 const documents=new MemoryDocuments();let opened=0;
 const service=standaloneServices({documents,providers:{google:{prepare:async()=>{opened++;throw new Error('must not start');}} as any},availability:async()=>({google:true,microsoft:false,icloud:false}),cancelAuthorization:async()=>{}});
 const pending=service.accounts.connect({provider:'google'});
 await service.accounts.cancelConnection!();
 await expect(pending).rejects.toHaveProperty('code','cancelled');expect(opened).toBe(0);
});

for (const provider of ['google', 'microsoft'] as const) test(`${provider} queued desktop sign-in cancels behind silent refresh without opening the browser`, async () => {
  const { DesktopAuth } = await import('../src/platform/desktop');
  const host = globalThis as any, previousWindow = host.window;
  let release!: () => void, entered!: () => void, interactive = 0, cancelled = 0;
  const started = new Promise<void>(resolve => entered = resolve);
  host.window = { weekabooNative: {
    async authAcquire(input: { interactive: boolean }) {
      if (!input.interactive) { entered(); await new Promise<void>(resolve => release = resolve); }
      else interactive++;
      return { ok: true, value: { accessToken: 'synthetic', scopes: [], accountRef: 'fixture' } };
    },
    async authCancel() { cancelled++; return { ok: true }; },
    async authForget() { return { ok: true }; },
  } };
  try {
    const auth = new DesktopAuth();
    const reader = { async identity() { return { subject: 'fixture', email: 'fixture@example.test' }; }, async calendars() { return []; } } as unknown as ProviderReader;
    const service = standaloneServices({ documents: new MemoryDocuments(), providers: { [provider]: oauthConnection(provider, auth, reader) }, availability: async () => ({ google: true, microsoft: true, icloud: false }), cancelAuthorization: () => auth.cancel() });
    const silent = auth.acquire({ provider, interactive: false, accountRef: 'fixture' });
    await started;
    const pending = service.accounts.connect({ provider });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(interactive).toBe(0);
    await service.accounts.cancelConnection!();
    expect(cancelled).toBe(1);
    release(); await silent;
    await expect(pending).rejects.toHaveProperty('code', 'cancelled');
    expect(interactive).toBe(0); expect(await service.accounts.list()).toEqual([]);
    await service.accounts.connect({ provider });
    expect(interactive).toBe(1); expect(await service.accounts.list()).toHaveLength(1);
  } finally { release?.(); host.window = previousWindow; }
});

test('cancelling during account storage read prevents starting provider authorization', async () => {
  const documents = new MemoryDocuments(); let release!: () => void, entered!: () => void, opened = 0;
  const started = new Promise<void>(resolve => entered = resolve);
  documents.read = async () => { entered(); await new Promise<void>(resolve => release = resolve); return { revision: 0, value: null }; };
  const services = standaloneServices({ documents, providers: { google: { prepare: async () => { opened++; throw new Error('must not start'); } } as any }, availability: async () => ({ google: true, microsoft: false, icloud: false }), cancelAuthorization: async () => {} });
  const pending = services.accounts.connect({ provider: 'google' });
  await started; await services.accounts.cancelConnection!(); release();
  await expect(pending).rejects.toHaveProperty('code', 'cancelled'); expect(opened).toBe(0);
});
