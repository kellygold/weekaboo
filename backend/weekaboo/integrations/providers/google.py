# Portions adapted from Mantel, MIT © 2026 Mantel contributors. See licenses/Mantel-MIT.txt.
"""Google Calendar, expressed as a CalendarProvider.

Everything Google-shaped lives here: its JSON field names, its cancelled-event
convention, and its habit of describing all-day events with plain dates. The
transport itself is still `google_api.GoogleCalendarClient` -- this only
translates.
"""

from datetime import UTC, datetime

from dateutil import parser as dateparser

from ..google_api import GoogleCalendarClient
from ..recurrence import utc_until
from .base import ProviderError, RemoteCalendar, RemoteEvent


class GoogleProvider:
    # Events are requested with singleEvents, so Google hands back the individual
    # occurrences of a series and our copy of the master must stop being drawn.
    expands_recurrence = True

    def __init__(
        self, access_token: str | None = None, client: GoogleCalendarClient | None = None
    ):
        # `client` is how tests substitute a fake without going through a token.
        self._client = client if client is not None else GoogleCalendarClient(access_token or "")

    def list_calendars(self) -> list[RemoteCalendar]:
        return [
            RemoteCalendar(
                id=entry["id"],
                name=entry.get("summary") or "",
                access_role=entry.get("accessRole") or "reader",
            )
            for entry in self._client.list_calendars()
            if entry.get("id")
        ]

    def list_events(
        self,
        calendar_id: str,
        sync_token: str | None = None,
        time_min: str | None = None,
    ) -> tuple[list[RemoteEvent], str | None]:
        items, next_token = self._client.list_events(
            calendar_id, sync_token=sync_token, time_min=time_min
        )
        return [_to_remote(item) for item in items if item.get("id")], next_token

    def create_event(self, calendar_id: str, event: RemoteEvent) -> RemoteEvent:
        return _to_remote(self._client.insert_event(calendar_id, _to_body(event)))

    def update_event(self, calendar_id: str, event: RemoteEvent) -> RemoteEvent:
        remote = _to_remote(self._client.get_event(calendar_id, event.id))
        if (event.etag and remote.etag != event.etag
                and (not event.updated or not remote.updated or remote.updated >= event.updated)):
            raise ProviderError(412, "This Google event changed elsewhere. Sync before editing it again.")
        return _to_remote(self._client.patch_event(
            calendar_id, event.id, _to_body(event), etag=remote.etag or event.etag
        ))

    def delete_event(self, calendar_id: str, remote_id: str, etag: str | None = None) -> None:
        self._client.delete_event(calendar_id, remote_id, etag=etag)


# ----------------------------- translation -----------------------------------


def _to_remote(item: dict) -> RemoteEvent:
    if item.get("status") == "cancelled":
        return RemoteEvent(id=item.get("id", ""), deleted=True)

    start, end, all_day = _parse_times(item)
    return RemoteEvent(
        id=item.get("id", ""),
        etag=item.get("etag"),
        title=item.get("summary") or "(no title)",
        description=item.get("description"),
        location=item.get("location"),
        meeting_url=item.get("hangoutLink") or next((p.get("uri") for p in (item.get("conferenceData") or {}).get("entryPoints", []) if p.get("entryPointType") == "video" and p.get("uri")), None),
        source_url=item.get("htmlLink"),
        attendees=[{"email": a.get("email"), "name": a.get("displayName"), "status": a.get("responseStatus", "needsAction"), "organizer": bool(a.get("organizer"))} for a in item.get("attendees", [])],
        start=start,
        end=end,
        all_day=all_day,
        timezone=(item.get("start") or {}).get("timeZone"),
        recurring_event_id=item.get("recurringEventId"),
        updated=_parse_dt(item.get("updated")),
    )


def _to_body(event: RemoteEvent) -> dict:
    if event.all_day:
        start = {"date": event.start.date().isoformat()}
        end = {"date": event.end.date().isoformat()}
    else:
        start = {"dateTime": _iso_utc(event.start)}
        end = {"dateTime": _iso_utc(event.end)}
        if event.timezone or event.recurrence_rule:
            start["timeZone"] = end["timeZone"] = event.timezone or "UTC"
    body = {
        "summary": event.title,
        "description": event.description,
        "location": event.location,
        "start": start,
        "end": end,
    }
    if event.recurrence_rule:
        # Google owns the expansion from here. Our pull asks for singleEvents, so
        # what comes back are individual instances -- which is why the master gets
        # hidden from queries once this push succeeds.
        rule = event.recurrence_rule if event.all_day else utc_until(event.recurrence_rule)
        body["recurrence"] = [f"RRULE:{rule}"]
    return body


def _iso_utc(dt: datetime) -> str:
    aware = dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return aware.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = dateparser.isoparse(value)
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def _parse_times(item: dict) -> tuple[datetime | None, datetime | None, bool]:
    start_obj = item.get("start") or {}
    end_obj = item.get("end") or {}

    if "date" in start_obj:
        # All-day: Google gives plain dates with an exclusive end, which is exactly how
        # they are stored here, so no timezone conversion should happen.
        start = dateparser.isoparse(start_obj["date"])
        end = dateparser.isoparse(end_obj.get("date", start_obj["date"]))
        return start, end, True

    return _parse_dt(start_obj.get("dateTime")), _parse_dt(end_obj.get("dateTime")), False
