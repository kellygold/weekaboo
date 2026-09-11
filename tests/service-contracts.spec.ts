import { test, expect } from '@playwright/test';
import { HttpCalendarService, HttpAccountService, calendarRequest, calendarEvent, type CalendarRequest } from '../src/calendar-api';
import { LocalTaskService } from '../src/services/tasks';
import { eventTarget } from '../src/services/contracts';
import type { Task, TaskStore } from '../src/domain';
import { readFileSync, readdirSync } from 'node:fs';

function requests(result: unknown = { sync_state: 'pending_update' }) {
  const calls: { path: string; method?: string; body?: unknown; timeout?: number }[] = [];
  const request: CalendarRequest = async <T>(path: string, method?: string, body?: unknown, timeout?: number) => {
    calls.push({ path, method, body, timeout }); return result as T;
  };
  return { calls, request };
}

test('calendar commands preserve partial intent, explicit clearing and opaque IDs', async () => {
  const { request, calls } = requests(); const service = new HttpCalendarService(request);
  await service.updateEvent({ id: '17', scope: 'occurrence' }, { description: null, allDay: false });
  expect(calls[0]).toMatchObject({ path: 'events/17', method: 'PATCH', body: { description: null, all_day: false } });
  await service.configure('9', { enabled: false });
  expect(calls[1].body).toEqual({ sync_enabled: false });
  await expect(service.deleteEvent({ id: '../accounts/1', scope: 'event' })).rejects.toMatchObject({ code: 'validation' });
  await expect(service.updateEvent({ id: '17', scope: 'event', revision: 'base-etag' }, { title: 'New' })).rejects.toMatchObject({ code: 'unsupported' });
  expect(calls).toHaveLength(2);
});

test('create retains timezone and exclusive all-day boundaries without leaking DTO fields', async () => {
  const { request, calls } = requests({ sync_state: 'pending_create' }); const service = new HttpCalendarService(request);
  expect(await service.createEvent({ calendarId: '7', title: 'Away', start: '2026-10-03T00:00:00Z', end: '2026-10-05T00:00:00Z', allDay: true, timezone: 'Australia/Sydney', location: null, description: null, recurrenceRule: null })).toEqual({ syncState: 'pending_create' });
  expect(calls[0].body).toEqual({ calendar_id: 7, title: 'Away', start_at: '2026-10-03T00:00:00Z', end_at: '2026-10-05T00:00:00Z', all_day: true, timezone: 'Australia/Sydney', location: null, description: null, recurrence_rule: null });
});

test('series and occurrence targets remain distinct from render identities', () => {
  const row: any = { id: 4, calendar_id: 7, title: 'Weekly', start_at: '2026-10-04T09:00:00+11:00', end_at: '2026-10-04T10:00:00+11:00', all_day: false, editable: true, recurring: true, recurrence_rule: 'FREQ=WEEKLY' };
  const original = calendarEvent(row), moved = calendarEvent({ ...row, start_at: '2026-10-04T10:00:00+11:00' });
  expect(eventTarget(original)).toEqual({ id: '4', scope: 'series', revision: undefined });
  expect(moved.commandId).toBe(original.commandId);
  expect(eventTarget({ ...original, recurrenceRule: undefined }).scope).toBe('occurrence');
  expect(() => eventTarget({ ...original, editable: false })).toThrow('read-only');
});

test('account service normalizes metadata and preserves provider-specific consent', async () => {
  const captured = requests({ url: 'https://login.example.test/authorize' }); const navigation: string[] = [];
  const accounts = new HttpAccountService(captured.request, url => navigation.push(url));
  await accounts.connect({ provider: 'microsoft', sharedWorkCalendars: false });
  await accounts.connect({ provider: 'microsoft', sharedWorkCalendars: true });
  await accounts.connect({ provider: 'icloud', email: 'test@example.test', appPassword: 'synthetic-password' });
  expect(captured.calls.map(c => c.body)).toEqual([{ shared_work_calendars: false }, { shared_work_calendars: true }, { apple_id: 'test@example.test', app_password: 'synthetic-password' }]);
  expect(captured.calls[2].timeout).toBe(90000); expect(navigation).toHaveLength(2);
  const list = new HttpAccountService(requests([{ id: 2, provider: 'google', email: 'a@example.test', status: 'active', last_error: 'private diagnostic', token: 'must not escape' }]).request, () => {});
  expect(await list.list()).toEqual([{ id: '2', provider: 'google', email: 'a@example.test', status: 'active', needsAttention: true }]);
});

test('HTTP failures distinguish conflicts and uncertain writes without retrying', async () => {
  const original = globalThis.fetch;
  let count = 0;
  try {
    globalThis.fetch = async () => { count++; throw new TypeError('private network detail'); };
    await expect(calendarRequest('events', 'POST', {})).rejects.toMatchObject({ code: 'uncertain' });
    expect(count).toBe(1);
    await expect(calendarRequest('events')).rejects.toMatchObject({ code: 'unavailable' });
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Changed remotely' } }), { status: 412 });
    await expect(calendarRequest('events/1', 'PATCH', {})).rejects.toMatchObject({ code: 'conflict', status: 412 });
  } finally { globalThis.fetch = original; }
});

test('shared task rules retain hidden rank slots and historical completion dates', async () => {
  let rows: Task[] = []; let next = 0; let clock = new Date('2026-09-11T12:00:00Z');
  const store: TaskStore = { async list() { return structuredClone(rows); }, async transact(transform) { rows = transform(structuredClone(rows)); } };
  const service = new LocalTaskService(store, () => clock, () => String(++next));
  await service.create(' First '); await service.create('Hidden'); await service.create('Third');
  await service.reorder(['3', '1']);
  expect((await service.list()).map(t => t.title)).toEqual(['Third', 'Hidden', 'First']);
  await service.complete('1'); const completed = (await service.list()).find(t => t.id === '1')!;
  clock = new Date('2026-09-12T12:00:00Z'); await service.update('1', { notes: 'Retain history' });
  expect((await service.list()).find(t => t.id === '1')!.completedAt).toBe(completed.completedAt);
  const before = await service.list();
  await expect(service.reorder(['1', '1'])).rejects.toThrow(); expect(await service.list()).toEqual(before);
  await service.reopen('1'); expect((await service.list()).find(t => t.id === '1')!.completedOn).toBeUndefined();
});

test('IndexedDB transactions abort fully and read original version-one tasks', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const { IndexedDBTaskStore } = await (new Function('return import("/src/repository.ts")'))();
    const { LocalTaskService } = await (new Function('return import("/src/services/tasks.ts")'))();
    const store = new IndexedDBTaskStore(); const service = new LocalTaskService(store);
    await service.create('Keep this');
    try { await store.transact((tasks: any[]) => { tasks[0].title = 'Must roll back'; throw new Error('Abort'); }); } catch {}
    const titles = (await store.list()).map((t: any) => t.title);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('wall-calendar'); req.onsuccess = () => resolve(req.result); req.onerror = reject; });
    const version = db.version; db.close(); return { titles, version };
  });
  expect(result).toEqual({ titles: ['Keep this'], version: 1 });
});

test('React features cannot import concrete service or storage implementations', () => {
  const files = readdirSync('src').filter(file => file.endsWith('.tsx') && !['bootstrap.tsx', 'native-bootstrap.tsx'].includes(file));
  for (const file of files) {
    const source = readFileSync(`src/${file}`, 'utf8');
    expect(source, file).not.toMatch(/from ['"]\.\/(calendar-api|repository)['"]|calendarRequest\(|sourceId|\/api\//);
  }
});
