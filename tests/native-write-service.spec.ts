import { test, expect } from '@playwright/test';
import { standaloneServices } from '../src/engine/services';
import { identity, type DocumentStore, type ProviderAccount, type StoredCalendar } from '../src/engine/state';
import type { ProviderConnection } from '../src/engine/connections';
import type { CalendarEvent } from '../src/domain';
import type { EventCreate } from '../src/services/contracts';
import { ServiceError } from '../src/services/errors';
class Documents implements DocumentStore {
  rows = new Map<string, { revision: number; value: string }>();
  fail = '';
  async read(key: string) { return this.rows.get(key) || { revision: 0, value: null }; }
  async compareAndSet(key: string, revision: number, value: string) {
    if (this.fail === key || (await this.read(key)).revision !== revision) return false;
    this.rows.set(key, { revision: revision + 1, value }); return true;
  }
}
function fixture() {
  const documents = new Documents();
  const account: ProviderAccount = { id: 'google:a', provider: 'google', subject: 'a', authorizationRef: 'a@example.test', email: 'a@example.test', status: 'active', needsAttention: false, sharedWorkCalendars: false };
  const calendar: StoredCalendar = { remoteId: 'remote', calendar: { id: 'calendar', accountId: account.id, provider: 'google', name: 'Calendar', scope: 'personal', color: '#112233', writable: true, enabled: true } };
  const remote = new Map<string, CalendarEvent>();
  let pendingRead: Promise<void> | undefined;
  let loseResponse = false, authFails = false, createCalls = 0, updateCalls = 0, deleteCalls = 0;
  const connection: ProviderConnection = {
    async prepare() { return { account, calendars: [calendar] }; },
    async access() { if (authFails) throw new ServiceError('authentication', 'Reconnect'); return 'private-token'; },
    async forget() {},
    reader: { async identity() { return { subject: 'a', email: account.email }; }, async calendars() { return [calendar]; }, async events() { const snapshot = [...remote.values()]; await pendingRead; return snapshot; } },
    writer: {
      async get(_token, _calendar, id) { return remote.get(id) || null; },
      async create(_token, _calendar, id, input) { createCalls++; remote.set(id, { ...input, id, commandId: identity('calendar', id), revision: 'v1', editable: true, location: input.location || undefined, description: input.description || undefined, recurrenceRule: input.recurrenceRule || undefined }); if (loseResponse) throw new ServiceError('uncertain', 'Lost response'); },
      async update(_token, _calendar, id, target, changes) { updateCalls++; const prior = remote.get(id)!; if (prior.revision !== target.revision) throw new ServiceError('conflict', 'Changed elsewhere'); remote.set(id, { ...prior, ...changes, revision: 'v2' } as CalendarEvent); if (loseResponse) throw new ServiceError('uncertain', 'Lost response'); },
      async remove(_token, _calendar, id) { deleteCalls++; remote.delete(id); if (loseResponse) throw new ServiceError('uncertain', 'Lost response'); },
    },
  };
  const make = () => standaloneServices({ documents, providers: { google: connection }, availability: async () => ({ google: true, microsoft: false, icloud: false }) });
  return { documents, remote, pauseReads: (value?: Promise<void>) => { pendingRead = value; }, make, services: make(), lose: (value: boolean) => { loseResponse = value; }, authFails: () => { authFails = true; }, counts: () => ({ createCalls, updateCalls, deleteCalls }) };
}
const input: EventCreate = { calendarId: 'calendar', title: 'Fixture only', start: '2026-10-03T09:00:00Z', end: '2026-10-03T10:00:00Z', allDay: false, description: null, location: null, recurrenceRule: null, timezone: 'UTC' };
test('lost create response reconciles after service restart without resending or retaining tokens', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.lose(true);
  await expect(f.services.calendars.createEvent(input)).rejects.toMatchObject({ code: 'uncertain' });
  expect(await f.services.calendars.pendingWrites!()).toHaveLength(1);
  await expect(f.services.accounts.disconnect('google:a')).rejects.toMatchObject({ code: 'conflict' });
  await expect(f.make().calendars.createEvent(input)).resolves.toEqual({ syncState: 'synced' });
  expect(f.counts().createCalls).toBe(1); expect(await f.services.calendars.pendingWrites!()).toEqual([]);
  expect(JSON.stringify([...f.documents.rows])).not.toContain('private-token');
});
test('failed post-save cache persistence preserves intent for reconciliation', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.documents.fail = 'event-cache';
  await expect(f.services.calendars.createEvent(input)).rejects.toThrow();
  f.documents.fail = '';
  await f.make().calendars.createEvent(input);
  expect(f.counts().createCalls).toBe(1);
});
test('preflight storage failure sends no remote request; unsent authentication failures can be discarded', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.documents.fail = 'event-operations';
  await expect(f.services.calendars.createEvent(input)).rejects.toThrow(); expect(f.counts().createCalls).toBe(0);
  f.documents.fail = ''; f.authFails();
  await expect(f.services.calendars.createEvent(input)).rejects.toMatchObject({ code: 'authentication' });
  const [pending] = await f.services.calendars.pendingWrites!(); expect(pending.sent).toBe(false);
  await f.services.calendars.resolveWrite!(pending.id, 'dismiss');
  await f.services.accounts.disconnect('google:a'); expect(await f.services.accounts.list()).toEqual([]);
});
test('uncertain changes prevent a changed draft from creating a second remote event', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); f.lose(true);
  await expect(f.services.calendars.createEvent(input)).rejects.toThrow();
  await expect(f.services.calendars.createEvent({ ...input, title: 'Edited draft' })).rejects.toMatchObject({ code: 'conflict' });
  expect(f.counts().createCalls).toBe(1);
  const [pending] = await f.services.calendars.pendingWrites!();
  await f.services.calendars.resolveWrite!(pending.id, 'check'); expect(await f.services.calendars.pendingWrites!()).toEqual([]);
});
test('uncertain update and delete check remote state without replaying mutations', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); await f.services.calendars.createEvent(input);
  const [id] = f.remote.keys(), target = { id: identity('calendar', id), revision: 'v1', scope: 'event' as const };
  f.lose(true);
  await expect(f.services.calendars.updateEvent(target, { title: 'Changed', description: null })).rejects.toThrow();
  await f.make().calendars.updateEvent(target, { title: 'Changed', description: null });
  const current = { ...target, revision: 'v2' };
  await expect(f.services.calendars.deleteEvent(current)).rejects.toThrow();
  await f.make().calendars.deleteEvent(current);
  expect(f.counts()).toEqual({ createCalls: 1, updateCalls: 1, deleteCalls: 1 });
});
test('stale writes reject without hiding the provider conflict as success', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); await f.services.calendars.createEvent(input);
  const [id] = f.remote.keys();
  await expect(f.services.calendars.updateEvent({ id: identity('calendar', id), revision: 'stale', scope: 'event' }, { title: 'Wrong' })).rejects.toMatchObject({ code: 'conflict' });
  expect(f.remote.get(id)?.title).toBe(input.title); expect(await f.services.calendars.pendingWrites!()).toEqual([]);
});

test('a read started before a successful write cannot overwrite the new state with a stale cache', async () => {
  const f = fixture(); await f.services.accounts.connect({ provider: 'google' }); await f.services.calendars.createEvent(input);
  let release!: () => void;
  f.pauseReads(new Promise<void>(resolve => { release = resolve; }));
  const reading = f.services.calendars.listEvents({ start: new Date('2026-10-01'), end: new Date('2026-10-08') });
  // Let the read enter its transport before the update is dispatched.
  await new Promise(resolve => setTimeout(resolve, 0));
  const [id] = f.remote.keys();
  await f.services.calendars.updateEvent({ id: identity('calendar', id), revision: 'v1', scope: 'event' }, { title: 'New state' });
  release();
  await expect(reading).rejects.toMatchObject({ code: 'conflict' });
  expect((await f.documents.read('event-cache')).value).not.toContain('Fixture only');
  f.pauseReads();
  expect((await f.services.calendars.listEvents({ start: new Date('2026-10-01'), end: new Date('2026-10-08') }))[0].title).toBe('New state');
});
