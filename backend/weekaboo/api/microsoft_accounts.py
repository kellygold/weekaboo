"""Browser-bound, single-use OAuth with PKCE for Outlook and Microsoft 365."""

import secrets
from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..integrations import microsoft_oauth as oauth
from ..integrations import sync_engine
from ..integrations.providers.base import ProviderAuthError, ProviderError
from ..models import Account, OAuthAttempt, utcnow
from ..storage import get_db
from .accounts import digest

router = APIRouter(prefix="/accounts/microsoft", tags=["accounts"])
COOKIE = "weekaboo_microsoft_oauth"
PATH = "/api/accounts/microsoft"


class MicrosoftInput(BaseModel):
    shared_work_calendars: bool = False


def attempt_key(state: str) -> str:
    # Google attempts cannot be redeemed through Microsoft's callback or vice versa.
    return digest("microsoft:" + state)


@router.post("/auth-url")
def auth_url(payload: MicrosoftInput, db: Session = Depends(get_db)):
    if not oauth.configured():
        raise HTTPException(
            409, "Microsoft connection is not configured on this installation yet."
        )
    ticket = (
        "work." if payload.shared_work_calendars else "personal."
    ) + secrets.token_urlsafe(32)
    db.execute(delete(OAuthAttempt).where(OAuthAttempt.expires_at < utcnow()))
    db.add(
        OAuthAttempt(
            token_hash=attempt_key(ticket), expires_at=utcnow() + timedelta(minutes=10)
        )
    )
    db.commit()
    return {
        "url": get_settings().public_base_url.rstrip("/")
        + PATH
        + "/start?"
        + urlencode({"ticket": ticket})
    }


@router.get("/start")
def start(ticket: str, db: Session = Depends(get_db)):
    attempt = db.get(OAuthAttempt, attempt_key(ticket))
    if not attempt or attempt.expires_at < utcnow() or attempt.browser_hash:
        raise HTTPException(400, "Start a new Microsoft connection from Weekaboo.")
    verifier = secrets.token_urlsafe(32)
    attempt.browser_hash = digest(verifier)
    db.commit()
    response = RedirectResponse(
        oauth.build_auth_url(ticket, verifier, ticket.startswith("work."))
    )
    response.set_cookie(
        COOKIE,
        verifier,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=get_settings().public_base_url.startswith("https:"),
        path=PATH,
    )
    return response


def finish(**result):
    response = RedirectResponse(
        get_settings().frontend_url.rstrip("/")
        + "/?"
        + urlencode({"accounts": "1", **result})
    )
    response.delete_cookie(COOKIE, path=PATH)
    return response


@router.get("/callback")
def callback(
    request: Request,
    state: str = "",
    code: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    attempt = db.get(OAuthAttempt, attempt_key(state))
    verifier = request.cookies.get(COOKIE, "")
    if (
        not attempt
        or attempt.expires_at < utcnow()
        or not verifier
        or not attempt.browser_hash
        or not secrets.compare_digest(attempt.browser_hash, digest(verifier))
    ):
        raise HTTPException(
            400, "Connection expired or browser did not match. Start again in Weekaboo."
        )
    db.delete(attempt)
    db.commit()
    if error or not code:
        return finish(error="microsoft_cancelled")
    try:
        tokens = oauth.exchange_code(code, verifier, state.startswith("work."))
        remote_id, email = oauth.fetch_profile(tokens["access_token"])
        account = db.scalar(
            select(Account).where(
                Account.provider == "microsoft", Account.remote_account_id == remote_id
            )
        )
        if account is None:
            account = db.scalar(
                select(Account).where(
                    Account.provider == "microsoft", Account.email == email
                )
            )
            if (
                account
                and account.remote_account_id
                and account.remote_account_id != remote_id
            ):
                raise ProviderAuthError("Account identity does not match.")
        if account is None:
            account = Account(provider="microsoft", email=email)
            db.add(account)
        account.remote_account_id = remote_id
        account.email = email
        oauth.store_tokens(account, tokens)
        db.commit()
    except (ProviderAuthError, ProviderError, IntegrityError):
        db.rollback()
        return finish(error="microsoft_connection")
    try:
        sync_engine.discover_calendars(db, account)
    except (ProviderAuthError, ProviderError):
        db.rollback()
        account.last_error = (
            "Connected, but calendar discovery failed. Try syncing again."
        )
        db.commit()
        return finish(connected="microsoft", error="calendar_discovery")
    return finish(connected="microsoft")
