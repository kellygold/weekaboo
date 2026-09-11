import os
import tempfile
from pathlib import Path
import pytest

os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp(prefix='weekaboo-test-')) / 'test.db'}"
os.environ["SECRET_KEY"] = "aTFRcm1Bd0hRR0RfUHhZS2dJTFVKZDZ6X1dRdG5NNTA="
os.environ["SYNC_ENABLED"] = "false"

from fastapi.testclient import TestClient
from weekaboo.storage import SessionLocal, engine
from weekaboo.main import app
from weekaboo.models import Base, Account, Calendar


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def writable_calendar(client, db):
    account = Account(provider="google", email="test@example.com")
    db.add(account)
    db.flush()
    cal = Calendar(account_id=account.id, remote_id="test", name="Test calendar", sync_enabled=True, access_role="owner")
    db.add(cal)
    db.commit()
    return {"id": cal.id}
