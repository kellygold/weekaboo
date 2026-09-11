import { test, expect } from '@playwright/test';
import { expandCalendarResource } from '../src/engine/providers/ical';
const timezone = `BEGIN:VTIMEZONE
TZID:Australia/Sydney
BEGIN:STANDARD
DTSTART:20200405T030000
TZOFFSETFROM:+1100
TZOFFSETTO:+1000
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20201004T020000
TZOFFSETFROM:+1000
TZOFFSETTO:+1100
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU
END:DAYLIGHT
END:VTIMEZONE`;
const calendar = (events: string, zones = timezone) => `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Weekaboo Test//EN\n${zones}\n${events}\nEND:VCALENDAR`.replaceAll('\n', '\r\n');
const parse = (ics: string, start = '2026-09-20', end = '2026-10-20') => expandCalendarResource({ calendarId: 'c', href: '/c/series.ics', etag: 'v1', ics, range: { start: new Date(start), end: new Date(end) } });
const master = `BEGIN:VEVENT
UID:weekly
DTSTART;TZID=Australia/Sydney:20260928T090000
DTEND;TZID=Australia/Sydney:20260928T100000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Monday
END:VEVENT`;
test('iCalendar weekly recurrence retains local 9am across spring DST', () => {
  const events = parse(calendar(master));
  expect(events.map(e => e.start)).toEqual(['2026-09-27T23:00:00.000Z', '2026-10-04T22:00:00.000Z', '2026-10-11T22:00:00.000Z']);
});
test('iCalendar weekly recurrence retains local 9am across autumn DST', () => {
  const input = master.replaceAll('20260928', '20260330');
  const events = parse(calendar(input), '2026-03-25', '2026-04-20');
  expect(events.map(e => e.start)).toEqual(['2026-03-29T22:00:00.000Z', '2026-04-05T23:00:00.000Z', '2026-04-12T23:00:00.000Z']);
});
test('moved and cancelled exceptions do not duplicate the original slots', () => {
  const moved = `BEGIN:VEVENT
UID:weekly
RECURRENCE-ID;TZID=Australia/Sydney:20261005T090000
DTSTART;TZID=Australia/Sydney:20261006T110000
DTEND;TZID=Australia/Sydney:20261006T120000
SUMMARY:Moved
END:VEVENT`;
  const cancelled = `BEGIN:VEVENT
UID:weekly
RECURRENCE-ID;TZID=Australia/Sydney:20261012T090000
DTSTART;TZID=Australia/Sydney:20261012T090000
DTEND;TZID=Australia/Sydney:20261012T100000
STATUS:CANCELLED
END:VEVENT`;
  const events = parse(calendar([master, moved, cancelled].join('\n')));
  expect(events.map(e => e.title)).toEqual(['Monday', 'Moved']);
  expect(events[1].start).toBe('2026-10-06T00:00:00.000Z');
  expect(events[1].id).toContain(encodeURIComponent('2026-10-04T22:00:00.000Z'));
});
test('moved-in orphan retains its original identity and exclusive all-day dates', () => {
  const input = `BEGIN:VEVENT
UID:orphan
RECURRENCE-ID;VALUE=DATE:20260101
DTSTART;VALUE=DATE:20261004
DTEND;VALUE=DATE:20261006
SUMMARY:Two days
END:VEVENT`;
  expect(parse(calendar(input, ''))[0]).toMatchObject({ start: '2026-10-04', end: '2026-10-06', allDay: true, recurring: true });
});
test('missing timezone definition fails explicitly instead of silently floating', () => {
  expect(() => parse(calendar(master, ''))).toThrow('timezone definition');
});
test('EXDATE suppresses an excluded occurrence', () => {
  const input = master.replace('SUMMARY:Monday', 'EXDATE;TZID=Australia/Sydney:20261005T090000\nSUMMARY:Monday');
  expect(parse(calendar(input))).toHaveLength(2);
});

