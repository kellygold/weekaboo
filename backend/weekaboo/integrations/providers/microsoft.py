"""Outlook/Hotmail/Microsoft 365 adapter implementing the shared provider contract.

Graph expands recurrences. Complete window snapshots support secondary and
shared calendars without depending on beta delta endpoints. The engine prunes
only within a successfully fetched window and preserves pending local edits.
"""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil.parser import isoparse

from ...config import get_settings
from ..microsoft_body import editable_notes, merge_notes, meeting_link
from ..microsoft_api import MicrosoftCalendarClient, q
from .base import ProviderError, RemoteCalendar, RemoteEvent

# Unicode CLDR Windows zone mapping (territory 001). See licenses/Unicode-CLDR.txt.
WINDOWS_ZONES = json.loads(
    (Path(__file__).parents[1] / "windows_zones.json").read_text()
)
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_CODES = dict(zip(["MO", "TU", "WE", "TH", "FR", "SA", "SU"], DAYS))


def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(WINDOWS_ZONES.get(name, name) or "UTC")
    except ZoneInfoNotFoundError:
        raise ProviderError(
            422, "Microsoft supplied an unsupported time zone."
        ) from None


def parse_time(value: dict) -> datetime:
    dt = isoparse(value["dateTime"])
    if not dt.tzinfo:
        dt = dt.replace(tzinfo=zone(value.get("timeZone")))
    return dt.astimezone(UTC).replace(tzinfo=None)


def to_remote(item: dict) -> RemoteEvent:
    identity = item.get("id")
    if not isinstance(identity, str) or not identity:
        raise ProviderError(502, "Microsoft returned an event without an identifier.")
    if item.get("isCancelled") or item.get("@removed"):
        return RemoteEvent(id=identity, deleted=True)
    try:
        start = parse_time(item["start"])
        end = parse_time(item["end"])
        all_day = bool(item.get("isAllDay"))
        tz = item.get("originalStartTimeZone") or item["start"].get("timeZone") or "UTC"
        if all_day:
            # Graph may return all-day midnights converted to the requested UTC.
            # Recover their ORIGINAL civil dates rather than shifting by a day.
            original = zone(tz)
            start = datetime.combine(
                start.replace(tzinfo=UTC).astimezone(original).date(),
                datetime.min.time(),
            )
            end = datetime.combine(
                end.replace(tzinfo=UTC).astimezone(original).date(), datetime.min.time()
            )
        if end <= start:
            raise ValueError
        updated = (
            isoparse(item["lastModifiedDateTime"]).astimezone(UTC).replace(tzinfo=None)
            if item.get("lastModifiedDateTime")
            else None
        )
    except (KeyError, ValueError, TypeError):
        raise ProviderError(
            502, "Microsoft returned incomplete event dates; sync was not applied."
        ) from None
    status = {
        "accepted": "accepted",
        "declined": "declined",
        "tentativelyAccepted": "tentative",
        "none": "needsAction",
        "notResponded": "needsAction",
        "organizer": "accepted",
    }
    organizer = (item.get("organizer") or {}).get("emailAddress") or {}
    attendees = []
    for guest in item.get("attendees") or []:
        address = guest.get("emailAddress") or {}
        attendees.append(
            {
                "email": address.get("address"),
                "name": address.get("name"),
                "status": status.get(
                    (guest.get("status") or {}).get("response"), "needsAction"
                ),
                "organizer": bool(
                    address.get("address")
                    and address.get("address", "").lower()
                    == organizer.get("address", "").lower()
                ),
            }
        )
    return RemoteEvent(
        id=identity,
        etag=item.get("@odata.etag"),
        title=item.get("subject") or "(no title)",
        description=(item.get("body") or {}).get("content"),
        location=(item.get("location") or {}).get("displayName"),
        meeting_url=(item.get("onlineMeeting") or {}).get("joinUrl")
        or item.get("onlineMeetingUrl")
        or meeting_link((item.get("body") or {}).get("content")),
        source_url=item.get("webLink"),
        attendees=attendees,
        start=start,
        end=end,
        all_day=all_day,
        timezone=WINDOWS_ZONES.get(tz, tz),
        recurring_event_id=item.get("seriesMasterId"),
        updated=updated,
    )


