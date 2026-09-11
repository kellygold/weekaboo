from copy import deepcopy
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from sqlalchemy import select

from weekaboo.api import microsoft_accounts as routes
from weekaboo.integrations import microsoft_oauth as oauth
from weekaboo.integrations import sync_engine
from weekaboo.integrations.crypto import decrypt
from weekaboo.integrations.microsoft_api import BASE, MicrosoftCalendarClient, _backoff
from weekaboo.integrations.providers.base import (
    ProviderAuthError,
    ProviderError,
    RemoteEvent,
)
from weekaboo.integrations.providers.microsoft import (
    MicrosoftProvider,
    graph_recurrence,
    to_remote,
)
from weekaboo.models import Account, Calendar, Event, OAuthAttempt, utcnow


def raw_event(identity="opaque/event+=", **overrides):
    return {
        "id": identity,
        "@odata.etag": 'W/"v1"',
        "subject": "Outlook coffee",
        "start": {"dateTime": "2026-09-09T00:00:00", "timeZone": "UTC"},
        "end": {"dateTime": "2026-09-09T00:30:00", "timeZone": "UTC"},
        "originalStartTimeZone": "AUS Eastern Standard Time",
        "body": {"contentType": "html", "content": "<p>Keep my notes</p>"},
        "location": {"displayName": "Cafe"},
        "lastModifiedDateTime": "2026-09-08T12:00:00Z",
        "webLink": "https://outlook.live.com/calendar/item",
        "attendees": [
            {
                "emailAddress": {"address": "guest@example.test", "name": "Guest"},
                "status": {"response": "tentativelyAccepted"},
            }
        ],
        **overrides,
    }


class Graph:
    def __init__(self):
        self.rows = [raw_event(), raw_event("second")]
        self.calls = []
        self.fail = False
        self.remote = raw_event(
            categories=["Private"],
            isOnlineMeeting=True,
            onlineMeeting={"joinUrl": "https://teams.microsoft.com/meet/test"},
        )
        self.client = MicrosoftCalendarClient(
            "test-token", httpx.Client(transport=httpx.MockTransport(self.handle))
        )
        self.provider = MicrosoftProvider(client=self.client)

    def handle(self, r):
        import json

        self.calls.append(r)
        if r.method == "GET" and "calendarView" in r.url.path:
            if r.url.params.get("page") == "2":
                if self.fail:
                    return httpx.Response(503, json={"error": "private detail"})
                return httpx.Response(200, json={"value": deepcopy(self.rows[1:])})
            return httpx.Response(
                200,
                json={
                    "value": deepcopy(self.rows[:1]),
                    "@odata.nextLink": BASE + "/me/calendars/cal/calendarView?page=2",
                },
            )
        if r.method == "GET" and r.url.path.endswith("/calendars"):
            return httpx.Response(
                200,
                json={
                    "value": [
                        {"id": "cal/opaque+=", "name": "Work", "canEdit": True},
                        {"id": "shared", "name": "Shared", "canEdit": False},
                    ]
                },
            )
        if r.method == "GET":
            return httpx.Response(200, json=deepcopy(self.remote))
        if r.method in ("POST", "PATCH"):
            self.remote.update(json.loads(r.content))
            self.remote["@odata.etag"] = 'W/"v2"'
            return httpx.Response(
                201 if r.method == "POST" else 200, json=deepcopy(self.remote)
            )
        return httpx.Response(204)


@pytest.fixture
def graph(client, db, monkeypatch):
    g = Graph()
    account = Account(provider="microsoft", email="outlook@example.test")
    db.add(account)
    db.flush()
    g.calendar = Calendar(
        account_id=account.id,
        remote_id="cal/opaque+=",
        name="Outlook",
        sync_enabled=True,
        access_role="writer",
    )
    db.add(g.calendar)
    db.commit()
    monkeypatch.setattr(sync_engine, "provider_factory", lambda *_: g.provider)
    _backoff.clear()
    return g


