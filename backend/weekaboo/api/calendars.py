from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import Calendar
from ..storage import get_db
from ..serializers import calendar_out
from ..integrations.pullsignal import request_pull

router = APIRouter(prefix="/calendars")


class CalendarChanges(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sync_enabled: bool | None = None
    color_override: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    group_id: str | None = Field(default=None, min_length=1, max_length=64)


@router.get("")
def calendars(db: Session = Depends(get_db)):
    return [calendar_out(c) for c in db.scalars(select(Calendar).order_by(Calendar.id))]


@router.patch("/{calendar_id}")
def update(calendar_id: int, changes: CalendarChanges, db: Session = Depends(get_db)):
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(404, "Calendar not found")
    for key, value in changes.model_dump(exclude_unset=True).items():
        if value is None and key != "color_override":
            raise HTTPException(422, f"{key} cannot be null")
        setattr(cal, key, value)
    db.commit()
    if cal.sync_enabled:
        request_pull()
    return calendar_out(cal)
