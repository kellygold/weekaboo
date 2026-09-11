"""Account setup for Weekaboo. No household identity or claiming step."""
import hashlib
import secrets
import httpx
from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..storage import get_db
from ..models import Account, OAuthAttempt, utcnow
from ..integrations import google_config, google_oauth, icloud_auth, sync_engine
from ..integrations.providers.base import ProviderAuthError, ProviderError

router = APIRouter(prefix="/accounts")
COOKIE = "weekaboo_oauth"


def digest(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def account_out(account: Account) -> dict:
    return dict(id=account.id, provider=account.provider, email=account.email,
                status=account.status, last_error=account.last_error)


@router.get("")
def accounts(db: Session = Depends(get_db)):
    return [account_out(a) for a in db.scalars(select(Account).order_by(Account.email))]


@router.post("/google/auth-url")
def google_auth_url(db: Session = Depends(get_db)):
    cfg = google_config.load()
    if not cfg.configured:
        raise HTTPException(409, "Google connection is not configured on this installation yet.")
    ticket = secrets.token_urlsafe(32)
    db.execute(delete(OAuthAttempt).where(OAuthAttempt.expires_at < utcnow()))
    db.add(OAuthAttempt(token_hash=digest(ticket), expires_at=utcnow() + timedelta(minutes=10)))
    db.commit()
    return {"url": f"{cfg.base_url}/api/accounts/google/start?{urlencode({'ticket': ticket})}"}


@router.get("/google/start")
def google_start(ticket: str, db: Session = Depends(get_db)):
    attempt = db.get(OAuthAttempt, digest(ticket))
    if not attempt or attempt.expires_at < utcnow() or attempt.browser_hash:
        raise HTTPException(400, "Start a new Google connection from Weekaboo.")
    browser = secrets.token_urlsafe(32)
    attempt.browser_hash = digest(browser)
    db.commit()
    response = RedirectResponse(google_oauth.build_auth_url(google_config.load(), ticket))
    response.set_cookie(COOKIE, browser, max_age=600, httponly=True, samesite="lax",
                        secure=get_settings().public_base_url.startswith("https:"),
                        path="/api/accounts/google")
    return response


def finish(**result):
    response = RedirectResponse(get_settings().frontend_url + "/?" + urlencode({"accounts": "1", **result}))
    response.delete_cookie(COOKIE, path="/api/accounts/google")
    return response


@router.get("/google/callback")
def google_callback(request: Request, state: str = "", code: str = "", error: str = "",
                    db: Session = Depends(get_db)):
    attempt = db.get(OAuthAttempt, digest(state))
    browser = request.cookies.get(COOKIE, "")
    if (not attempt or attempt.expires_at < utcnow() or not browser or not attempt.browser_hash
            or not secrets.compare_digest(attempt.browser_hash, digest(browser))):
        raise HTTPException(400, "Connection expired or browser did not match. Start again in Weekaboo.")
    db.delete(attempt)
    db.commit()  # Single-use even when Google refuses the exchange.
    if error or not code:
        return finish(error="google_cancelled")
    try:
        tokens = google_oauth.exchange_code(google_config.load(), code)
        if google_oauth.missing_calendar_scope(tokens):
            return finish(error="calendar_permission")
        email = google_oauth.fetch_email(tokens["access_token"])
        account = db.scalar(select(Account).where(Account.provider == "google", Account.email == email))
        if account is None:
            account = Account(provider="google", email=email)
            db.add(account)
        google_oauth.store_tokens(account, tokens)
        db.commit()
    except (ProviderError, ProviderAuthError, httpx.HTTPError):
        db.rollback()
        return finish(error="google_connection")
    try:
        sync_engine.discover_calendars(db, account)
    except (ProviderError, ProviderAuthError, httpx.HTTPError):
        db.rollback()
        account.last_error = "Connected, but calendar discovery failed. Try syncing again."
        db.commit()
        return finish(connected="google", error="calendar_discovery")
    return finish(connected="google")


class ICloudInput(BaseModel):
    apple_id: str = Field(min_length=3, max_length=255)
    app_password: str = Field(min_length=1, max_length=100)


@router.post("/icloud", status_code=201)
def connect_icloud(payload: ICloudInput, db: Session = Depends(get_db)):
    email = payload.apple_id.strip().lower()
    account = db.scalar(select(Account).where(Account.provider == "icloud", Account.email == email))
    if account is None:
        account = Account(provider="icloud", email=email)
        db.add(account)
        db.flush()
    try:
        icloud_auth.verify_and_store(db, account, "".join(payload.app_password.split()))
    except ProviderAuthError:
        db.rollback()
        raise HTTPException(400, "Apple could not verify that Apple ID and app-specific password.") from None
    except ProviderError:
        db.rollback()
        raise HTTPException(502, "iCloud is unavailable. Please try again.") from None
    try:
        sync_engine.discover_calendars(db, account)
    except (ProviderError, ProviderAuthError):
        account.last_error = "Connected, but calendar discovery failed. Try syncing again."
        db.commit()
    return account_out(account)


@router.delete("/{account_id}", status_code=204)
def disconnect(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    # Drop only this installation's stored credentials and cache. Revocation of
    # a shared Google client grant would also break other installations/apps.
    db.delete(account)
    db.commit()