def test_discovery_pagination_and_metadata(graph, db):
    assert [c.access_role for c in graph.provider.list_calendars()] == [
        "writer",
        "reader",
    ]
    assert sync_engine.pull_calendar(db, graph.calendar) == 2
    event = db.scalar(select(Event).where(Event.remote_id == "opaque/event+="))
    assert event.title == "Outlook coffee" and event.timezone == "Australia/Sydney"
    assert event.attendees[0]["status"] == "tentative"
    assert event.start_at == datetime(2026, 9, 9)
    assert "%2Fopaque%2B%3D" in str(graph.calls[1].url)
    assert "ImmutableId" in graph.calls[1].headers["Prefer"]


def test_all_day_preserves_original_civil_date():
    e = to_remote(
        raw_event(
            isAllDay=True,
            start={"dateTime": "2026-09-08T14:00:00", "timeZone": "UTC"},
            end={"dateTime": "2026-09-09T14:00:00", "timeZone": "UTC"},
        )
    )
    assert e.start == datetime(2026, 9, 9) and e.end == datetime(2026, 9, 10)


def test_snapshot_deletes_absent_but_keeps_pending_and_history(graph, db):
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event).where(Event.remote_id == "opaque/event+="))
    event.sync_state = "pending_update"
    event.title = "Local edit"
    db.add(
        Event(
            calendar_id=graph.calendar.id,
            remote_id="history",
            title="History",
            start_at=datetime(2020, 1, 1),
            end_at=datetime(2020, 1, 2),
        )
    )
    db.commit()
    graph.rows = []
    sync_engine.pull_calendar(db, graph.calendar)
    assert set(db.scalars(select(Event.remote_id))) == {"opaque/event+=", "history"}
    assert event.title == "Local edit"


@pytest.mark.parametrize("malformed", [False, True])
def test_failed_snapshot_never_erases_cache(graph, db, malformed):
    sync_engine.pull_calendar(db, graph.calendar)
    if malformed:
        graph.rows = [{"id": "bad"}]
    else:
        graph.rows = []
        graph.fail = True
    with pytest.raises(ProviderError):
        sync_engine.pull_calendar(db, graph.calendar)
    assert set(db.scalars(select(Event.remote_id))) == {"opaque/event+=", "second"}


def test_time_edit_preserves_remote_meeting_body_guests_categories(graph):
    e = to_remote(graph.remote)
    e.start += timedelta(hours=1)
    e.end += timedelta(hours=1)
    original = deepcopy(graph.remote)
    result = graph.provider.update_event("cal/opaque+=", e)
    assert result.start == datetime(2026, 9, 9, 1)
    for key in ["body", "attendees", "categories", "onlineMeeting"]:
        assert graph.remote[key] == original[key]
    patch = graph.calls[-1]
    assert patch.headers["If-Match"] == 'W/"v1"'
    assert "%2F" in str(patch.url)


def test_conflict_does_not_overwrite_remote(graph):
    e = to_remote(graph.remote)
    graph.remote["@odata.etag"] = 'W/"changed"'
    graph.remote["lastModifiedDateTime"] = "2026-09-09T12:00:00Z"
    with pytest.raises(ProviderError) as caught:
        graph.provider.update_event("cal", e)
    assert caught.value.status == 412
    assert [r.method for r in graph.calls] == ["GET"]


def test_create_retry_has_stable_transaction_and_delete(graph):
    e = to_remote(raw_event())
    e.operation_id = "local-operation"
    e.recurrence_rule = "FREQ=WEEKLY;COUNT=3"
    graph.provider.create_event("cal", e)
    first = graph.remote["transactionId"]
    graph.provider.create_event("cal", e)
    assert graph.remote["transactionId"] == first
    assert graph.remote["recurrence"]["pattern"]["daysOfWeek"] == ["wednesday"]
    graph.provider.delete_event("cal", e.id, e.etag)
    assert graph.calls[-1].method == "DELETE"


@pytest.mark.parametrize(
    "rule,kind",
    [
        ("FREQ=DAILY", "daily"),
        ("FREQ=WEEKLY;COUNT=3", "weekly"),
        ("FREQ=MONTHLY", "absoluteMonthly"),
        ("FREQ=YEARLY", "absoluteYearly"),
    ],
)
def test_recurrence_local_date(rule, kind):
    e = RemoteEvent(
        id="",
        start=datetime(2026, 9, 8, 23),
        end=datetime(2026, 9, 9),
        timezone="Australia/Sydney",
        recurrence_rule=rule,
    )
    value = graph_recurrence(e)
    assert (
        value["pattern"]["type"] == kind and value["range"]["startDate"] == "2026-09-09"
    )


