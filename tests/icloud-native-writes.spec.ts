import { test, expect } from '@playwright/test';
import { ICloudCalDav } from '../src/engine/providers/caldav';
import { icloudWriter } from '../src/engine/providers/icloud-writes';
import ICAL from 'ical.js';
const calendar: any = { remoteId: 'https://p47-caldav.icloud.com/123/calendars/home/', calendar: { id: 'c', writable: true } };
const href = '/123/calendars/home/fixture.ics';
const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Fixture//EN\r\nBEGIN:VEVENT\r\nUID:fixture\r\nDTSTART:20261004T220000Z\r\nDTEND:20261004T230000Z\r\nSUMMARY:Original\r\nDESCRIPTION:Original notes\r\nATTENDEE;PARTSTAT=ACCEPTED:mailto:guest@example.test\r\nX-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
test('iCloud native update preserves UID, attendees, alarms, unknown fields and original If-Match', async () => {
  const calls: any[] = [];
  const writer = icloudWriter(new ICloudCalDav({ async request(request) { calls.push(request); return request.method === 'GET' ? { status: 200, headers: { etag: 'v1' }, body: ics } : { status: 204, headers: { etag: 'v2' }, body: '' }; } }));
  await writer.update('Basic synthetic', calendar, href, { id: 'opaque', revision: 'v1', scope: 'event' }, { title: 'Updated', description: 'Budget < 50 & a reminder\nNext line', end: '2026-10-05T00:00:00Z' });
  expect(calls.map(call => call.method)).toEqual(['GET', 'PUT']);
  expect(calls[1].headers['If-Match']).toBe('v1');
  const event = new ICAL.Component(ICAL.parse(calls[1].body)).getFirstSubcomponent('vevent')!;
  expect(event.getFirstPropertyValue('uid')).toBe('fixture'); expect(event.getFirstPropertyValue('summary')).toBe('Updated');
  expect(event.getFirstPropertyValue('description')).toBe('Budget < 50 & a reminder\nNext line');
  expect(event.getFirstPropertyValue('x-apple-travel-advisory-behavior')).toBe('AUTOMATIC');
  expect(event.getAllSubcomponents('valarm')).toHaveLength(1); expect(event.getAllProperties('attendee')).toHaveLength(1);
});
test('iCloud stale updates and racing 412 never retry with a new ETag', async () => {
  const calls: any[] = [];
  const writer = icloudWriter(new ICloudCalDav({ async request(request) { calls.push(request); return { status: request.method === 'GET' ? 200 : 412, headers: { etag: 'v1' }, body: ics }; } }));
  await expect(writer.update('Basic synthetic', calendar, href, { id: 'opaque', revision: 'old', scope: 'event' }, { title: 'No' })).rejects.toMatchObject({ code: 'conflict' });
  expect(calls).toHaveLength(1); calls.length = 0;
  await expect(writer.update('Basic synthetic', calendar, href, { id: 'opaque', revision: 'v1', scope: 'event' }, { title: 'No' })).rejects.toMatchObject({ code: 'conflict' });
  expect(calls.map(call => call.method)).toEqual(['GET', 'PUT']); expect(calls[1].headers['If-Match']).toBe('v1');
});
test('iCloud create uses a stable resource, exclusive civil dates and If-None-Match', async () => {
  const calls: any[] = [];
  const writer = icloudWriter(new ICloudCalDav({ async request(request) { calls.push(request); return { status: 201, headers: { etag: 'new' }, body: '' }; } }));
  const id = 'b'.repeat(32);
  await writer.create('Basic synthetic', calendar, id, { calendarId: 'c', title: 'All day', start: '2026-10-04', end: '2026-10-06', allDay: true, location: null, description: null, recurrenceRule: null });
  expect(calls[0].url).toBe(calendar.remoteId + id + '.ics'); expect(calls[0].headers['If-None-Match']).toBe('*');
  const event = new ICAL.Component(ICAL.parse(calls[0].body)).getFirstSubcomponent('vevent')!;
  expect(event.getFirstPropertyValue('uid')).toBe(id);
  expect(String(event.getFirstPropertyValue('dtstart'))).toBe('2026-10-04'); expect(String(event.getFirstPropertyValue('dtend'))).toBe('2026-10-06');
});
test('iCloud resource access confines paths, validates redirects before forwarding credentials, and never retries 503 writes', async () => {
  const calls: any[] = [];
  let status = 307;
  const dav = new ICloudCalDav({ async request(request) { calls.push(request); return { status, headers: { location: 'https://attacker.example/fixture.ics' }, body: '' }; } });
  await expect(dav.resource('Basic synthetic', calendar.remoteId, '/outside.ics')).rejects.toMatchObject({ code: 'validation' }); expect(calls).toHaveLength(0);
  await expect(dav.resource('Basic synthetic', calendar.remoteId, href)).rejects.toThrow('unsafe'); expect(calls).toHaveLength(1);
  status = 503;
  await expect(dav.resource('Basic synthetic', calendar.remoteId, href, 'PUT', ics, 'v1')).rejects.toMatchObject({ code: 'uncertain' }); expect(calls).toHaveLength(2);
});
test('iCloud recurrence capabilities do not permit deleting a whole series through an occurrence', async () => {
  const calls: any[] = [];
  const writer = icloudWriter(new ICloudCalDav({ async request(request) { calls.push(request); return { status: 200, headers: { etag: 'v1' }, body: ics.replace('SUMMARY:Original', 'RRULE:FREQ=WEEKLY\r\nSUMMARY:Original') }; } }));
  expect(writer.canEdit!({ recurring: true } as any)).toBe(false);
  await expect(writer.remove('Basic synthetic', calendar, href, { id: 'opaque', revision: 'v1', scope: 'occurrence' })).rejects.toMatchObject({ code: 'unsupported' }); expect(calls).toHaveLength(0);
  await expect(writer.remove('Basic synthetic', calendar, href, { id: 'opaque', revision: 'v1', scope: 'event' })).rejects.toMatchObject({ code: 'unsupported' }); expect(calls.map(call => call.method)).toEqual(['GET']);
});