test('CalDAV rejects credential redirects outside Apple and XML entities before discovery', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const { ICloudCalDav } = await import('/src/engine/providers/caldav.ts');
    const sent: string[] = [];
    const outside = new ICloudCalDav({ async request(input: { url: string }) { sent.push(input.url); return { status: 302, headers: { location: 'https://attacker.example/' }, body: '' }; } });
    const denied = await outside.discover('Basic synthetic').then(() => false, () => true);
    const xml = new ICloudCalDav({ async request() { return { status: 207, headers: {}, body: '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>' }; } });
    const entities = await xml.discover('Basic synthetic').then(() => false, () => true);
    return { sent, denied, entities };
  });
  expect(result).toEqual({ sent: ['https://caldav.icloud.com/'], denied: true, entities: true });
});
test('CalDAV namespace-independent discovery follows safe Apple partitions and excludes task collections', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const { ICloudCalDav } = await import('/src/engine/providers/caldav.ts');
    const wrap = (href: string, props: string) => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    let call = 0; const sent: string[] = [];
    const replies = [
      { status: 307, headers: { location: 'https://p47-caldav.icloud.com/' }, body: '' },
      { status: 207, headers: {}, body: wrap('/', '<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>') },
      { status: 207, headers: {}, body: wrap('/123/principal/', '<c:calendar-home-set><d:href>/123/calendars/</d:href></c:calendar-home-set>') },
      { status: 207, headers: {}, body: wrap('/123/calendars/home/', '<d:displayname>Home</d:displayname><d:resourcetype><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>') },
      { status: 207, headers: {}, body: wrap('/123/calendars/tasks/', '<d:resourcetype><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>') },
    ];
    const dav = new ICloudCalDav({ async request(input: { url: string }) { sent.push(input.url); return replies[call++]; } });
    const user = await dav.discover('Basic synthetic');
    const calendars = await dav.calendars('Basic synthetic', user.home);
    const tasks = await dav.calendars('Basic synthetic', user.home);
    return { user, calendars, tasks, sent };
  });
  expect(result.user).toEqual({ subject: '/123/principal/', home: 'https://p47-caldav.icloud.com/123/calendars/' });
  expect(result.calendars[0].name).toBe('Home'); expect(result.tasks).toEqual([]);
  expect(result.sent).toHaveLength(5);
});

test('incomplete timezone history is rejected instead of assigning UTC', () => {
  const insufficient = timezone.replace('20200405', '20260405').replace('20201004', '20261004');
  expect(() => parse(calendar(master.replaceAll('20260928', '20260330'), insufficient), '2026-03-25', '2026-04-20')).toThrow('event history');
});

for (const recurrence of ['RECURRENCE-ID:20261004T220000Z', 'RECURRENCE-ID;TZID=Test/Fixed:20261005T000000']) {
  test(`override matches original instant across zone representations: ${recurrence}`, () => {
    const zone = `BEGIN:VTIMEZONE
TZID:Test/Fixed
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0200
TZOFFSETTO:+0200
END:STANDARD
END:VTIMEZONE`;
    const moved = `BEGIN:VEVENT
UID:weekly
${recurrence}
DTSTART;TZID=Australia/Sydney:20261006T110000
DTEND;TZID=Australia/Sydney:20261006T120000
SUMMARY:Moved
END:VEVENT`;
    const result = parse(calendar([master, moved].join('\n'), timezone + '\n' + zone));
    expect(result).toHaveLength(3);
    expect(result.filter(e => e.title === 'Moved')).toHaveLength(1);
    expect(result.some(e => e.start === '2026-10-04T22:00:00.000Z')).toBe(false);
    const cancelled = parse(calendar([master, moved.replace('SUMMARY:Moved', 'STATUS:CANCELLED')].join('\n'), timezone + '\n' + zone));
    expect(cancelled).toHaveLength(2);
  });
}
test('old recurrence anchor does not require offset history outside the requested window', () => {
  const old = master.replaceAll('20260928', '20070101').replace(';COUNT=3', '');
  const zones = timezone.replaceAll('2020', '2008');
  const result = parse(calendar(old, zones));
  expect(result).toHaveLength(5);
  expect(result.find(e => e.start === '2026-10-04T22:00:00.000Z')).toBeTruthy();
});
