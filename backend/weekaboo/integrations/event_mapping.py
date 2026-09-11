# Portions adapted from Mantel, MIT © 2026 Mantel contributors. See licenses/Mantel-MIT.txt.
"""Provider-neutral mapping shared by edit validation and the durable push queue."""

from ..models import Event
from .providers.base import RemoteEvent


def event_to_remote(event: Event) -> RemoteEvent:
    return RemoteEvent(
        id=event.remote_id or "",
        etag=event.remote_etag,
        title=event.title,
        description=event.description,
        location=event.location,
        start=event.start_at,
        end=event.end_at,
        all_day=event.all_day,
        timezone=event.timezone,
        recurrence_rule=event.recurrence_rule,
        operation_id=f"{event.calendar_id}:{event.id}:{event.created_at.isoformat()}"
        if event.created_at
        else None,
        updated=event.local_updated_at,
        meeting_url=event.meeting_url,
        recurring_event_id=event.recurring_event_id,
    )
