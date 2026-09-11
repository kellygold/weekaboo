import type { EventChanges, EventCreate, EventTarget } from '../../services/contracts';
import { ServiceError } from '../../services/errors';
import type { HttpTransport } from '../../platform/ports';
import type { ProviderWriter } from '../writes';
import { ProviderHttp, object, string, optionalString } from './http';
import { microsoftEvent } from './microsoft';
import { mergeMicrosoftNotes, microsoftNotes } from './microsoft-body';
import { graphRecurrence, zonedClock } from './graph-recurrence';
const root = 'https://graph.microsoft.com/v1.0/';
// A fixed property namespace and name, with a unique value per persisted intent.
// Do not allocate a new MAPI named property for every event.
const operationProperty = 'String {a78b4433-2b1f-4964-8d83-fef8c5db2b8a} Name WeekabooOperation';
function fields(changes: EventChanges, previous?: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  const before = previous ? microsoftEvent(previous, 'validation') : undefined;
  if (changes.title !== undefined) body.subject = changes.title;
  if (changes.location !== undefined) body.location = { displayName: changes.location || '' };
  if (changes.description !== undefined) {
    const oldBody = previous?.body ? optionalString(object(previous.body).content) || '' : '';
    if (!previous || (microsoftNotes(oldBody).editable || '') !== (changes.description || '')) body.body = { contentType: 'HTML', content: mergeMicrosoftNotes(oldBody, changes.description, previous?.isOnlineMeeting === true) };
  }
  const allDay = changes.allDay ?? before?.allDay ?? false;
  const zone = changes.timezone || before?.timezone || 'UTC';
  const start = changes.start ?? before?.start, end = changes.end ?? before?.end;
  if (['start', 'end', 'allDay', 'timezone'].some(key => key in changes)) {
    if (!start || !end || Date.parse(end) < Date.parse(start) || allDay && end.slice(0, 10) <= start.slice(0, 10)) throw new ServiceError('validation', 'Choose a valid event time range.');
    body.start = { dateTime: zonedClock(start, zone, allDay), timeZone: zone };
    body.end = { dateTime: zonedClock(end, zone, allDay), timeZone: zone };
    body.isAllDay = allDay;
  }
  if (changes.recurrenceRule !== undefined) {
    if (!start) throw new ServiceError('validation', 'A repeating event needs a start date.');
    body.recurrence = graphRecurrence(changes.recurrenceRule, start, zone, allDay);
  }
  return body;
}
export function microsoftWriter(transport: HttpTransport): ProviderWriter {
  const http = new ProviderHttp(transport, root, { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' });
  const url = (calendar: string, event?: string) => `${root}me/calendars/${encodeURIComponent(calendar)}/events${event ? '/' + encodeURIComponent(event) : ''}`;
  async function lookup(token: string, calendar: string, event: string) {
    try { return await http.get(token, url(calendar, event)); }
    catch (error) { if (error instanceof ServiceError && error.code === 'not-found') return null; throw error; }
  }
  function precondition(target: EventTarget) { if (!target.revision) throw new ServiceError('conflict', 'Refresh the event before changing it.'); return { 'If-Match': target.revision }; }
  return {
    async get(token, calendar, id) { const row = await lookup(token, calendar.remoteId, id); return row ? { ...microsoftEvent(row, calendar.calendar.id), editable: Boolean(calendar.calendar.writable) } : null; },
    async findCreated(token, calendar, id) {
      if (!/^[0-9a-f]{32}$/.test(id)) throw new ServiceError('validation', 'Invalid saved change identity.');
      const query = new URL(url(calendar.remoteId));
      query.searchParams.set('$filter', `singleValueExtendedProperties/Any(ep: ep/id eq '${operationProperty}' and ep/value eq '${id}')`);
      const rows = await http.pages(token, query.href, 'value', body => body['@odata.nextLink'] === undefined ? undefined : string(body['@odata.nextLink']));
      if (rows.length > 1) throw new ServiceError('conflict', 'More than one event matches this saved change. Review the calendar before continuing.');
      return rows.length ? { ...microsoftEvent(rows[0], calendar.calendar.id), editable: Boolean(calendar.calendar.writable) } : null;
    },
    async create(token, calendar, id, input: EventCreate) {
      if (!/^[0-9a-f]{32}$/.test(id)) throw new ServiceError('validation', 'Invalid saved change identity.');
      await http.request(token, url(calendar.remoteId), 'POST', { ...fields(input), transactionId: id, singleValueExtendedProperties: [{ id: operationProperty, value: id }] });
    },
    async update(token, calendar, id, target, changes) {
      const headers = precondition(target);
      if (target.scope === 'occurrence' && changes.recurrenceRule !== undefined) throw new ServiceError('unsupported', 'Change this occurrence without changing the repeat rule.');
      const row = await lookup(token, calendar.remoteId, id);
      if (!row) throw new ServiceError('not-found', 'This event was removed elsewhere.');
      if (row['@odata.etag'] !== target.revision) throw new ServiceError('conflict', 'This Outlook event changed elsewhere. Refresh before editing.');
      await http.request(token, url(calendar.remoteId, id), 'PATCH', fields(changes, row), headers);
    },
    async remove(token, calendar, id, target) { await http.request(token, url(calendar.remoteId, id), 'DELETE', undefined, precondition(target)); },
  };
}