@pytest.mark.parametrize(
    "rule",
    [
        "FREQ=MONTHLY;BYDAY=1MO",
        "FREQ=DAILY;BYDAY=MO",
        "FREQ=YEARLY;BYMONTH=13",
        "FREQ=WEEKLY;COUNT=0",
    ],
)
def test_unsupported_repeat_rejected(rule):
    with pytest.raises(ProviderError):
        graph_recurrence(
            RemoteEvent(id="", start=datetime(2026, 9, 9), recurrence_rule=rule)
        )


def test_pagination_cannot_leak_bearer():
    seen = []

    def handler(r):
        seen.append(r)
        return httpx.Response(
            200, json={"value": [], "@odata.nextLink": "https://attacker.test/v1.0/me"}
        )

    c = MicrosoftCalendarClient(
        "private", httpx.Client(transport=httpx.MockTransport(handler))
    )
    with pytest.raises(ProviderError):
        c.collection("/me/calendars")
    assert len(seen) == 1


def test_throttle_is_respected_and_errors_sanitized():
    _backoff.clear()
    seen = []

    def handler(r):
        seen.append(r)
        return httpx.Response(
            429, headers={"Retry-After": "60"}, json={"secret": "do not display"}
        )

    c = MicrosoftCalendarClient(
        "throttled", httpx.Client(transport=httpx.MockTransport(handler))
    )
    for _ in range(2):
        with pytest.raises(ProviderError) as caught:
            c.collection("/me/calendars")
        assert caught.value.status == 429 and "do not display" not in str(caught.value)
    assert len(seen) == 1


@pytest.fixture
def configured(monkeypatch):
    cfg = oauth.get_settings()
    monkeypatch.setattr(cfg, "microsoft_client_id", "fake-client")
    monkeypatch.setattr(cfg, "microsoft_client_secret", "fake-secret")


def begin(client, shared=False):
    r = client.post(
        "/api/accounts/microsoft/auth-url", json={"shared_work_calendars": shared}
    )
    assert r.status_code == 200
    uri = urlparse(r.json()["url"])
    state = parse_qs(uri.query)["ticket"][0]
    r = client.get(uri.path + "?" + uri.query, follow_redirects=False)
    assert r.status_code == 307
    return state, r


def test_oauth_pkce_shared_authority_single_use(client, db, configured):
    state, r = begin(client)
    params = parse_qs(urlparse(r.headers["location"]).query)
    assert "/common/" in r.headers["location"] and params["code_challenge_method"] == [
        "S256"
    ]
    assert params["code_challenge"] == [
        oauth.challenge(client.cookies.get(routes.COOKIE))
    ]
    assert "Calendars.ReadWrite.Shared" not in params["scope"][0]
    saved = client.cookies.get(routes.COOKIE)
    client.cookies.clear()
    assert (
        client.get(
            "/api/accounts/microsoft/callback", params={"state": state, "code": "x"}
        ).status_code
        == 400
    )
    client.cookies.set(routes.COOKIE, saved)
    assert (
        client.get(
            "/api/accounts/microsoft/callback",
            params={"state": state, "error": "access_denied"},
            follow_redirects=False,
        ).status_code
        == 307
    )
    assert (
        client.get(
            "/api/accounts/microsoft/callback", params={"state": state, "code": "x"}
        ).status_code
        == 400
    )
    _, r = begin(client, True)
    assert (
        "/organizations/" in r.headers["location"]
        and "Calendars.ReadWrite.Shared" in r.headers["location"]
    )


