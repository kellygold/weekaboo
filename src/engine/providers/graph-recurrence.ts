import { ServiceError } from '../../services/errors';
const days: Record<string, string> = { MO: 'monday', TU: 'tuesday', WE: 'wednesday', TH: 'thursday', FR: 'friday', SA: 'saturday', SU: 'sunday' };
export function zonedClock(value: string, zone: string, allDay: boolean) {
  const instant = new Date(value);
  if (!Number.isFinite(+instant)) throw new ServiceError('validation', 'Choose a valid event date.');
  try {
    if (allDay) return value.slice(0, 10) + 'T00:00:00';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  } catch { throw new ServiceError('unsupported', 'This event timezone is not supported.'); }
}
export function graphRecurrence(rule: string | null, start: string, zone: string, allDay: boolean) {
  if (!rule) return null;
  try {
    const pairs = rule.replace(/^RRULE:/, '').split(';').map(part => part.split('='));
    const parts: Record<string, string> = Object.fromEntries(pairs);
    if (pairs.some(pair => pair.length !== 2) || pairs.length !== Object.keys(parts).length || Object.keys(parts).some(key => !['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST'].includes(key)) || parts.COUNT && parts.UNTIL) throw new Error();
    const date = zonedClock(start, zone, allDay).slice(0, 10), anchor = new Date(date + 'T12:00:00Z');
    const integer = (value: string, max: number) => { const n = Number(value); if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(); return n; };
    const pattern: Record<string, unknown> = { interval: integer(parts.INTERVAL || '1', 999) };
    if (parts.FREQ === 'DAILY') { if (parts.BYDAY || parts.BYMONTHDAY || parts.BYMONTH) throw new Error(); pattern.type = 'daily'; }
    else if (parts.FREQ === 'WEEKLY') {
      if (parts.BYMONTHDAY || parts.BYMONTH) throw new Error();
      const selected = (parts.BYDAY || ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][anchor.getUTCDay()]).split(',');
      if (selected.some(day => !days[day]) || !days[parts.WKST || 'MO']) throw new Error();
      Object.assign(pattern, { type: 'weekly', daysOfWeek: selected.map(day => days[day]), firstDayOfWeek: days[parts.WKST || 'MO'] });
    } else if (parts.FREQ === 'MONTHLY' || parts.FREQ === 'YEARLY') {
      if (parts.BYDAY || parts.FREQ === 'MONTHLY' && parts.BYMONTH) throw new Error();
      Object.assign(pattern, { type: parts.FREQ === 'MONTHLY' ? 'absoluteMonthly' : 'absoluteYearly', dayOfMonth: integer(parts.BYMONTHDAY || String(anchor.getUTCDate()), 31) });
      if (parts.FREQ === 'YEARLY') pattern.month = integer(parts.BYMONTH || String(anchor.getUTCMonth() + 1), 12);
    } else throw new Error();
    const range: Record<string, unknown> = { type: 'noEnd', startDate: date, recurrenceTimeZone: zone };
    if (parts.COUNT) Object.assign(range, { type: 'numbered', numberOfOccurrences: integer(parts.COUNT, 999999) });
    else if (parts.UNTIL) {
      const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(parts.UNTIL);
      if (!match) throw new Error();
      let until = `${match[1]}-${match[2]}-${match[3]}`;
      if (match[7]) until = zonedClock(`${until}T${match[4]}:${match[5]}:${match[6]}Z`, zone, false).slice(0, 10);
      if (!Number.isFinite(Date.parse(until)) || until < date) throw new Error();
      Object.assign(range, { type: 'endDate', endDate: until });
    }
    return { pattern, range };
  } catch { throw new ServiceError('unsupported', 'This repeat pattern cannot be represented in Outlook. Use daily, weekly, monthly or yearly repeats.'); }
}