def graph_recurrence(event: RemoteEvent) -> dict | None:
    if not event.recurrence_rule:
        return None
    try:
        parts = dict(
            part.split("=", 1) for part in event.recurrence_rule.upper().split(";")
        )
        if set(parts) - {
            "FREQ",
            "INTERVAL",
            "COUNT",
            "UNTIL",
            "BYDAY",
            "BYMONTHDAY",
            "BYMONTH",
            "WKST",
        }:
            raise ValueError
        if "COUNT" in parts and "UNTIL" in parts:
            raise ValueError
        tz = zone(event.timezone)
        local = (
            event.start.replace(tzinfo=UTC).astimezone(tz)
            if not event.all_day
            else event.start
        )
        pattern = {"interval": int(parts.get("INTERVAL", "1"))}
        if pattern["interval"] < 1:
            raise ValueError
        freq = parts["FREQ"]
        if freq == "DAILY":
            if any(k in parts for k in ("BYDAY", "BYMONTHDAY", "BYMONTH")):
                raise ValueError
            pattern["type"] = "daily"
        elif freq == "WEEKLY":
            if any(k in parts for k in ("BYMONTHDAY", "BYMONTH")):
                raise ValueError
            pattern.update(
                type="weekly",
                daysOfWeek=[
                    DAY_CODES[d]
                    for d in parts.get("BYDAY", list(DAY_CODES)[local.weekday()]).split(
                        ","
                    )
                ],
                firstDayOfWeek=DAY_CODES[parts.get("WKST", "MO")],
            )
        elif freq in ("MONTHLY", "YEARLY"):
            if "BYDAY" in parts:
                raise ValueError
            if freq == "MONTHLY" and "BYMONTH" in parts:
                raise ValueError
            day = int(parts.get("BYMONTHDAY", local.day))
            if not 1 <= day <= 31:
                raise ValueError
            pattern.update(
                type="absoluteMonthly" if freq == "MONTHLY" else "absoluteYearly",
                dayOfMonth=day,
            )
            if freq == "YEARLY":
                month = int(parts.get("BYMONTH", local.month))
                if not 1 <= month <= 12:
                    raise ValueError
                pattern["month"] = month
        else:
            raise ValueError
        bounds = {
            "type": "noEnd",
            "startDate": local.date().isoformat(),
            "recurrenceTimeZone": event.timezone or "UTC",
        }
        if "COUNT" in parts:
            count = int(parts["COUNT"])
            if count < 1:
                raise ValueError
            bounds.update(type="numbered", numberOfOccurrences=count)
        elif "UNTIL" in parts:
            until = isoparse(parts["UNTIL"])
            if until.tzinfo:
                until = until.astimezone(tz)
            bounds.update(type="endDate", endDate=until.date().isoformat())
        return {"pattern": pattern, "range": bounds}
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ProviderError(
            422,
            "This repeat pattern cannot be represented in Outlook. Use daily, weekly, monthly or yearly repeats.",
        ) from None


def to_body(event: RemoteEvent, *, creating: bool) -> dict:
    tz = event.timezone or "UTC"
    local_zone = zone(tz)

    def stamp(dt):
        local = dt if event.all_day else dt.replace(tzinfo=UTC).astimezone(local_zone)
        return {
            "dateTime": local.isoformat(timespec="seconds").split("+")[0]
            if event.all_day
            else local.replace(tzinfo=None).isoformat(timespec="seconds"),
            "timeZone": tz,
        }

    body = {
        "subject": event.title,
        "start": stamp(event.start),
        "end": stamp(event.end),
        "isAllDay": event.all_day,
        "body": {"contentType": "HTML", "content": event.description or ""},
        "location": {"displayName": event.location or ""},
    }
    if creating or event.recurrence_rule:
        body["recurrence"] = graph_recurrence(event)
    return body


