import { test, expect } from '@playwright/test';
import ICAL from 'ical.js';
import { icloudWriter } from '../src/engine/providers/icloud-writes';
import { ICloudCalDav } from '../src/engine/providers/caldav';
import { expandCalendarResource } from '../src/engine/providers/ical';
import type { EventCreate } from '../src/services/contracts';

const calendar: any = { remoteId: 'https://p47-caldav.icloud.com/123/calendars/home/', calendar: { id: 'c', writable: true } };
const id = 'c'.repeat(32);
const draft: EventCreate = { calendarId: 'c', title: 'Weekly fixture', start: '2026-09-27T23:00:00Z', end: '2026-09-28T00:00:00Z',
  allDay: false, timezone: 'Australia/Sydney', recurrenceRule: 'FREQ=WEEKLY;COUNT=3', description: null, location: null };
function fixture() {
  const calls: any[] = []; let body = '';
  const writer = icloudWriter(new ICloudCalDav({ async request(request) {
    calls.push(request);
    if (request.method === 'PUT') { body = request.body || ''; return { status: 201, headers: {}, body: '' }; }
    return { status: body ? 200 : 404, headers: { etag: 'v1' }, body };
  } }));
  return { writer, calls, body: () => body, replace: (next: string) => { body = next; } };
}
function rows(body: string, start = '2026-09-01', end = '2026-11-01') {
  return expandCalendarResource({ ics: body, calendarId: 'c', href: calendar.remoteId + id + '.ics', range: { start: new Date(start), end: new Date(end) } });
}
test('new iCloud weekly repeat preserves 9am Sydney through spring DST and uses conditional stable creation', async () => {
  const f = fixture(); await f.writer.create('synthetic', calendar, id, draft);
  expect(f.calls).toHaveLength(1); expect(f.calls[0].headers['If-None-Match']).toBe('*');
  expect(f.calls[0].url).toBe(calendar.remoteId + id + '.ics');
  const root = new ICAL.Component(ICAL.parse(f.body())), event = root.getFirstSubcomponent('vevent')!;
  expect(root.getAllSubcomponents('vtimezone')).toHaveLength(1);
  expect(event.getFirstProperty('dtstart')?.getParameter('tzid')).toBe('Australia/Sydney');
  expect(rows(f.body()).map(row => row.start)).toEqual(['2026-09-27T23:00:00.000Z', '2026-10-04T22:00:00.000Z', '2026-10-11T22:00:00.000Z']);
  expect(rows(f.body()).every(row => row.recurring && row.commandId)).toBe(true);
});
test('new repeat retains its hour through autumn DST and accepts pinned IANA aliases', async () => {
  const f = fixture(); await f.writer.create('synthetic', calendar, id, { ...draft, start: '2026-03-28T22:00:00Z', end: '2026-03-28T23:00:00Z', timezone: 'Australia/NSW' });
  expect(rows(f.body(), '2026-03-01', '2026-05-01').map(row => row.start)).toEqual(['2026-03-28T22:00:00.000Z', '2026-04-04T23:00:00.000Z', '2026-04-11T23:00:00.000Z']);
  await f.writer.create('synthetic', calendar, id, { ...draft, timezone: 'Asia/Calcutta' });
  expect(f.body()).toContain('TZID:Asia/Kolkata');
  await f.writer.create('synthetic', calendar, id, { ...draft, timezone: 'UTC' });
  expect(f.body()).not.toContain('BEGIN:VTIMEZONE');
});
test('all-day repeating events retain exclusive civil dates without timezone shifts', async () => {
  const f = fixture(); await f.writer.create('synthetic', calendar, id, { ...draft, start: '2026-10-03', end: '2026-10-05', allDay: true });
  expect(f.body()).not.toContain('BEGIN:VTIMEZONE');
  expect(rows(f.body()).map(row => [row.start, row.end])).toEqual([['2026-10-03', '2026-10-05'], ['2026-10-10', '2026-10-12'], ['2026-10-17', '2026-10-19']]);
});
test('new recurrence rejects unsupported zones and invalid rules before any remote request', async () => {
  const f = fixture();
  for (const timezone of [undefined, 'Invented/Zone', '__proto__']) await expect(f.writer.create('synthetic', calendar, id, { ...draft, timezone })).rejects.toThrow();
  for (const recurrenceRule of ['FREQ=SECONDLY', 'FREQ=WEEKLY;COUNT=', 'FREQ=WEEKLY;INTERVAL=', 'FREQ=WEEKLY;UNTIL=', 'FREQ=WEEKLY;COUNT=0', 'FREQ=WEEKLY;COUNT=3;COUNT=4', 'FREQ=WEEKLY;COUNT=3;UNTIL=20270101T000000Z', 'FREQ=WEEKLY;UNTIL=20260231T000000Z', 'FREQ=WEEKLY;UNTIL=20271001T000000', 'FREQ=WEEKLY\r\nSUMMARY:bad']) {
    await expect(f.writer.create('synthetic', calendar, id, { ...draft, recurrenceRule })).rejects.toMatchObject({ code: 'validation' });
  }
  expect(f.calls).toHaveLength(0);
});
test('UTC UNTIL includes final zoned occurrence and date UNTIL stays civil', async () => {
  const f = fixture(); await f.writer.create('synthetic', calendar, id, { ...draft, recurrenceRule: 'FREQ=WEEKLY;UNTIL=20261004T220000Z' });
  expect(rows(f.body())).toHaveLength(2);
  await f.writer.create('synthetic', calendar, id, { ...draft, allDay: true, start: '2026-10-03', end: '2026-10-04', recurrenceRule: 'FREQ=WEEKLY;UNTIL=20261010' });
  expect(rows(f.body())).toHaveLength(2);
});
test('lost-response reconciliation finds an ended or cancelled repeat without creating again, and checks UID', async () => {
  const f = fixture(); await f.writer.create('synthetic', calendar, id, draft);
  f.replace(f.body().replace('SUMMARY:Weekly fixture', 'STATUS:CANCELLED\r\nSUMMARY:Weekly fixture'));
  expect(await f.writer.findCreated!('synthetic', calendar, id)).toMatchObject({ title: draft.title });
  expect(f.calls.map(call => call.method)).toEqual(['PUT', 'GET']);
  f.replace(f.body().replace(`UID:${id}`, 'UID:other-event'));
  await expect(f.writer.findCreated!('synthetic', calendar, id)).rejects.toMatchObject({ code: 'conflict' });
});
