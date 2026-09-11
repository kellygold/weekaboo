import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from cryptography.fernet import Fernet
from dotenv import dotenv_values


def test_import_preserves_ids_rekeys_credentials_skips_local_and_never_overwrites(tmp_path):
    source = tmp_path / "mantel"
    destination = tmp_path / "weekaboo"
    (source / "data").mkdir(parents=True)
    (destination / "backend").mkdir(parents=True)
    old_key = Fernet.generate_key()
    old = Fernet(old_key)
    (source / ".env").write_text(f"SECRET_KEY={old_key.decode()}\nGOOGLE_CLIENT_ID=test-client\nGOOGLE_CLIENT_SECRET=test-client-secret\n")
    db_path = source / "data/family.db"
    with sqlite3.connect(db_path) as db:
        db.executescript('''
        CREATE TABLE app_settings(key TEXT, value TEXT);
        CREATE TABLE linked_accounts(id INTEGER, provider TEXT, email TEXT, access_token_enc TEXT, refresh_token_enc TEXT, password_enc TEXT, status TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE calendars(id INTEGER, linked_account_id INTEGER, google_calendar_id TEXT, name TEXT, sync_enabled INTEGER, access_role TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE events(id INTEGER, calendar_id INTEGER, google_event_id TEXT, google_etag TEXT, title TEXT, start_at TEXT, end_at TEXT, all_day INTEGER, status TEXT, origin TEXT, sync_state TEXT, is_master INTEGER, local_updated_at TEXT, created_at TEXT, updated_at TEXT);
        ''')
        timestamp = '2026-09-09 00:00:00'
        db.execute('INSERT INTO linked_accounts VALUES (?,?,?,?,?,?,?,?,?)', (7,'google','test@example.com',old.encrypt(b'access').decode(),old.encrypt(b'refresh').decode(),None,'active',timestamp,timestamp))
        db.execute('INSERT INTO calendars VALUES (?,?,?,?,?,?,?,?)', (1,None,None,'Family',0,'owner',timestamp,timestamp))
        db.execute('INSERT INTO calendars VALUES (?,?,?,?,?,?,?,?)', (12,7,'primary','Personal',1,'owner',timestamp,timestamp))
        for eid, cid in [(1,1),(23,12)]:
            db.execute('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (eid,cid,'remote','etag','Keep my edit',timestamp,'2026-09-09 01:00:00',0,'confirmed','google','pending_update',0,timestamp,timestamp,timestamp))
    original = db_path.read_bytes()
    root = Path(__file__).resolve().parents[2]
    cmd = [sys.executable, str(root/'scripts/import-mantel.py'), '--source', str(source), '--destination', str(destination)]
    env = {k:v for k,v in os.environ.items() if k not in {'DATABASE_URL','SECRET_KEY'}}
    result = subprocess.run(cmd, text=True, capture_output=True, env=env)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {'accounts':1,'calendars':1,'events':1,'pending_writes':1}
    config = dotenv_values(destination/'backend/.env')
    assert config['SECRET_KEY'] != old_key.decode()
    with sqlite3.connect(destination/'data/weekaboo.db') as db:
        assert db.execute('SELECT id FROM calendars').fetchall() == [(12,)]
        assert db.execute('SELECT id, remote_id, sync_state FROM events').fetchall() == [(23,'remote','pending_update')]
        credential = db.execute('SELECT refresh_token_enc FROM accounts').fetchone()[0]
        assert Fernet(config['SECRET_KEY'].encode()).decrypt(credential.encode()) == b'refresh'
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
    assert db_path.read_bytes() == original
    assert subprocess.run(cmd, capture_output=True, env=env).returncode != 0
    assert (destination/'backend/.env').stat().st_mode & 0o777 == 0o600