def validate_event(event: RemoteEvent, previous: RemoteEvent | None = None) -> None:
    to_body(event, creating=previous is None)
    if previous and previous.recurring_event_id and event.recurrence_rule:
        raise ProviderError(
            422,
            "Edit the repeat pattern in Outlook. You can change this occurrence’s title and time here.",
        )



class MicrosoftProvider:
    expands_recurrence = True
    snapshot_window: tuple[datetime, datetime] | None = None

    def __init__(
        self, access_token: str = "", client: MicrosoftCalendarClient | None = None
    ):
        self.client = client or MicrosoftCalendarClient(access_token)

    def list_calendars(self) -> list[RemoteCalendar]:
        rows = self.client.collection("/me/calendars", {"$top": 100})
        if any(not row.get("id") for row in rows):
            raise ProviderError(502, "Microsoft returned an incomplete calendar list.")
        return [
            RemoteCalendar(
                id=row["id"],
                name=row.get("name") or "",
                access_role="writer" if row.get("canEdit") else "reader",
            )
            for row in rows
        ]

    def list_events(self, calendar_id, sync_token=None, time_min=None):
        self.snapshot_window = None
        start = (
            isoparse(time_min).astimezone(UTC)
            if time_min
            else datetime.now(UTC) - timedelta(days=get_settings().sync_past_days)
        )
        end = datetime.now(UTC) + timedelta(
            days=get_settings().microsoft_sync_future_days
        )
        # Midnight bounds avoid ambiguous date-only comparisons for all-day rows.
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0)
        rows = self.client.collection(
            f"/me/calendars/{q(calendar_id)}/calendarView",
            {
                "startDateTime": start.isoformat(),
                "endDateTime": end.isoformat(),
                "$top": 1000,
            },
        )
        events = [to_remote(row) for row in rows]
        self.snapshot_window = (start.replace(tzinfo=None), end.replace(tzinfo=None))
        return events, None

    def create_event(self, calendar_id: str, event: RemoteEvent) -> RemoteEvent:
        body = to_body(event, creating=True)
        # Stable local operation ID makes an ambiguous network retry idempotent.
        if event.operation_id:
            body["transactionId"] = hashlib.sha256(
                event.operation_id.encode()
            ).hexdigest()
        return to_remote(
            self.client.request(
                "POST", f"/me/calendars/{q(calendar_id)}/events", json=body
            )
        )

    def update_event(self, calendar_id: str, event: RemoteEvent) -> RemoteEvent:
        path = f"/me/calendars/{q(calendar_id)}/events/{q(event.id)}"
        remote = self.client.request("GET", path)
        if (
            event.etag
            and remote.get("@odata.etag") != event.etag
            and (
                not event.updated
                or not to_remote(remote).updated
                or to_remote(remote).updated > event.updated
            )
        ):
            raise ProviderError(
                412,
                "This Outlook event changed elsewhere. Sync before editing it again.",
            )
        body = to_body(event, creating=False)
        # Omit unchanged body/location/title to retain online meeting markup and
        # richer provider fields. Attendees are never sent by this adapter.
        if (editable_notes(event.description) or "") == (editable_notes((remote.get("body") or {}).get("content")) or ""):
            body.pop("body")
        if (event.location or "") == (
            (remote.get("location") or {}).get("displayName") or ""
        ):
            body.pop("location")
        if event.title == remote.get("subject"):
            body.pop("subject")
        if "body" in body:
            body["body"]["content"] = merge_notes(
                (remote.get("body") or {}).get("content") or "",
                event.description,
                online=bool(remote.get("isOnlineMeeting")),
            )
        return to_remote(
            self.client.request(
                "PATCH",
                path,
                json=body,
                headers={"If-Match": remote.get("@odata.etag") or event.etag or "*"},
            )
        )

    def delete_event(self, calendar_id: str, remote_id: str, etag: str | None = None):
        self.client.request(
            "DELETE",
            f"/me/calendars/{q(calendar_id)}/events/{q(remote_id)}",
            headers={"If-Match": etag or "*"},
        )
