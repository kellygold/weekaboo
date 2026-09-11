"""Independent audit probes; disposable checkout only, no real providers."""
import pytest
from app.models import Event
from app.services import sync_engine
from fake_google import gevent
from test_google_sync import fake, gcal

@pytest.mark.parametrize('operation', ['edit', 'delete'])
def test_expired_cursor_must_preserve_pending_change_to_imported_event(client, db, fake, gcal, operation):
    remote = gevent('g-audit', 'Original appointment', '2026-09-10T01:00:00Z', '2026-09-10T02:00:00Z')
    fake.pages = [([remote], 'cursor1')]
    sync_engine.pull_calendar(db, gcal)
    ev = db.query(Event).filter(Event.google_event_id == 'g-audit').one()
    if operation == 'edit':
        response = client.patch(f'/api/events/{ev.id}', json={'title': 'Locally edited appointment'})
    else:
        response = client.delete(f'/api/events/{ev.id}')
    assert response.status_code in (200, 204), response.text
    db.expire_all()
    pending = db.query(Event).filter(Event.google_event_id == 'g-audit').one()
    assert pending.sync_state != 'synced'
    before = (pending.title, pending.status, pending.sync_state)
    fake.expire_next_sync_token = True
    fake.pages = [([remote], 'cursor2')]
    sync_engine.pull_calendar(db, gcal)
    db.expire_all()
    after = db.query(Event).filter(Event.google_event_id == 'g-audit').one()
    assert (after.title, after.status, after.sync_state) == before


def test_arbitrary_origin_must_not_be_granted_calendar_api_access(client):
    origin = 'https://untrusted.example'
    response = client.options('/api/events/1', headers={
        'Origin': origin,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.headers.get('access-control-allow-origin') not in ('*', origin)
