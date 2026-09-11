"""One-time, read-only import of connected calendars into a fresh Weekaboo store.

Run with backend's Python environment. Source DB and credentials are never changed.
IDs remain stable so existing browser calendar preferences continue to work.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys

from cryptography.fernet import Fernet
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def legacy_cipher(key):
    try:
        return Fernet(key.encode())
    except ValueError:
        return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()))


def migrate(source: Path, destination: Path = ROOT):
    os.umask(0o077)
    target = destination / "data/weekaboo.db"
    config_file = destination / "backend/.env"
    if config_file.exists() and not target.exists():
        raise RuntimeError("An incomplete setup exists. Preserve backend/.env and data/weekaboo.importing.db for recovery; do not generate a replacement key.")
    if target.exists() or config_file.exists():
        raise RuntimeError("Weekaboo is already configured; refusing to overwrite its database or keys.")
    config = dotenv_values(source / ".env")
    old_cipher = legacy_cipher(config["SECRET_KEY"])
    key = Fernet.generate_key().decode()
    cipher = Fernet(key.encode())
    source_db = source / "data/family.db"
    with sqlite3.connect(source_db.as_uri() + "?mode=ro", uri=True) as original:
        # A transaction gives a consistent snapshot, even while the old app runs.
        original.execute("BEGIN")
        original.row_factory = sqlite3.Row
        settings = {row["key"]: json.loads(row["value"]).get("value") for row in original.execute("SELECT * FROM app_settings")}
        client_id = settings.get("google_client_id") or config.get("GOOGLE_CLIENT_ID", "")
        stored_secret = settings.get("google_client_secret")
        client_secret = old_cipher.decrypt(stored_secret.encode()).decode() if stored_secret else config.get("GOOGLE_CLIENT_SECRET", "")
        lines = dict(SECRET_KEY=key, GOOGLE_CLIENT_ID=client_id, GOOGLE_CLIENT_SECRET=client_secret,
                     PUBLIC_BASE_URL="http://localhost:8080", FRONTEND_URL="http://127.0.0.1:5188",
                     TIMEZONE=settings.get("home_timezone") or "Australia/Sydney")
        target.parent.mkdir(mode=0o700, exist_ok=True)
        stage = target.with_suffix(".importing.db")
        if stage.exists():
            raise RuntimeError("A previous import staging file exists; inspect it before retrying.")
        os.environ.update(lines)
        os.environ["DATABASE_URL"] = f"sqlite:///{stage}"
        sys.path.insert(0, str(ROOT / "backend"))
        from weekaboo.models import Base
        from sqlalchemy import create_engine
        engine = create_engine(f"sqlite:///{stage}")
        Base.metadata.create_all(engine)
        engine.dispose()
        counts = {}
        try:
            with sqlite3.connect(stage) as dest:
                dest.execute("PRAGMA foreign_keys=ON")
                for old_table, table, mapping, clause in [
                    ("linked_accounts", "accounts", {}, ""),
                    ("calendars", "calendars", {"linked_account_id": "account_id", "google_calendar_id": "remote_id"}, "WHERE linked_account_id IS NOT NULL"),
                    ("events", "events", {"google_event_id": "remote_id", "google_etag": "remote_etag"}, "WHERE calendar_id IN (SELECT id FROM calendars WHERE linked_account_id IS NOT NULL)"),
                ]:
                    columns = {r[1] for r in dest.execute(f"PRAGMA table_info({table})")}
                    required = {r[1] for r in dest.execute(f"PRAGMA table_info({table})") if r[3] and r[4] is None} - {"group_id"}
                    source_columns = {r[1] for r in original.execute(f"PRAGMA table_info({old_table})")}
                    missing = required - {mapping.get(k,k) for k in source_columns}
                    if missing:
                        raise RuntimeError(f"Unsupported Mantel schema: {old_table} is missing {sorted(missing)}. This importer targets the audited 0.5.9 schema.")
                    count = 0
                    for row in original.execute(f"SELECT * FROM {old_table} {clause}"):
                        data = {mapping.get(k,k):v for k,v in dict(row).items() if mapping.get(k,k) in columns}
                        for k in ("access_token_enc", "refresh_token_enc", "password_enc"):
                            if data.get(k):
                                clear = old_cipher.decrypt(data[k].encode())
                                data[k] = cipher.encrypt(clear).decode()
                                assert cipher.decrypt(data[k].encode()) == clear
                        if table == "calendars":
                            data["group_id"] = "personal"
                        keys = list(data)
                        dest.execute(f"INSERT INTO {table} ({','.join(keys)}) VALUES ({','.join('?' for _ in keys)})", [data[k] for k in keys])
                        count += 1
                    counts[table] = count
                if dest.execute("PRAGMA foreign_key_check").fetchall():
                    raise RuntimeError("Imported references did not validate")
                counts["pending_writes"] = dest.execute("SELECT count(*) FROM events WHERE sync_state != 'synced'").fetchone()[0]
                dest.execute("PRAGMA user_version=1")
            # Write only after the complete import validates; never print credentials.
            with config_file.open("x") as handle:
                handle.write("\n".join(f"{k}={json.dumps(v)}" for k,v in lines.items()) + "\n")
            stage.rename(target)
        except BaseException:
            stage.unlink(missing_ok=True)
            config_file.unlink(missing_ok=True)
            raise
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, default=ROOT)
    args = parser.parse_args()
    print(json.dumps(migrate(args.source.resolve(), args.destination.resolve())))
