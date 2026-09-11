# Portions adapted from Mantel, MIT © 2026 Mantel contributors. See licenses/Mantel-MIT.txt.
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime

class EventBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=500, examples=["Soccer practice"])
    description: str | None = Field(default=None, examples=["Bring shin guards"])
    location: str | None = Field(default=None, max_length=500, examples=["Riverside Park"])
    start_at: AwareDatetime = Field(
        description="Event start, ISO-8601 with offset.", examples=["2026-08-03T17:00:00Z"]
    )
    end_at: AwareDatetime = Field(
        description="Event end, ISO-8601 with offset.", examples=["2026-08-03T18:30:00Z"]
    )
    all_day: bool = Field(
        default=False,
        description="All-day events span whole calendar days; times are ignored for display.",
    )
    timezone: str | None = Field(default=None, examples=["America/New_York"])


class EventCreate(EventBase):
    calendar_id: int = Field(
        description="Which calendar to write to. Use GET /api/calendars to find one."
    )
    recurrence_rule: str | None = Field(
        default=None,
        description=(
            "An iCalendar RRULE for a repeating event, without the 'RRULE:' prefix. "
            "FREQ must be DAILY, WEEKLY, MONTHLY or YEARLY."
        ),
        examples=["FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"],
    )


class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    calendar_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    location: str | None = None
    start_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None
    all_day: bool | None = None
    timezone: str | None = None
    recurrence_rule: str | None = Field(
        default=None, description="Set to null to turn a repeating event into a single one."
    )


class AttendeeOut(BaseModel):
    email: str | None = None
    name: str | None = None
    status: str = "needsAction"
    organizer: bool = False


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    calendar_id: int
    calendar_name: str
    color: str = Field(description="Resolved display color, so clients need no extra lookups.")
    title: str
    description: str | None
    editable_description: str | None = None
    location: str | None
    start_at: AwareDatetime
    end_at: AwareDatetime
    all_day: bool
    timezone: str | None
    recurring: bool = Field(description="True if this instance came from a recurring series.")
    recurrence_rule: str | None = Field(
        default=None, description="The series' RRULE, when this app owns the recurrence."
    )
    recurrence_text: str | None = Field(
        default=None, description="Human phrasing of the rule, e.g. 'Every week on Mon, Wed'."
    )
    origin: str = Field(description="'local' or 'google'.")
    sync_state: str = Field(description="'synced' or a pending_* state awaiting push to Google.")
    editable: bool
    meeting_url: str | None = None
    source_url: str | None = None
    attendees: list[AttendeeOut] = Field(default_factory=list)


