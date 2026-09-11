import ICAL from 'ical.js';
import { ServiceError } from '../../services/errors';
/** Provider-owned opaque target: original slot stays fixed after an occurrence moves. */
export function occurrenceTarget(href: string, uid: string, slot: string) { return JSON.stringify({ v: 1, href, uid, slot }); }
export function decodeIcalTarget(value: string): { href: string; uid?: string; slot?: string } {
  if (!value.startsWith('{')) return { href: value };
  let data;
  try { data = JSON.parse(value); } catch { throw new ServiceError('validation', 'Invalid iCloud occurrence identity.'); }
  if (data?.v !== 1 || typeof data.href !== 'string' || typeof data.uid !== 'string' || !data.uid || typeof data.slot !== 'string' || !/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d{3}Z)?)?$/.test(data.slot)) throw new ServiceError('validation', 'Invalid iCloud occurrence identity.');
  return data;
}
export function icalSlot(time: ICAL.Time) { return time.isDate || time.zone.tzid === 'floating' ? time.toString() : time.toJSDate().toISOString(); }
export function requireIcalCoverage(root: ICAL.Component, time: ICAL.Time) {
  if (time.isDate) return;
  const definition = root.getAllSubcomponents('vtimezone').find(zone => zone.getFirstPropertyValue('tzid') === time.zone.tzid);
  const first = definition?.getAllSubcomponents().map(part => String(part.getFirstPropertyValue('dtstart') || '')).filter(Boolean).sort()[0];
  if (first && time.toString().slice(0, 19) < first.slice(0, 19)) throw new ServiceError('unsupported', 'This timezone definition does not cover the event history. The event has not been shifted.');
}
export function icalResource(ics: string) {
  try {
    const root = new ICAL.Component(ICAL.parse(ics));
    const components = root.getAllSubcomponents('vevent');
    if (root.name !== 'vcalendar' || !components.length) throw new Error();
    for (const component of components) for (const property of component.getAllProperties()) {
      const tzid = property.getParameter('tzid');
      if (typeof tzid === 'string' && tzid !== 'UTC' && !root.getTimeZoneByID(tzid)) throw new ServiceError('unsupported', 'The event timezone definition is missing.');
    }
    const events = components.map(component => new ICAL.Event(component, { exceptions: [], strictExceptions: true }));
    if (events.some(event => !event.uid || !event.startDate || event.modifiesFuture()) || new Set(events.map(event => event.uid)).size !== 1 || events.filter(event => !event.isRecurrenceException()).length > 1) throw new ServiceError('unsupported', 'This iCloud resource cannot be edited safely yet.');
    const slots = events.filter(event => event.isRecurrenceException()).map(event => icalSlot(event.recurrenceId));
    if (new Set(slots).size !== slots.length) throw new ServiceError('unsupported', 'This iCloud series has conflicting exceptions.');
    return { root, events };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('unavailable', 'The iCloud event could not be read safely.');
  }
}
/** Return the selected occurrence only; clone a master into a detached override for writes. */
export function selectIcalEvent(root: ICAL.Component, events: ICAL.Event[], target: ReturnType<typeof decodeIcalTarget>, detach = false): ICAL.Event | null {
  if (!target.slot) {
    if (events.length !== 1 || events[0].isRecurring() || events[0].isRecurrenceException()) throw new ServiceError('unsupported', 'Select an individual occurrence to edit this iCloud series.');
    return events[0].component.getFirstPropertyValue('status') === 'CANCELLED' ? null : events[0];
  }
  if (events[0].uid !== target.uid) throw new ServiceError('conflict', 'This iCloud resource now contains a different event.');
  const existing = events.find(event => event.isRecurrenceException() && icalSlot(event.recurrenceId) === target.slot);
  if (existing) { requireIcalCoverage(root, existing.startDate); requireIcalCoverage(root, existing.endDate); }
  if (existing) return existing.component.getFirstPropertyValue('status') === 'CANCELLED' ? null : existing;
  const master = events.find(event => !event.isRecurrenceException());
  if (!master?.isRecurring() || master.component.getFirstPropertyValue('status') === 'CANCELLED') return null;
  const iterator = master.iterator(); let count = 0;
  for (let next = iterator.next(); next; next = iterator.next()) {
    if (++count > 20000) throw new ServiceError('unsupported', 'This series exceeds the supported occurrence lookup limit.');
    const slot = icalSlot(next);
    if (slot > target.slot) return null;
    if (slot !== target.slot) continue;
    const details = master.getOccurrenceDetails(next);
    requireIcalCoverage(root, details.startDate); requireIcalCoverage(root, details.endDate);
    const component = new ICAL.Component(structuredClone(master.component.toJSON()));
    for (const name of ['rrule', 'rdate', 'exdate', 'exrule', 'recurrence-id']) component.removeAllProperties(name);
    // Attach before assigning dates so ICAL can resolve the resource's VTIMEZONE.
    root.addSubcomponent(component);
    const event = new ICAL.Event(component);
    event.recurrenceId = next.clone(); event.startDate = details.startDate.clone(); event.endDate = details.endDate.clone();
    component.removeAllProperties('duration');
    if (!detach) root.removeSubcomponent(component);
    return event;
  }
  return null;
}