def test_oauth_success_reconnect_alias_preserves_calendars(
    client, db, configured, monkeypatch
):
    monkeypatch.setattr(
        oauth,
        "exchange_code",
        lambda *_: {
            "access_token": "access-private",
            "refresh_token": "refresh-private",
            "expires_in": 3600,
        },
    )
    profile = ["stable-id", "first@example.test"]
    monkeypatch.setattr(oauth, "fetch_profile", lambda _: tuple(profile))
    monkeypatch.setattr(sync_engine, "discover_calendars", lambda *_: [])
    for index in range(2):
        state, _ = begin(client)
        r = client.get(
            "/api/accounts/microsoft/callback",
            params={"state": state, "code": "x"},
            follow_redirects=False,
        )
        assert "connected=microsoft" in r.headers["location"]
        db.expire_all()
        account = db.scalar(select(Account))
        if index == 0:
            db.add(
                Calendar(
                    account_id=account.id,
                    remote_id="keep",
                    name="Keep",
                    sync_enabled=True,
                )
            )
            db.commit()
            profile[1] = "new-alias@example.test"
    assert len(list(db.scalars(select(Account)))) == 1
    assert account.email == "new-alias@example.test"
    assert db.scalar(select(Calendar)).sync_enabled
    assert (
        account.access_token_enc != "access-private"
        and decrypt(account.refresh_token_enc) == "refresh-private"
    )
    assert "private" not in client.get("/api/accounts").text


def test_refresh_rotation_and_failure_status(client, db, configured, monkeypatch):
    a = Account(provider="microsoft", email="refresh@example.test")
    oauth.store_tokens(
        a, {"access_token": "old", "refresh_token": "r1", "expires_in": 0}
    )
    db.add(a)
    db.commit()
    monkeypatch.setattr(
        oauth,
        "_tokens",
        lambda *_: {"access_token": "new", "refresh_token": "r2", "expires_in": 3600},
    )
    assert (
        oauth.access_token_for(db, a) == "new" and decrypt(a.refresh_token_enc) == "r2"
    )
    a.token_expiry = utcnow()
    db.commit()

    def transient(*_):
        raise ProviderError(503, "try again")

    monkeypatch.setattr(oauth, "_tokens", transient)
    with pytest.raises(ProviderError):
        oauth.access_token_for(db, a)
    assert a.status == "active"

    def revoked(*_):
        raise ProviderAuthError("revoked")

    monkeypatch.setattr(oauth, "_tokens", revoked)
    with pytest.raises(ProviderAuthError):
        oauth.access_token_for(db, a)
    assert a.status == "needs_reauth"


@pytest.mark.parametrize(
    "tokens",
    [
        {"access_token": "x", "refresh_token": "r", "scope": "User.Read"},
        {"access_token": "x", "scope": "User.Read Calendars.ReadWrite"},
    ],
)
def test_exchange_requires_calendar_and_offline_consent(monkeypatch, tokens):
    monkeypatch.setattr(oauth, "_tokens", lambda *_: tokens)
    with pytest.raises(ProviderAuthError):
        oauth.exchange_code("code", "verifier", False)


def test_api_allows_meeting_notes_but_rejects_unsupported_recurrence(client, graph, db):
    graph.rows = [deepcopy(graph.remote)]
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event))
    response = client.patch(
        f"/api/events/{event.id}", json={"description": "Updated notes"}
    )
    assert response.status_code == 200
    db.expire_all()
    assert event.sync_state == "pending_update"
    assert event.description == "Updated notes"
    response = client.post(
        "/api/events",
        json={
            "calendar_id": graph.calendar.id,
            "title": "Unsupported",
            "start_at": "2026-09-09T09:00:00Z",
            "end_at": "2026-09-09T10:00:00Z",
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1MO",
        },
    )
    assert response.status_code == 422
    assert len(list(db.scalars(select(Event)))) == 1


def test_api_edit_push_and_delete(client, graph, db):
    graph.rows = [deepcopy(graph.remote)]
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event))
    identity = event.id
    response = client.patch(
        f"/api/events/{identity}",
        json={"start_at": "2026-09-09T01:00:00Z", "end_at": "2026-09-09T01:30:00Z"},
    )
    assert response.status_code == 200
    db.expire_all()
    assert sync_engine.push_pending(db) == 1
    assert to_remote(graph.remote).start == datetime(2026, 9, 9, 1)
    assert graph.remote["body"]["content"] == "<p>Keep my notes</p>"
    assert client.delete(f"/api/events/{identity}").status_code == 204
    db.expire_all()
    assert sync_engine.push_pending(db) == 1
    assert db.get(Event, identity) is None


