"""Weekaboo's storage contract. Accounts own calendars; people do not claim them.

Provider identifiers are opaque and provider-neutral. No household, dashboard,
local calendar or chore tables are part of this application.
"""
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Account(Timestamps, Base):
    __tablename__ = "accounts"
    __table_args__ = (UniqueConstraint("provider", "email"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(16))
    email: Mapped[str] = mapped_column(String(255))
    remote_account_id: Mapped[str | None] = mapped_column(String(255))
    access_token_enc: Mapped[str | None] = mapped_column(Text)
    refresh_token_enc: Mapped[str | None] = mapped_column(Text)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime)
    password_enc: Mapped[str | None] = mapped_column(Text)
    calendar_home_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(default="active")
    last_error: Mapped[str | None] = mapped_column(Text)
    calendars: Mapped[list["Calendar"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class Calendar(Timestamps, Base):
    __tablename__ = "calendars"
    __table_args__ = (UniqueConstraint("account_id", "remote_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    remote_id: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(String(255))
    color_override: Mapped[str | None] = mapped_column(String(9))
    group_id: Mapped[str] = mapped_column(default="personal")
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_token: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    sync_error: Mapped[str | None] = mapped_column(Text)
    access_role: Mapped[str] = mapped_column(default="reader")
    account: Mapped[Account] = relationship(back_populates="calendars")
    events: Mapped[list["Event"]] = relationship(back_populates="calendar", cascade="all, delete-orphan")

    @property
    def writable(self) -> bool:
        return self.access_role in ("owner", "writer")


class Event(Timestamps, Base):
    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("calendar_id", "remote_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    calendar_id: Mapped[int] = mapped_column(ForeignKey("calendars.id", ondelete="CASCADE"))
    remote_id: Mapped[str | None] = mapped_column(Text)
    remote_etag: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    meeting_url: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    attendees: Mapped[list[dict] | None] = mapped_column(JSON)
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    timezone: Mapped[str | None] = mapped_column(String(64))
    recurrence_rule: Mapped[str | None] = mapped_column(Text)
    recurring_event_id: Mapped[str | None] = mapped_column(Text)
    exdates: Mapped[str | None] = mapped_column(Text)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_end: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(default="confirmed")
    origin: Mapped[str] = mapped_column(default="local")
    sync_state: Mapped[str] = mapped_column(default="synced", index=True)
    local_updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    remote_updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    calendar: Mapped[Calendar] = relationship(back_populates="events")


class OAuthAttempt(Base):
    __tablename__ = "oauth_attempts"
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    browser_hash: Mapped[str | None] = mapped_column(Text)
