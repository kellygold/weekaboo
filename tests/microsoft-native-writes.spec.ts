import { test, expect } from '@playwright/test';
import { microsoftWriter } from '../src/engine/providers/microsoft-writes';
import { microsoftNotes, mergeMicrosoftNotes } from '../src/engine/providers/microsoft-body';
import { graphRecurrence } from '../src/engine/providers/graph-recurrence';
const block = `<div class="me-email-text" lang="en-US"><h2>Microsoft Teams meeting</h2><a href="https://teams.live.com/meet/123?p=abc&amp;x=1">Join now</a><div class="me-email-text">Nested protected details</div></div>`;
const body = `<html><head><meta charset="utf-8"></head><body><p>Old notes</p><div>_______</div>\n${block}<hr></body></html>`;
const calendar: any = { remoteId: 'remote', calendar: { id: 'calendar', writable: true } };
const row = { id: 'event', '@odata.etag': 'original', subject: 'Fixture', start: { dateTime: '2026-10-04T22:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-10-04T23:00:00', timeZone: 'UTC' }, originalStartTimeZone: 'AUS Eastern Standard Time', isOnlineMeeting: true, body: { contentType: 'HTML', content: body }, attendees: [{ emailAddress: { address: 'guest@example.test' }, status: { response: 'accepted' } }] };
test('Microsoft protected body is copied byte-for-byte, notes remain editable, repeated edits do not multiply blocks', () => {
  expect(microsoftNotes(body).editable).toBe('<p>Old notes</p>');
  expect(microsoftNotes(body).meetingUrl).toBe('https://teams.live.com/meet/123?p=abc&x=1');
  const once = mergeMicrosoftNotes(body, '<p>New notes</p>', true);
  expect(once).toContain(block); expect(once).not.toContain('Old notes');
  expect(mergeMicrosoftNotes(once, '<p>New notes</p>', true)).toBe(once);
  expect(microsoftNotes(once).editable).toBe('<p>New notes</p>');
  expect(mergeMicrosoftNotes(once, null, true)).toContain(block);
});
test('unknown or malformed online-meeting body fails closed before erasing join data', () => {
  expect(() => mergeMicrosoftNotes('<div class="me-email-text">No closing div', '<p>Change</p>', true)).toThrow('incomplete');
  expect(() => mergeMicrosoftNotes('<p><a href="https://teams.microsoft.com/l/meetup-join/123">Join</a></p>', '', true)).toThrow('unrecognized');
});
test('native Microsoft updates only changed fields, preserving original ETag and meeting/attendee metadata', async () => {
  const calls: any[] = [];
  const writer = microsoftWriter({ async request(request) { calls.push(request); return { status: 200, headers: {}, body: JSON.stringify(row) }; } });
  await writer.update('synthetic-token', calendar, 'event', { id: 'opaque', revision: 'original', scope: 'event' }, { description: '<p>New notes</p>' });
  const patch = calls[1], sent = JSON.parse(patch.body);
  expect(Object.keys(sent)).toEqual(['body']); expect(sent.body.content).toContain(block); expect(sent.body.content).not.toContain('Old notes');
  expect(patch.headers['If-Match']).toBe('original'); expect(patch.headers.Prefer).toContain('ImmutableId');
  const preview = await writer.get('synthetic-token', calendar, 'event');
  expect(preview?.editableDescription).toBe('<p>Old notes</p>'); expect(preview?.attendees).toHaveLength(1);
});
test('Microsoft rejects stale revisions and does not retry a racing 412', async () => {
  const calls: any[] = [];
  const writer = microsoftWriter({ async request(request) { calls.push(request); return { status: request.method === 'GET' ? 200 : 412, headers: {}, body: JSON.stringify(row) }; } });
  await expect(writer.update('token', calendar, 'event', { id: 'opaque', revision: 'stale', scope: 'event' }, { title: 'New' })).rejects.toMatchObject({ code: 'conflict' });
  expect(calls).toHaveLength(1); calls.length = 0;
  await expect(writer.update('token', calendar, 'event', { id: 'opaque', revision: 'original', scope: 'event' }, { title: 'New' })).rejects.toMatchObject({ code: 'conflict' });
  expect(calls.map(call => call.method)).toEqual(['GET', 'PATCH']); expect(calls[1].headers['If-Match']).toBe('original');
});
test('Microsoft create carries stable transaction and queryable identity, named zone, and recurrence anchor', async () => {
  const calls: any[] = [];
  const writer = microsoftWriter({ async request(request) { calls.push(request); return { status: 200, headers: {}, body: JSON.stringify(request.method === 'GET' ? { value: [row] } : row) }; } });
  const id = 'a'.repeat(32);
  await writer.create('token', calendar, id, { calendarId: 'calendar', title: 'Fixture', start: '2026-10-04T22:00:00Z', end: '2026-10-04T23:00:00Z', allDay: false, timezone: 'Australia/Sydney', location: null, description: null, recurrenceRule: 'FREQ=WEEKLY;COUNT=3' });
  const sent = JSON.parse(calls[0].body);
  expect(sent.transactionId).toBe(id); expect(sent.singleValueExtendedProperties[0].value).toBe(id);
  expect(sent.start).toEqual({ dateTime: '2026-10-05T09:00:00', timeZone: 'Australia/Sydney' });
  expect(sent.recurrence.pattern.daysOfWeek).toEqual(['monday']); expect(sent.recurrence.range).toMatchObject({ startDate: '2026-10-05', recurrenceTimeZone: 'Australia/Sydney', numberOfOccurrences: 3 });
  expect((await writer.findCreated!('token', calendar, id))?.title).toBe('Fixture');
  expect(new URL(calls[1].url).searchParams.get('$filter')).toContain(`ep/value eq '${id}'`);
  await writer.remove('token', calendar, 'event', { id: 'opaque', revision: 'original', scope: 'event' });
  expect(calls.at(-1).headers['If-Match']).toBe('original');
});
test('Graph recurrence rejects unsupported selectors and uses local end date for UTC UNTIL', () => {
  expect(() => graphRecurrence('FREQ=MONTHLY;BYDAY=1MO', '2026-10-04T22:00:00Z', 'Australia/Sydney', false)).toThrow();
  expect(graphRecurrence('FREQ=WEEKLY;UNTIL=20261011T220000Z', '2026-10-04T22:00:00Z', 'Australia/Sydney', false)?.range.endDate).toBe('2026-10-12');
});
