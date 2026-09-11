from .models import Calendar, Event
from .schemas import EventOut
from .integrations.recurrence import describe
from .timeutil import as_utc


def calendar_out(cal: Calendar) -> dict:
    return dict(id=cal.id, name=cal.name, account_id=cal.account_id,
                account_email=cal.account.email, account_provider=cal.account.provider,
                color=cal.color_override, group_id=cal.group_id,
                sync_enabled=cal.sync_enabled, writable=cal.writable,
                last_synced_at=as_utc(cal.last_synced_at), sync_error=cal.sync_error)


def event_out(ev: Event) -> EventOut:
    description = ev.description
    editable_description = description
    join_url = ev.meeting_url
    if ev.calendar.account.provider == "microsoft":
        from .integrations.microsoft_body import editable_notes, meeting_link
        join_url = join_url or meeting_link(description)
        editable_description = editable_notes(description)
    return EventOut(id=ev.id, calendar_id=ev.calendar_id, calendar_name=ev.calendar.name,
                   color=ev.calendar.color_override or "#819b73", title=ev.title,
                   description=description, editable_description=editable_description, location=ev.location,
                   meeting_url=join_url, source_url=ev.source_url, attendees=ev.attendees or [],
                   start_at=as_utc(ev.start_at), end_at=as_utc(ev.end_at), all_day=ev.all_day,
                   timezone=ev.timezone, recurring=bool(ev.recurring_event_id or ev.recurrence_rule),
                   recurrence_rule=ev.recurrence_rule, recurrence_text=describe(ev.recurrence_rule),
                   origin=ev.origin, sync_state=ev.sync_state,
                   editable=ev.calendar.writable and ev.calendar.sync_enabled)
