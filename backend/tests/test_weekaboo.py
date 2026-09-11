from urllib.parse import parse_qs, urlparse
from datetime import timedelta
from sqlalchemy import inspect, select
from weekaboo.config import get_settings
from weekaboo.models import Account, Calendar, OAuthAttempt, utcnow
from weekaboo.storage import engine
from weekaboo.integrations import google_oauth, sync_engine, icloud_auth
from weekaboo.integrations.providers.base import ProviderAuthError


def configure(monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_id", "test-client")
    monkeypatch.setattr(get_settings(), "google_client_secret", "test-secret")


def start_google(client, monkeypatch):
    configure(monkeypatch)
    url = client.post("/api/accounts/google/auth-url").json()["url"]
    path = urlparse(url).path + "?" + urlparse(url).query
    response = client.get(path, follow_redirects=False)
    state = parse_qs(urlparse(response.headers["location"]).query)["state"][0]
    return state


def test_empty_install_has_no_seed_calendars_or_household_routes(client):
    assert client.get("/api/calendars").json() == []
    assert client.get("/api/accounts").json() == []
    assert set(inspect(engine).get_table_names()) == {"accounts", "calendars", "events", "oauth_attempts"}
    for path in ["users", "dashboard", "widgets", "lists", "feeds", "settings"]:
        assert client.get(f"/api/{path}").status_code == 404


def test_hostile_websites_cannot_mutate_or_read_accounts(client):
    for method, path in [("GET", "/api/accounts"), ("POST", "/api/accounts/google/auth-url"), ("DELETE", "/api/accounts/1")]:
        assert client.request(method, path, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.get("/api/accounts", headers={"Host": "evil.example"}).status_code == 400


def test_password_not_reflected_in_validation_error(client):
    password = "SECRET_SENTINEL" * 20
    response = client.post("/api/accounts/icloud", json={"apple_id": "", "app_password": password})
    assert response.status_code == 422
    assert "SECRET_SENTINEL" not in response.text


def test_bad_apple_password_does_not_leave_account(client, monkeypatch):
    def reject(*args):
        raise ProviderAuthError("No")
    monkeypatch.setattr(icloud_auth, "verify_and_store", reject)
    assert client.post("/api/accounts/icloud", json={"apple_id": "test@example.com", "app_password": "wrong"}).status_code == 400
    assert client.get("/api/accounts").json() == []


def test_google_state_requires_same_browser_and_is_single_use(client, monkeypatch):
    state = start_google(client, monkeypatch)
    cookie = client.cookies.get("weekaboo_oauth")
    client.cookies.clear()
    assert client.get("/api/accounts/google/callback", params={"state": state, "error": "access_denied"}).status_code == 400
    client.cookies.set("weekaboo_oauth", cookie)
    response = client.get("/api/accounts/google/callback", params={"state": state, "error": "access_denied"}, follow_redirects=False)
    assert response.status_code == 307
    assert "accounts=1&error=google_cancelled" in response.headers["location"]
    assert client.get("/api/accounts/google/callback", params={"state": state, "code": "x"}).status_code == 400


def test_google_success_returns_to_our_setup_without_claiming(client, monkeypatch):
    state = start_google(client, monkeypatch)
    monkeypatch.setattr(google_oauth, "exchange_code", lambda *_: {"access_token": "private-token", "refresh_token": "private-refresh", "scope": google_oauth.CALENDAR_SCOPE})
    monkeypatch.setattr(google_oauth, "fetch_email", lambda *_: "test@example.com")
    monkeypatch.setattr(sync_engine, "discover_calendars", lambda *_: [])
    response = client.get("/api/accounts/google/callback", params={"state": state, "code": "code"}, follow_redirects=False)
    assert response.headers["location"] == "http://127.0.0.1:5188/?accounts=1&connected=google"
    accounts = client.get("/api/accounts")
    assert accounts.json()[0]["email"] == "test@example.com"
    assert "private-token" not in accounts.text and "refresh" not in accounts.text
    assert "user_id" not in accounts.text


def test_expired_google_attempt_cannot_be_started(client, db, monkeypatch):
    configure(monkeypatch)
    url = client.post("/api/accounts/google/auth-url").json()["url"]
    attempt = db.scalar(select(OAuthAttempt))
    attempt.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get(urlparse(url).path + "?" + urlparse(url).query).status_code == 400


def test_disable_calendar_stops_display_and_rejects_new_edits(client, writable_calendar):
    cid = writable_calendar["id"]
    event = dict(calendar_id=cid, title="Test", start_at="2026-09-09T00:00:00Z", end_at="2026-09-09T01:00:00Z")
    eid = client.post("/api/events", json=event).json()["id"]
    assert client.patch(f"/api/calendars/{cid}", json={"sync_enabled": False}).status_code == 200
    assert client.get("/api/events", params={"start": "2026-09-09T00:00:00Z", "end": "2026-09-10T00:00:00Z"}).json() == []
    assert client.patch(f"/api/events/{eid}", json={"title": "Don't queue"}).status_code == 409
    assert client.post("/api/events", json=event).status_code == 409
    assert client.patch(f"/api/calendars/{cid}", json={"sync_enabled": True}).status_code == 200
    assert len(client.get("/api/events", params={"start": "2026-09-09T00:00:00Z", "end": "2026-09-10T00:00:00Z"}).json()) == 1


def test_disconnect_only_removes_local_cache(client, writable_calendar, db, monkeypatch):
    cal = db.get(Calendar, writable_calendar["id"])
    monkeypatch.setattr(google_oauth, "revoke", lambda *_: (_ for _ in ()).throw(AssertionError("Must not revoke shared grant")))
    assert client.delete(f"/api/accounts/{cal.account_id}").status_code == 204
    assert client.get("/api/calendars").json() == []


def test_invalid_event_patch_does_not_corrupt_stored_event(client, writable_calendar):
    eid = client.post("/api/events", json=dict(calendar_id=writable_calendar["id"], title="Keep", start_at="2026-09-09T00:00:00Z", end_at="2026-09-09T01:00:00Z")).json()["id"]
    for payload in [{"title": None}, {"start_at": None}, {"all_day": None}, {"end_at": "2026-09-08T00:00:00Z"}]:
        assert client.patch(f"/api/events/{eid}", json=payload).status_code in (400, 422)
    assert client.get(f"/api/events/{eid}").json()["title"] == "Keep"
