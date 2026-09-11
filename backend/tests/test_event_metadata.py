from datetime import datetime, timedelta
import pytest
from sqlalchemy import inspect, event as sql_event
from icalendar import Event as IEvent
from weekaboo import storage
from weekaboo.models import Calendar, Event
from weekaboo.integrations.providers.google import _to_remote, _to_body
from weekaboo.integrations.providers.icloud import ICloudProvider
from weekaboo.integrations.sync_engine import _apply_remote_event
from weekaboo.integrations.recurrence import materialise
from weekaboo.serializers import event_out


def test_google_links_attendees_survive_storage_and_are_not_written_back(client, db, writable_calendar):
    payload = {'id': 'g1', 'summary': 'Meet', 'start': {'dateTime': '2026-09-09T09:00:00Z'}, 'end': {'dateTime': '2026-09-09T10:00:00Z'}, 'conferenceData': {'entryPoints': [{'entryPointType': 'video', 'uri': 'https://meet.google.com/abc-defg-hij'}]}, 'htmlLink': 'https://calendar.google.com/event?eid=abc', 'attendees': [{'email': 'guest@example.test', 'displayName': 'Guest', 'responseStatus': 'accepted'}]}
    remote = _to_remote(payload)
    cal = db.get(Calendar, writable_calendar['id'])
    _apply_remote_event(db, cal, remote); db.commit()
    row = db.query(Event).filter_by(remote_id='g1').one()
    out = event_out(row)
    assert out.meeting_url == payload['conferenceData']['entryPoints'][0]['uri']
    assert out.attendees[0].status == 'accepted'
    assert out.source_url == payload['htmlLink']
    assert not {'attendees', 'conferenceData', 'hangoutLink', 'htmlLink'} & _to_body(remote).keys()
    remote.attendees[0]['status'] = 'declined'; remote.meeting_url = None
    _apply_remote_event(db, cal, remote); db.commit()
    assert row.meeting_url is None and row.attendees[0]['status'] == 'declined'


def test_icloud_attendees_url_and_recurring_preview(client, db, writable_calendar):
    component = IEvent.from_ical(b'BEGIN:VEVENT\r\nUID:test\r\nSUMMARY:Call\r\nDTSTART:20260909T090000Z\r\nDTEND:20260909T093000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nURL:https://zoom.us/j/123\r\nORGANIZER:mailto:host@example.test\r\nATTENDEE;CN=Host;PARTSTAT=ACCEPTED:mailto:host@example.test\r\nATTENDEE;CN=Guest;PARTSTAT=DECLINED:mailto:guest@example.test\r\nEND:VEVENT\r\n')
    remote = ICloudProvider(None, '/')._from_vevent(component, 'ical1', 'etag')
    assert [a['status'] for a in remote.attendees] == ['accepted', 'declined']
    assert remote.attendees[0]['organizer']
    cal = db.get(Calendar, writable_calendar['id'])
    _apply_remote_event(db, cal, remote); db.commit()
    row = db.query(Event).filter_by(remote_id='ical1').one()
    occurrence = materialise(row, datetime(2026, 9, 10), datetime(2026, 9, 11))[0]
    assert event_out(occurrence).source_url == 'https://zoom.us/j/123'
    assert len(event_out(occurrence).attendees) == 2


def old_schema(db, cal):
    cal.sync_token = 'old-token'
    row = Event(calendar_id=cal.id, title='Pending task', start_at=datetime(2026,9,9), end_at=datetime(2026,9,9,1), sync_state='pending_update')
    db.add(row); db.commit(); event_id = row.id; db.close()
    with storage.engine.begin() as connection:
        for name in ('meeting_url', 'source_url', 'attendees'):
            connection.exec_driver_sql(f'ALTER TABLE events DROP COLUMN {name}')
    return event_id


def test_metadata_migration_preserves_rows_and_resets_cursors_only_once(client, db, writable_calendar):
    cal = db.get(Calendar, writable_calendar['id']); event_id = old_schema(db, cal)
    storage.initialize()
    with storage.SessionLocal() as session:
        row = session.get(Event, event_id); cal = session.get(Calendar, cal.id)
        assert row.title == 'Pending task' and row.sync_state == 'pending_update'
        assert row.meeting_url is None and row.attendees is None and cal.sync_token is None
        cal.sync_token = 'new-token'; session.commit()
    storage.initialize()
    with storage.SessionLocal() as session:
        assert session.get(Calendar, cal.id).sync_token == 'new-token'


def test_metadata_migration_rolls_back_all_columns_on_failure(client, db, writable_calendar):
    old_schema(db, db.get(Calendar, writable_calendar['id']))
    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement == 'ALTER TABLE events ADD COLUMN attendees TEXT':
            raise RuntimeError('Injected migration failure')
    sql_event.listen(storage.engine, 'before_cursor_execute', fail)
    try:
        with pytest.raises(RuntimeError, match='Injected'):
            storage.initialize()
    finally:
        sql_event.remove(storage.engine, 'before_cursor_execute', fail)
    assert not {'meeting_url', 'source_url', 'attendees'} & {c['name'] for c in inspect(storage.engine).get_columns('events')}
    storage.initialize()


def test_google_transport_escapes_calendar_and_event_path_identifiers():
    import httpx
    from weekaboo.integrations.google_api import GoogleCalendarClient
    paths = []
    def respond(request):
        paths.append(request.url.raw_path.split(b"?")[0])
        return httpx.Response(200, json={"items": [], "id": "test"})
    provider = GoogleCalendarClient("test-token", http=httpx.Client(transport=httpx.MockTransport(respond)))
    provider.list_events("en.jewish#holiday@group.v.calendar.google.com")
    provider.get_event("a/b@example.test", "event/with?reserved#chars")
    assert paths == [b"/calendar/v3/calendars/en.jewish%23holiday%40group.v.calendar.google.com/events", b"/calendar/v3/calendars/a%2Fb%40example.test/events/event%2Fwith%3Freserved%23chars"]
