import ICAL from 'ical.js';
import type { EventChanges } from '../../services/contracts';
import { ServiceError } from '../../services/errors';
import { splitEventTarget, type ProviderWriter } from '../writes';
import { ICloudCalDav } from './caldav';
import { expandCalendarResource } from './ical';
import { decodeIcalTarget, icalResource, selectIcalEvent, requireIcalCoverage } from './ical-target';
import { attachTimezone, newIcalRecurrence } from './ical-timezone';
import { identity } from '../state';
function changesTo(root: ICAL.Component, event: ICAL.Event, changes: EventChanges) {
  if (changes.recurrenceRule) throw new ServiceError('unsupported', 'Changing an existing iCloud repeat pattern is not supported yet. Your draft has been kept.');
  const component = event.component;
  if (changes.title !== undefined) event.summary = changes.title;
  for (const field of ['description', 'location'] as const) if (changes[field] !== undefined) {
    if (changes[field] === null) component.removeAllProperties(field);
    else component.updatePropertyWithValue(field, changes[field]!);
  }
  if (['start', 'end', 'allDay', 'timezone'].some(key => key in changes)) {
    const allDay = changes.allDay ?? event.startDate.isDate;
    const stamp = (input: string | undefined, old: ICAL.Time) => {
      if (!input && allDay === old.isDate) return old.clone();
      input ??= old.isDate ? old.toString() + 'T00:00:00Z' : old.toJSDate().toISOString();
      if (!Number.isFinite(Date.parse(input))) throw new ServiceError('validation', 'Choose a valid event date.');
      if (allDay) return ICAL.Time.fromDateString(input.slice(0, 10));
      // Preserve an existing supplied VTIMEZONE when present. New single events
      // may use UTC instants without relying on a separately fetched tz database.
      const zone = old.zone;
      if (zone.tzid !== 'UTC' && zone.tzid !== 'floating' && !root.getTimeZoneByID(zone.tzid)) throw new ServiceError('unsupported', 'The event timezone definition is missing.');
      return ICAL.Time.fromJSDate(new Date(input), true).convertToZone(zone.tzid === 'floating' ? ICAL.Timezone.utcTimezone : zone);
    };
    const from = stamp(changes.start, event.startDate), to = stamp(changes.end, event.endDate);
    if (from.isDate !== to.isDate || to.compare(from) < 0 || allDay && to.compare(from) === 0) throw new ServiceError('validation', 'Choose a valid event time range.');
    requireIcalCoverage(root, from); requireIcalCoverage(root, to);
    event.startDate = from; event.endDate = to;
    // ICAL setters serialize type/TZID correctly; DTEND supersedes old DURATION.
    component.removeAllProperties('duration');
  }
  component.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true));
  component.updatePropertyWithValue('sequence', Number(component.getFirstPropertyValue('sequence') || 0) + 1);
  return root.toString() + '\r\n';
}
export function icloudWriter(dav: ICloudCalDav): ProviderWriter {
  async function lookup(token: string, collection: string, href: string) {
    try { return await dav.resource(token, collection, href); }
    catch (error) { if (error instanceof ServiceError && error.code === 'not-found') return null; throw error; }
  }
  const path = (collection: string, id: string) => {
    if (!/^[0-9a-f]{32}$/.test(id)) throw new ServiceError('validation', 'Invalid saved change identity.');
    return new URL(`${id}.ics`, collection).pathname;
  };
  function mapped(snapshot: { ics: string; etag?: string; href: string }, calendarId: string, target = decodeIcalTarget(snapshot.href)) {
    const { root, events } = icalResource(snapshot.ics);
    const event = selectIcalEvent(root, events, target);
    if (!event) return null;
    const start = event.startDate.toJSDate(), end = event.endDate.toJSDate();
    const rows = expandCalendarResource({ ...snapshot, calendarId, range: { start: new Date(+start - 86400000), end: new Date(+end + 86400000) } });
    const match = rows.find(row => {
      const command = decodeIcalTarget(splitEventTarget({ id: row.commandId!, scope: 'event' }).remoteId);
      return target.slot ? command.uid === target.uid && command.slot === target.slot : !row.recurring;
    });
    if (!match) throw new ServiceError('unavailable', 'This iCloud event cannot be edited safely.');
    return { ...match, editable: true };
  }
  return {
    canEdit: event => !event.recurring || Boolean(event.commandId && decodeIcalTarget(splitEventTarget({ id: event.commandId, scope: 'occurrence' }).remoteId).slot),
    async get(token, calendar, id) { const target = decodeIcalTarget(id); const snapshot = await lookup(token, calendar.remoteId, target.href); return snapshot ? mapped(snapshot, calendar.calendar.id, target) : null; },
    async findCreated(token, calendar, id) {
      const snapshot = await lookup(token, calendar.remoteId, path(calendar.remoteId, id));
      if (!snapshot) return null;
      const { events } = icalResource(snapshot.ics);
      // Reconciliation identifies our deterministic resource, not a visible
      // occurrence: a repeat may have ended or its first slot may be cancelled.
      if (events[0].uid !== id) throw new ServiceError('conflict', 'The saved iCloud resource contains a different event.');
      const event = events.find(row => !row.isRecurrenceException()) || events[0];
      const stamp = (time: ICAL.Time) => time.isDate ? time.toString() : time.toJSDate().toISOString();
      return { id: identity(calendar.calendar.id, id), calendarId: calendar.calendar.id, title: event.summary,
        start: stamp(event.startDate), end: stamp(event.endDate), allDay: event.startDate.isDate, editable: false };
    },
    async create(token, calendar, id, input) {
      const root = new ICAL.Component('vcalendar'); root.updatePropertyWithValue('version', '2.0'); root.updatePropertyWithValue('prodid', '-//Weekaboo//Calendar//EN');
      const component = new ICAL.Component('vevent'); root.addSubcomponent(component);
      const event = new ICAL.Event(component); event.uid = id;
      event.startDate = ICAL.Time.fromJSDate(new Date(input.start), true); event.endDate = ICAL.Time.fromJSDate(new Date(input.end), true);
      changesTo(root, event, { ...input, recurrenceRule: null });
      if (input.recurrenceRule) {
        if (!input.allDay) {
          if (!input.timezone) throw new ServiceError('validation', 'Choose a timezone for this repeating event.');
          const zone = attachTimezone(root, input.timezone);
          event.startDate = event.startDate.convertToZone(zone); event.endDate = event.endDate.convertToZone(zone);
          requireIcalCoverage(root, event.startDate); requireIcalCoverage(root, event.endDate);
        }
        component.updatePropertyWithValue('rrule', newIcalRecurrence(input.recurrenceRule, event.startDate));
      }
      const body = root.toString() + '\r\n';
      await dav.resource(token, calendar.remoteId, path(calendar.remoteId, id), 'PUT', body, '*');
    },
    async update(token, calendar, id, target, changes) {
      if (!target.revision) throw new ServiceError('conflict', 'Refresh the iCloud event before editing.');
      const selected = decodeIcalTarget(id), href = selected.href;
      if (target.scope !== (selected.slot ? 'occurrence' : 'event')) throw new ServiceError('unsupported', 'Whole-series editing is still being migrated. Select an individual occurrence.');
      const snapshot = await lookup(token, calendar.remoteId, href);
      if (!snapshot) throw new ServiceError('not-found', 'This event was removed elsewhere.');
      if (snapshot.etag !== target.revision) throw new ServiceError('conflict', 'This iCloud event changed elsewhere. Refresh before editing.');
      const { root, events } = icalResource(snapshot.ics);
      const event = selectIcalEvent(root, events, selected, true);
      if (!event) throw new ServiceError('not-found', 'This occurrence was removed elsewhere.');
      await dav.resource(token, calendar.remoteId, href, 'PUT', changesTo(root, event, changes), target.revision);
    },
    async remove(token, calendar, id, target) {
      if (!target.revision) throw new ServiceError('conflict', 'Refresh the iCloud event before removing it.');
      const selected = decodeIcalTarget(id), href = selected.href;
      if (target.scope !== (selected.slot ? 'occurrence' : 'event')) throw new ServiceError('unsupported', 'Select an individual occurrence to remove. Whole-series removal is not supported yet.');
      const snapshot = await lookup(token, calendar.remoteId, href);
      if (!snapshot) throw new ServiceError('not-found', 'This event was removed elsewhere.');
      if (snapshot.etag !== target.revision) throw new ServiceError('conflict', 'This iCloud event changed elsewhere.');
      const { root, events } = icalResource(snapshot.ics);
      const event = selectIcalEvent(root, events, selected, true);
      if (!event) throw new ServiceError('not-found', 'This occurrence was removed elsewhere.');
      if (selected.slot) {
        event.component.updatePropertyWithValue('status', 'CANCELLED');
        await dav.resource(token, calendar.remoteId, href, 'PUT', changesTo(root, event, {}), target.revision);
      } else await dav.resource(token, calendar.remoteId, href, 'DELETE', undefined, target.revision);
    },
  };
}
