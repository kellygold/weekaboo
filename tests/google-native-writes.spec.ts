import { test, expect } from '@playwright/test';
import { GoogleEventWriter, googleWriter } from '../src/engine/providers/google-writes';
import type { HttpTransport } from '../src/platform/ports';
const input = { calendarId: 'c', title: 'Weekly', start: '2026-09-27T23:00:00Z', end: '2026-09-28T00:00:00Z', timezone: 'Australia/Sydney', allDay: false, description: null, location: null, recurrenceRule: 'FREQ=WEEKLY;UNTIL=20261011T220000' };
function fixture() {
  const calls: Parameters<HttpTransport['request']>[0][] = [];
  let status = 200;
  const writer = new GoogleEventWriter({ async request(request) { calls.push(request); return { status: request.method === 'GET' ? 200 : status, headers: {}, body: JSON.stringify({ id: 'event', etag: '"v1"', start: { dateTime: input.start, timeZone: input.timezone }, end: { dateTime: input.end } }) }; } });
  return { writer, calls, status: (value: number) => { status = value; } };
}
test('Google native create uses persisted identity, named zone, UTC UNTIL and exclusive all-day dates', async () => {
  const f = fixture(); await f.writer.create('synthetic', 'c', '0123456789abcdef', input);
  expect(JSON.parse(f.calls[0].body!)).toMatchObject({ id: '0123456789abcdef', start: { dateTime: input.start.replace('Z', '.000Z'), timeZone: 'Australia/Sydney' }, recurrence: ['RRULE:FREQ=WEEKLY;UNTIL=20261011T220000Z'] });
  await f.writer.create('synthetic', 'c', 'abcdef1234567890', { ...input, start: '2026-10-04', end: '2026-10-06', allDay: true, recurrenceRule: null });
  expect(JSON.parse(f.calls[1].body!)).toMatchObject({ start: { date: '2026-10-04' }, end: { date: '2026-10-06' } });
});
test('native stale update is refused and a concurrent 412 never retries with a new revision', async () => {
  const f = fixture();
  await expect(f.writer.update('token', 'c', 'e', { id: 'e', scope: 'event', revision: '"older"' }, { title: 'No' })).rejects.toMatchObject({ code: 'conflict' });
  expect(f.calls.map(c => c.method)).toEqual(['GET']);
  f.status(412);
  await expect(f.writer.update('token', 'c', 'e', { id: 'e', scope: 'event', revision: '"v1"' }, { description: null })).rejects.toMatchObject({ code: 'conflict' });
  expect(f.calls.map(c => c.method)).toEqual(['GET', 'GET', 'PATCH']);
  expect(f.calls[2].headers?.['If-Match']).toBe('"v1"'); expect(JSON.parse(f.calls[2].body!)).toEqual({ description: null });
});
test('native delete carries its base revision; absent precondition sends nothing', async () => {
  const f = fixture();
  await expect(f.writer.remove('token', 'c', 'e', { id: 'e', scope: 'event' })).rejects.toMatchObject({ code: 'conflict' });
  expect(f.calls).toHaveLength(0); f.status(204);
  await f.writer.remove('token', 'c', 'e', { id: 'e', scope: 'event', revision: '"v1"' });
  expect(f.calls[0]).toMatchObject({ method: 'DELETE', headers: { 'If-Match': '"v1"' } });
});
test('ambiguous server create failure is not retried or labeled as a safe failure', async () => {
  const f = fixture(); f.status(503);
  await expect(f.writer.create('token', 'c', '0123456789abcdef', input)).rejects.toMatchObject({ code: 'uncertain' });
  expect(f.calls).toHaveLength(1);
});

test('cancelled Google resources are absent even when GET returns 200 and retained event details', async () => {
  const calls: string[] = [];
  const writer = new GoogleEventWriter({ async request(request) {
    calls.push(request.method);
    return { status: 200, headers: {}, body: JSON.stringify({ id: 'deleted', status: 'cancelled', summary: 'Deleted test event', etag: '"v2"', start: {dateTime: input.start}, end: {dateTime: input.end} }) };
  } });
  expect(await writer.lookup('synthetic', 'c', 'deleted')).toBeNull();
  await expect(writer.update('synthetic', 'c', 'deleted', {id:'deleted',scope:'event',revision:'"v2"'}, {title:'Do not restore'})).rejects.toMatchObject({code:'not-found'});
  expect(calls).toEqual(['GET', 'GET']);
});

test('a subsequently cancelled Google event still proves its original create without restoring it', async () => {
  const calls: string[] = [];
  let id = '0123456789abcdef';
  const writer = googleWriter({ async request(request) {
    calls.push(request.method);
    return { status: 200, headers: {}, body: JSON.stringify({ id, status: 'cancelled', summary: 'Removed elsewhere', start: {dateTime: input.start}, end: {dateTime: input.end} }) };
  } });
  const calendar = {remoteId:'remote',calendar:{id:'c',name:'Test',provider:'google' as const,color:'#456789',scope:'personal' as const,writable:true}};
  expect(await writer.get('synthetic', calendar, id)).toBeNull();
  expect(await writer.findCreated!('synthetic', calendar, id)).toMatchObject({title:'Removed elsewhere',editable:false});
  id = 'different';
  await expect(writer.findCreated!('synthetic', calendar, '0123456789abcdef')).rejects.toMatchObject({code:'conflict'});
  expect(calls).toEqual(['GET','GET','GET']);
});
