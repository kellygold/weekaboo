"""Regressions from real provider matrix: zoned recurrence and stale writes."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest
from icalendar import Calendar as ICalendar

from weekaboo.integrations import recurrence
from weekaboo.integrations.google_api import GoogleCalendarClient
from weekaboo.integrations.providers.google import GoogleProvider, _to_body
from weekaboo.integrations.providers.icloud import ICloudProvider, _build_vcalendar
from weekaboo.integrations.providers.base import RemoteEvent, ProviderError
from weekaboo.integrations.caldav_client import CalDavClient
from weekaboo.models import Event
from fake_caldav import FakeCalDav, CALENDAR, PARTITION_HOST


def weekly(start='2026-09-27T23:00:00', rule='FREQ=WEEKLY;BYDAY=MO;COUNT=3'):
    start = datetime.fromisoformat(start)
    return RemoteEvent(id='test.ics', title='9am weekly', start=start,
                       end=start + timedelta(minutes=30), timezone='Australia/Sydney', recurrence_rule=rule)


def local(remote):
    return Event(id=1, calendar_id=1, title=remote.title, start_at=remote.start,
                 end_at=remote.end, timezone=remote.timezone, all_day=remote.all_day,
                 recurrence_rule=remote.recurrence_rule)


@pytest.mark.parametrize('start,dates', [
    ('2026-09-27T23:00:00', ['2026-09-28 09:00', '2026-10-05 09:00', '2026-10-12 09:00']),
    ('2026-03-29T22:00:00', ['2026-03-30 09:00', '2026-04-06 09:00', '2026-04-13 09:00']),
])
def test_local_weekly_wall_time_and_series_end_across_both_dst_changes(start, dates):
    ev = local(weekly(start))
    found = recurrence.occurrences(ev, ev.start_at - timedelta(days=1), ev.start_at + timedelta(days=30))
    assert [d.replace(tzinfo=UTC).astimezone(ZoneInfo(ev.timezone)).strftime('%Y-%m-%d %H:%M') for d in found] == dates
    assert recurrence.series_end(ev.recurrence_rule, ev.start_at, ev.end_at-ev.start_at,
                                 ev.timezone, ev.all_day) == found[-1] + timedelta(minutes=30)
    ev.exdates = found[1].isoformat()
    assert recurrence.occurrences(ev, ev.start_at-timedelta(days=1), ev.start_at+timedelta(days=30)) == [found[0], found[2]]


def test_until_utc_cutoff_does_not_remove_the_last_local_occurrence():
    ev = local(weekly(rule='FREQ=WEEKLY;BYDAY=MO;UNTIL=20261011T220000'))
    found = recurrence.occurrences(ev, datetime(2026,9,1), datetime(2026,11,1))
    assert found == [datetime(2026,9,27,23), datetime(2026,10,4,22), datetime(2026,10,11,22)]


def test_icloud_writes_tzid_and_zone_definition_and_roundtrips_expansion():
    ev = weekly()
    text = _build_vcalendar(ev, 'test')
    assert 'DTSTART;TZID=Australia/Sydney:20260928T090000' in text
    assert 'BEGIN:VTIMEZONE' in text
    p = ICloudProvider(CalDavClient('test','test'), 'https://caldav.icloud.com/', 'UTC')
    parsed = p._parse('test.ics', 'v1', text)[0]
    assert parsed.timezone == 'Australia/Sydney'
    assert parsed.start == ev.start
    assert recurrence.occurrences(local(parsed), datetime(2026,9,1), datetime(2026,11,1))[-1] == datetime(2026,10,11,22)


def test_google_zoned_recurrence_and_until_payload():
    body = _to_body(weekly(rule='FREQ=WEEKLY;UNTIL=20261011T220000'))
    assert body['start']['timeZone'] == body['end']['timeZone'] == 'Australia/Sydney'
    assert body['start']['dateTime'] == '2026-09-27T23:00:00Z'
    assert body['recurrence'] == ['RRULE:FREQ=WEEKLY;UNTIL=20261011T220000Z']
    assert _to_body(replace(weekly(),timezone=None))['start']['timeZone'] == 'UTC'
    all_day = _to_body(replace(weekly(),all_day=True))
    assert 'timeZone' not in all_day['start']


@pytest.mark.parametrize('method', ['PATCH','DELETE'])
def test_google_transport_sends_conditional_revision_and_surfaces_conflict(method):
    requests=[]
    def handle(req):
        requests.append(req)
        return httpx.Response(412, text='revision changed')
    c = GoogleCalendarClient('test-token', http=httpx.Client(transport=httpx.MockTransport(handle)))
    with pytest.raises(ProviderError) as err:
        if method=='PATCH': c.patch_event('calendar','event',{},etag='"v1"')
        else: c.delete_event('calendar','event',etag='"v1"')
    assert err.value.status == 412
    assert len(requests)==1
    assert requests[0].headers['If-Match']=='"v1"'
    assert requests[0].headers['Authorization']=='Bearer test-token'


def test_google_rejects_newer_remote_snapshot_before_patch():
    requests=[]
    def handle(req):
        requests.append(req)
        return httpx.Response(200,json={'id':'event','etag':'"v2"','updated':'2026-09-10T12:00:00Z'})
    p=GoogleProvider(client=GoogleCalendarClient('test',http=httpx.Client(transport=httpx.MockTransport(handle))))
    with pytest.raises(ProviderError) as err:
        p.update_event('calendar',replace(weekly(),etag='"v1"',updated=datetime(2026,9,10,11)))
    assert err.value.status==412
    assert [r.method for r in requests]==['GET']


def test_icloud_rejects_stale_snapshot_even_when_last_modified_has_same_second():
    server=FakeCalDav()
    original=_build_vcalendar(weekly(), 'test')
    server.add_event('test.ics', original, etag='"v1"')
    p=ICloudProvider(CalDavClient('test','test',http=server.client()),f'{PARTITION_HOST}/1234567890/calendars/','UTC')
    stale=p._parse('test.ics','"v1"',original)[0]
    tree=ICalendar.from_ical(original)
    tree.walk('VEVENT')[0].add('location','Remote location')
    server.add_event('test.ics',tree.to_ical().decode(),etag='"v2"')
    with pytest.raises(ProviderError) as err:
        p.update_event(CALENDAR,replace(stale,title='Stale title'))
    assert err.value.status==412
    assert not server.puts
    assert 'Remote location' in server.resources[CALENDAR+'test.ics'][1]
