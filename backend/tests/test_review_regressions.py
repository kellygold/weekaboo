from datetime import datetime, timedelta, UTC
import httpx
from weekaboo.integrations import sync_engine, google_oauth
from weekaboo.integrations.providers.base import RemoteEvent, SyncTokenExpired
from weekaboo.models import Calendar, Event
from test_weekaboo import start_google


def test_full_resync_removes_pushed_local_ghosts_and_preserves_existing_ids(client, db, writable_calendar, monkeypatch):
    cal = db.get(Calendar, writable_calendar['id'])
    now = datetime.now(UTC).replace(tzinfo=None)
    for rid, origin in [('gone','local'),('kept','google'),('pending','local')]:
        db.add(Event(calendar_id=cal.id, remote_id=rid, title=rid, start_at=now, end_at=now+timedelta(hours=1), origin=origin, sync_state='pending_update' if rid=='pending' else 'synced'))
    cal.sync_token = 'expired'
    db.commit()
    kept_id = db.query(Event).filter_by(remote_id='kept').one().id
    class Provider:
        def list_events(self, *args, sync_token=None, **kwargs):
            if sync_token:
                raise SyncTokenExpired(410, 'Expired')
            return [RemoteEvent(id='kept', title='Fresh', start=now, end=now+timedelta(hours=1))], 'new'
    monkeypatch.setattr(sync_engine, 'provider_factory', lambda *_: Provider())
    sync_engine.pull_calendar(db, cal)
    db.expire_all()
    rows = {e.remote_id:e for e in db.query(Event)}
    assert set(rows) == {'kept','pending'}
    assert rows['kept'].id == kept_id and rows['kept'].title == 'Fresh'
    assert rows['pending'].sync_state == 'pending_update'


def test_google_transport_error_returns_to_setup(client, monkeypatch):
    state = start_google(client, monkeypatch)
    def timeout(*args):
        raise httpx.ReadTimeout('Network unavailable')
    monkeypatch.setattr(google_oauth, 'exchange_code', timeout)
    result = client.get('/api/accounts/google/callback', params={'state':state,'code':'code'}, follow_redirects=False)
    assert result.status_code == 307
    assert 'error=google_connection' in result.headers['location']