def test_newer_local_edit_can_retry_after_remote_revision(graph):
    event = to_remote(graph.remote)
    event.updated = datetime(2026, 9, 10)
    graph.remote["@odata.etag"] = 'W/"remote-revision"'
    graph.remote["lastModifiedDateTime"] = "2026-09-09T12:00:00Z"
    event.title = "Newer local title"
    graph.provider.update_event("cal", event)
    assert graph.remote["subject"] == "Newer local title"
    assert graph.calls[-1].headers["If-Match"] == 'W/"remote-revision"'


def test_revoked_graph_access_marks_reconnect(graph, db):
    def rejected(*_):
        raise ProviderAuthError("Access revoked")

    graph.provider.list_calendars = rejected
    sync_engine.discover_all(db)
    assert graph.calendar.account.status == "needs_reauth"


def test_expired_and_cross_provider_tickets_fail(client, db, configured):
    state, _ = begin(client)
    attempt = db.get(OAuthAttempt, routes.attempt_key(state))
    attempt.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert (
        client.get(
            "/api/accounts/microsoft/callback", params={"state": state, "code": "x"}
        ).status_code
        == 400
    )
    from weekaboo.api.accounts import digest

    db.add(
        OAuthAttempt(
            token_hash=digest("google-ticket"),
            expires_at=utcnow() + timedelta(minutes=1),
            browser_hash=digest("cookie"),
        )
    )
    db.commit()
    assert (
        client.get(
            "/api/accounts/microsoft/start", params={"ticket": "google-ticket"}
        ).status_code
        == 400
    )


def test_account_migration_preserves_existing_provider_data(client, db, graph):
    from weekaboo import storage

    account = graph.calendar.account
    oauth.store_tokens(
        account, {"access_token": "existing-token", "refresh_token": "existing-refresh"}
    )
    graph.calendar.sync_token = "existing-cursor"
    db.add(
        Event(
            calendar_id=graph.calendar.id,
            title="Pending",
            start_at=datetime(2026, 9, 9),
            end_at=datetime(2026, 9, 9, 1),
            sync_state="pending_create",
        )
    )
    db.commit()
    account_id = account.id
    calendar_id = graph.calendar.id
    db.close()
    with storage.engine.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE accounts DROP COLUMN remote_account_id")
    storage.initialize()
    storage.initialize()
    with storage.SessionLocal() as session:
        account = session.get(Account, account_id)
        assert account.remote_account_id is None
        assert decrypt(account.refresh_token_enc) == "existing-refresh"
        assert session.get(Calendar, calendar_id).sync_token == "existing-cursor"
        assert session.scalar(select(Event)).sync_state == "pending_create"


