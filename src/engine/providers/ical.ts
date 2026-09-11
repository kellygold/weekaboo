import ICAL from 'ical.js';
import type { CalendarEvent } from '../../domain';
import { ServiceError } from '../../services/errors';
import { icalSlot, occurrenceTarget, requireIcalCoverage } from './ical-target';
import { identity } from '../state';

/** Pure iCalendar parsing; timezone components remain scoped to their resource. */
export function expandCalendarResource(input: { calendarId: string; href: string; etag?: string; ics: string; range: { start: Date; end: Date } }): CalendarEvent[] {
  try {
    const root = new ICAL.Component(ICAL.parse(input.ics));
    if (root.name !== 'vcalendar') throw new Error();
    const components = root.getAllSubcomponents('vevent');
    // ICAL otherwise treats unknown TZIDs as floating, silently moving events.
    for (const component of components) {
      for (const property of component.getAllProperties()) {
        const tzid = property.getParameter('tzid');
        if (typeof tzid === 'string' && tzid !== 'UTC') {
          if (!root.getTimeZoneByID(tzid)) throw new ServiceError('unsupported', 'This calendar resource omits its timezone definition. It has not been shifted to the device timezone.');

        }
      }
    }
    const events = components.map(component => new ICAL.Event(component, { exceptions: [], strictExceptions: true }));
    const overrides = events.filter(event => event.isRecurrenceException());
    for (const event of overrides) if (event.modifiesFuture()) throw new ServiceError('unsupported', 'This recurring calendar uses a range exception that is not supported in this preview.');
    // Recurrence identity is an instant for zoned events, a civil value for dates
    // and floating events. Different RECURRENCE-ID zone spellings share one slot.
    const slot = icalSlot;
    const results = new Map<string, CalendarEvent>();
    function include(event: ICAL.Event, from: ICAL.Time, to: ICAL.Time, occurrence: ICAL.Time | undefined, recurring: boolean) {
      if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
      const start = from.toJSDate(), end = to.toJSDate();
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start) throw new Error();
      // Only rendered dates need offset history. A 2006 recurrence anchor must
      // not reject correctly defined occurrences in 2026. Include a boundary
      // margin while checking because an undefined offset could shift a date.
      if (+end >= +input.range.start - 172800000 && +start <= +input.range.end + 172800000) { requireIcalCoverage(root, from); requireIcalCoverage(root, to); }
      if ((end <= input.range.start && end > start) || start < input.range.start && end === start || start >= input.range.end) return;
      const original = occurrence ? slot(occurrence) : 'single';
      const id = identity(input.calendarId, event.uid, original);
      const organizer = String(event.component.getFirstPropertyValue('organizer') || '').replace(/^mailto:/i, '').toLowerCase();
      results.set(id, {
        id, commandId: identity(input.calendarId, occurrence ? occurrenceTarget(input.href, event.uid, original) : input.href), calendarId: input.calendarId,
        title: event.summary || '(no title)', start: from.isDate ? from.toString() : start.toISOString(), end: to.isDate ? to.toString() : end.toISOString(), allDay: from.isDate,
        revision: input.etag, location: event.location || undefined, description: event.description || undefined,
        sourceUrl: String(event.component.getFirstPropertyValue('url') || '') || undefined,
        recurring, editable: false, syncState: 'synced',
        attendees: event.attendees.map(guest => {
          const email = String(guest.getFirstValue()).replace(/^mailto:/i, '');
          const status = String(guest.getParameter('partstat') || '').toUpperCase();
          return { email, name: String(guest.getParameter('cn') || '') || undefined, status: ({ ACCEPTED: 'accepted', DECLINED: 'declined', TENTATIVE: 'tentative' } as Record<string, string>)[status] || 'needsAction', organizer: email.toLowerCase() === organizer };
        }),
      });
    }
    for (const event of events.filter(row => !row.isRecurrenceException())) {
      if (!event.uid || !event.startDate) throw new Error();
      const related = overrides.filter(other => other.uid === event.uid);
      const bySlot = new Map(related.map(exception => [slot(exception.recurrenceId), exception]));
      if (!event.isRecurring()) { include(event, event.startDate, event.endDate, undefined, false); continue; }
      const iterator = event.iterator();
      let count = 0;
      for (let next = iterator.next(); next; next = iterator.next()) {
        if (++count > 20000) throw new ServiceError('unavailable', 'This calendar series exceeds the preview expansion limit.');
        if (next.toJSDate() >= input.range.end) break;
        const override = bySlot.get(slot(next));
        if (override) include(override, override.startDate, override.endDate, next, true);
        else {
          const details = event.getOccurrenceDetails(next);
          include(details.item, details.startDate, details.endDate, next, true);
        }
      }
    }
    // Include orphan/moved-in overrides even if their original slot is outside the
    // requested window. The original recurrence ID also deduplicates moved slots.
    for (const event of overrides) include(event, event.startDate, event.endDate, event.recurrenceId, true);
    return [...results.values()];
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('unavailable', 'An iCalendar resource could not be read. Existing cached events were retained.');
  }
}
