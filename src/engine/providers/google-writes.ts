import { googleEvent } from './google';
import type { ProviderWriter } from '../writes';
import type { EventChanges, EventCreate, EventTarget } from '../../services/contracts';
import { ServiceError } from '../../services/errors';
import type { HttpTransport } from '../../platform/ports';
import { ProviderHttp, object, string, optionalString } from './http';
const root = 'https://www.googleapis.com/calendar/v3/';
function timezone(value?: string) {
  const zone = value || 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone; }
  catch { throw new ServiceError('validation', 'Choose a valid event timezone.'); }
}
function date(value: string, allDay: boolean, zone: string) {
  if (!Number.isFinite(Date.parse(value))) throw new ServiceError('validation', 'Choose a valid event date.');
  return allDay ? { date: value.slice(0, 10) } : { dateTime: new Date(value).toISOString(), timeZone: zone };
}
function fields(changes: EventChanges, existing?: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  if (changes.title !== undefined) body.summary = changes.title;
  if (changes.description !== undefined) body.description = changes.description;
  if (changes.location !== undefined) body.location = changes.location;
  const priorStart = existing?.start ? object(existing.start) : {};
  const priorEnd = existing?.end ? object(existing.end) : {};
  const allDay = changes.allDay ?? Boolean(priorStart.date);
  const zone = timezone(changes.timezone || optionalString(priorStart.timeZone));
  const changesTiming = changes.start !== undefined || changes.end !== undefined || changes.allDay !== undefined || changes.timezone !== undefined;
  if (changesTiming) {
    const start = changes.start || string(priorStart.date || priorStart.dateTime);
    const end = changes.end || string(priorEnd.date || priorEnd.dateTime);
    if (Date.parse(end) < Date.parse(start) || allDay && end.slice(0, 10) <= start.slice(0, 10)) throw new ServiceError('validation', 'The event must end after it starts.');
    body.start = date(start, allDay, zone); body.end = date(end, allDay, zone);
  }
  if (changes.recurrenceRule !== undefined) {
    let rule = changes.recurrenceRule;
    if (rule?.startsWith('RRULE:')) rule = rule.slice(6);
    if (rule && (!/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/.test(rule) || /[\r\n]/.test(rule))) throw new ServiceError('unsupported', 'This recurrence rule is not supported by the editor.');
    if (rule && !allDay) rule = rule.replace(/UNTIL=(\d{8}T\d{6})(?=;|$)/, 'UNTIL=$1Z');
    body.recurrence = rule ? [`RRULE:${rule}`] : [];
    // A timed recurring series always carries a named timezone, even when
    // editing only its repeat rule. Keep DTSTART anchored to the existing series.
    if (rule && !allDay && !body.start) {
      body.start = date(string(priorStart.dateTime), false, zone);
      body.end = date(string(priorEnd.dateTime), false, zone);
    }
  }
  return body;
}
/** REST writes are single attempts. A journal/reconciler owns retries and identities. */
export class GoogleEventWriter {
  private readonly http: ProviderHttp;
  constructor(transport: HttpTransport) { this.http = new ProviderHttp(transport, root); }
  private url(calendar: string, event?: string) { return `${root}calendars/${encodeURIComponent(calendar)}/events${event ? '/' + encodeURIComponent(event) : ''}`; }
  async lookup(token: string, calendar: string, event: string, includeCancelled = false) {
    try {
      const row = await this.http.get(token, this.url(calendar, event));
      // Google keeps deleted resources addressable with status=cancelled.
      // Treat these as absent before mapping or reconciling an uncertain delete.
      return row.status === 'cancelled' && !includeCancelled ? null : row;
    }
    catch (error) { if (error instanceof ServiceError && error.code === 'not-found') return null; throw error; }
  }
  async create(token: string, calendar: string, operationId: string, input: EventCreate) {
    if (!/^[0-9a-v]{5,1024}$/.test(operationId)) throw new ServiceError('validation', 'Invalid stable create identity.');
    return this.http.request(token, this.url(calendar), 'POST', { ...fields(input), id: operationId });
  }
  async update(token: string, calendar: string, event: string, target: EventTarget, changes: EventChanges) {
    if (!target.revision) throw new ServiceError('conflict', 'Refresh the event before editing it.');
    if (target.scope === 'occurrence' && changes.recurrenceRule !== undefined) throw new ServiceError('unsupported', 'Open the series to change its repeat rule.');
    const existing = await this.lookup(token, calendar, event);
    if (!existing) throw new ServiceError('not-found', 'This event was removed elsewhere.');
    if (existing.etag !== target.revision) throw new ServiceError('conflict', 'This event changed elsewhere. Refresh before editing.');
    // Preserve the original precondition across the lookup; never retry with a
    // newly read revision if the provider rejects the subsequent PATCH.
    return this.http.request(token, this.url(calendar, event), 'PATCH', fields(changes, existing), { 'If-Match': target.revision });
  }
  async remove(token: string, calendar: string, event: string, target: EventTarget) {
    if (!target.revision) throw new ServiceError('conflict', 'Refresh the event before removing it.');
    await this.http.request(token, this.url(calendar, event), 'DELETE', undefined, { 'If-Match': target.revision });
  }
}

export function googleWriter(transport: HttpTransport): ProviderWriter {
  const rest = new GoogleEventWriter(transport);
  return {
    // A cancelled resource can still prove a create succeeded before another
    // client deleted it. Preserve that historical lookup separately from get(),
    // which treats cancellation as absence for delete reconciliation and edits.
    async findCreated(token, calendar, createId) {
      const row = await rest.lookup(token, calendar.remoteId, createId, true);
      if (!row) return null;
      if (row.id !== createId) throw new ServiceError('conflict', 'The saved Google resource contains a different event.');
      return { ...googleEvent(row, calendar.calendar.id), editable: false };
    },
    async get(token, calendar, remoteId) { const row = await rest.lookup(token, calendar.remoteId, remoteId); return row ? { ...googleEvent(row, calendar.calendar.id), editable: Boolean(calendar.calendar.writable) } : null; },
    async create(token, calendar, createId, event) { await rest.create(token, calendar.remoteId, createId, event); },
    async update(token, calendar, remoteId, target, changes) { await rest.update(token, calendar.remoteId, remoteId, target, changes); },
    async remove(token, calendar, remoteId, target) { await rest.remove(token, calendar.remoteId, remoteId, target); },
  };
}