def test_built_brand_assets_are_served_as_files(client):
    from weekaboo.main import static

    if not (static / "brand/weekaboo-peek.svg").exists():
        pytest.skip("Build frontend before testing production assets")
    for path, content_type in [
        ("/brand/weekaboo-peek.svg", "image/svg+xml"),
        ("/brand/audio/weekaboo-hiya.mp3", "audio/mpeg"),
        ("/fonts/Nunito-Variable.ttf", "font/ttf"),
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith(content_type)
        assert not response.content.startswith(b"<!doctype html>")
    assert client.get("/brand/missing-file.svg").status_code == 404


def test_malformed_token_error_is_sanitized(configured, monkeypatch):
    monkeypatch.setattr(
        oauth.httpx,
        "post",
        lambda *_a, **_k: httpx.Response(500, json=["private details"]),
    )
    with pytest.raises(ProviderError) as caught:
        oauth._tokens({"grant_type": "refresh_token"})
    assert "private details" not in str(caught.value)


def test_revoked_account_does_not_keep_calling_graph(
    client, db, configured, monkeypatch
):
    from weekaboo.integrations.providers.registry import for_account

    account = Account(
        provider="microsoft", email="revoked@example.test", status="needs_reauth"
    )
    db.add(account)
    db.commit()

    def unexpected(*_):
        raise AssertionError("Should wait for user reconnect")

    monkeypatch.setattr(oauth, "access_token_for", unexpected)
    with pytest.raises(ProviderAuthError):
        for_account(db, account)


def test_pending_delete_rebases_revision_when_local_delete_is_newer(graph,db):
    sync_engine.pull_calendar(db,graph.calendar)
    event=db.scalar(select(Event).where(Event.remote_id=='opaque/event+='))
    event.sync_state='pending_delete';event.local_updated_at=datetime(2026,9,12);db.commit()
    graph.rows[0]['@odata.etag']='W/"remote-before-delete"'
    graph.rows[0]['lastModifiedDateTime']='2026-09-10T12:00:00Z'
    sync_engine.pull_calendar(db,graph.calendar)
    assert event.sync_state=='pending_delete'
    assert event.remote_etag=='W/"remote-before-delete"'


def test_notes_edit_keeps_latest_teams_blob_and_remote_metadata(graph):
    from weekaboo.integrations.microsoft_body import editable_notes
    from test_microsoft_body import WRAPPED, BLOB

    graph.remote['body']['content'] = WRAPPED
    event = to_remote(graph.remote)
    assert editable_notes(event.description) == '<p>Original notes</p>'
    event.description = '<p>Updated <strong>agenda</strong></p>'
    # Provider must merge into the current server body, not a cached old blob.
    graph.remote['body']['content'] = WRAPPED.replace('Passcode: fake', 'Passcode: newer')
    before = deepcopy(graph.remote)
    result = graph.provider.update_event('cal', event)
    assert graph.remote['body']['content'] == before['body']['content'].replace('<p>Original notes</p>', event.description)
    for key in ['attendees', 'categories', 'onlineMeeting']:
        assert graph.remote[key] == before[key]
    assert editable_notes(result.description) == event.description
    result.description = None
    graph.provider.update_event('cal', result)
    assert editable_notes(graph.remote['body']['content']) == ''
    assert BLOB.replace('Passcode: fake', 'Passcode: newer') in graph.remote['body']['content']


def test_unknown_meeting_body_never_patches_remote(graph):
    graph.remote['body']['content'] = '<a href="https://teams.live.com/meet/test">Join</a>'
    event = to_remote(graph.remote)
    event.description = 'New notes'
    with pytest.raises(ProviderError, match='unrecognized'):
        graph.provider.update_event('cal', event)
    assert [r.method for r in graph.calls] == ['GET']


def test_cached_html_response_exposes_only_editable_notes(client, graph, db):
    from test_microsoft_body import WRAPPED
    graph.rows = [deepcopy(graph.remote)]
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event))
    event.description = WRAPPED
    db.commit()
    response = client.get('/api/events', params={'start': '2026-09-08', 'end': '2026-09-10'})
    assert response.status_code == 200
    assert response.json()[0]['description'] == WRAPPED
    assert response.json()[0]['editable_description'] == '<p>Original notes</p>'
    db.refresh(event)
    assert event.description == WRAPPED


def test_body_only_invitation_retains_join_link_after_notes_extraction():
    from weekaboo.integrations.microsoft_body import editable_notes
    from test_microsoft_body import WRAPPED
    event = to_remote(raw_event(body={'contentType': 'html', 'content': WRAPPED}))
    assert editable_notes(event.description) == '<p>Original notes</p>'
    assert event.meeting_url == 'https://teams.live.com/meet/123?p=fake&x=1'


def test_api_notes_preserve_meeting_details_while_pending_and_after_push(client, graph, db):
    from test_microsoft_body import WRAPPED, BLOB
    graph.remote['body']['content'] = WRAPPED
    graph.rows = [deepcopy(graph.remote)]
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event))
    response = client.patch(f'/api/events/{event.id}', json={'description':'<p>New agenda</p>'})
    assert response.status_code == 200
    assert BLOB in response.json()['description']
    assert response.json()['editable_description'] == '<p>New agenda</p>'
    db.expire_all()
    assert sync_engine.push_pending(db) == 1
    assert BLOB in graph.remote['body']['content']
    assert client.get(f'/api/events/{event.id}').json()['editable_description'] == '<p>New agenda</p>'


def test_api_unknown_meeting_format_returns_actionable_error_without_losing_cache(client, graph, db):
    source = '<a href="https://teams.live.com/meet/123">Join</a>'
    graph.remote['body']['content'] = source
    graph.rows = [deepcopy(graph.remote)]
    sync_engine.pull_calendar(db, graph.calendar)
    event = db.scalar(select(Event))
    response = client.patch(f'/api/events/{event.id}', json={'description':'New'})
    assert response.status_code == 422
    assert 'unrecognized' in response.json()['error']['message']
    db.expire_all()
    assert event.description == source
