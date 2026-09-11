import os
from threading import Lock
from contextlib import nullcontext
from fastapi import Request
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import sessionmaker
from .config import get_settings
from .models import Base

# One process owns this device's database. Serialize sync and API writes to avoid
# overwriting edits made while an HTTP request to a provider was in flight.
write_lock = Lock()
os.umask(0o077)
engine = create_engine(get_settings().database_url, connect_args={"check_same_thread": False, "timeout": 30})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "connect")
def pragmas(connection, _):
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=30000")


def initialize():
    existing = set(inspect(engine).get_table_names())
    if existing and existing != set(Base.metadata.tables):
        raise RuntimeError("This is not a Weekaboo database. Import into a fresh database instead.")
    Base.metadata.create_all(engine)
    # Additive, idempotent migration from the initial Weekaboo schema. Reset
    # provider cursors once so unchanged events also acquire their link metadata.
    columns = {c["name"] for c in inspect(engine).get_columns("events")}
    missing = [name for name in ("meeting_url", "source_url", "attendees") if name not in columns]
    if missing:
        with engine.begin() as connection:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            for name in missing:
                connection.exec_driver_sql(f"ALTER TABLE events ADD COLUMN {name} TEXT")
            connection.exec_driver_sql("UPDATE calendars SET sync_token = NULL")
    account_columns = {c["name"] for c in inspect(engine).get_columns("accounts")}
    if "remote_account_id" not in account_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE accounts ADD COLUMN remote_account_id VARCHAR(255)")


def get_db(request: Request):
    # FastAPI may enter and exit a synchronous dependency on different pool
    # threads. Lock (unlike RLock) supports that, and reads need not block on DAV.
    mutates = request.method not in {"GET", "HEAD"} or any(
        f"/accounts/{provider}/" in request.url.path for provider in ("google", "microsoft")
    )
    with (write_lock if mutates else nullcontext()), SessionLocal() as db:
        yield db
