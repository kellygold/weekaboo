import ICAL from 'ical.js';
import data from '../data/vtimezones.json' with { type: 'json' };
import { ServiceError } from '../../services/errors';

/** Resource-scoped definitions; never mutate ICAL's global timezone registry. */
export function attachTimezone(root: ICAL.Component, name: string): ICAL.Timezone {
  const aliases: Record<string, string> = data.aliases;
  const zones: Record<string, string> = data.zones;
  const id = Object.hasOwn(aliases, name) ? aliases[name] : name;
  if (!Object.hasOwn(zones, id)) throw new ServiceError('unsupported', 'This timezone is not included in the app. Your draft has been kept.');
  if (id === 'Etc/UTC') return ICAL.Timezone.utcTimezone;
  const existing = root.getTimeZoneByID(id);
  if (existing) return existing;
  const source = new ICAL.Component(ICAL.parse(zones[id]));
  const component = source.getFirstSubcomponent('vtimezone')!;
  source.removeSubcomponent(component); root.addSubcomponent(component);
  const zone = root.getTimeZoneByID(id);
  if (!zone) throw new ServiceError('unavailable', 'The timezone definition could not be loaded.');
  return zone;
}

/** Editor-supported patterns. Reject unsupported/invalid parts before any PUT. */
export function newIcalRecurrence(value: string, start: ICAL.Time): ICAL.Recur {
  try {
    const pairs = value.replace(/^RRULE:/, '').split(';').map(part => part.split('='));
    const parts = Object.fromEntries(pairs);
    if (pairs.some(pair => pair.length !== 2 || !pair[1]) || pairs.length !== Object.keys(parts).length ||
      Object.keys(parts).some(key => !['FREQ', 'INTERVAL', 'COUNT', 'UNTIL'].includes(key)) ||
      !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(parts.FREQ) || parts.COUNT && parts.UNTIL) throw new Error();
    for (const key of ['INTERVAL', 'COUNT']) if (parts[key] && (!/^[1-9]\d{0,5}$/.test(parts[key]) || Number(parts[key]) > 999999)) throw new Error();
    if (parts.UNTIL) {
      // Timed DTSTART in a named zone requires UTC UNTIL (RFC 5545 3.3.10).
      if (!(start.isDate ? /^\d{8}$/ : /^\d{8}T\d{6}Z$/).test(parts.UNTIL)) throw new Error();
      const until = ICAL.Time.fromString(ICAL.design.icalendar.value[start.isDate ? 'date' : 'date-time'].fromICAL(parts.UNTIL), undefined);
      if (until.toICALString() !== parts.UNTIL || until.compare(start) < 0) throw new Error();
    }
    return ICAL.Recur.fromString(Object.entries(parts).map(([key, part]) => `${key}=${part}`).join(';'));
  } catch { throw new ServiceError('validation', 'Choose a valid daily, weekly, monthly or yearly repeat. Your draft has been kept.'); }
}
