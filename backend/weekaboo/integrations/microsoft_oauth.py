"""Microsoft delegated OAuth. Credentials never cross into the browser bundle."""

import base64
import hashlib
from datetime import timedelta

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Account, utcnow
from .crypto import decrypt, encrypt
from .providers.base import ProviderAuthError, ProviderError

LOGIN = "https://login.microsoftonline.com"
SCOPES = ("User.Read", "Calendars.ReadWrite", "offline_access")
SHARED_SCOPE = "Calendars.ReadWrite.Shared"


def configured() -> bool:
    cfg = get_settings()
    return bool(cfg.microsoft_client_id and cfg.microsoft_client_secret)


def redirect_uri() -> str:
    return (
        get_settings().public_base_url.rstrip("/") + "/api/accounts/microsoft/callback"
    )


def authority(shared: bool) -> str:
    # The Shared write scope is an organizational scope; don't send personal
    # Hotmail users to an authorization request they cannot consent to.
    return "organizations" if shared else "common"


def scopes(shared: bool) -> list[str]:
    return [*SCOPES, *([SHARED_SCOPE] if shared else [])]


def challenge(verifier: str) -> str:
    return (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )


def build_auth_url(state: str, verifier: str, shared: bool) -> str:
    return str(
        httpx.URL(
            f"{LOGIN}/{authority(shared)}/oauth2/v2.0/authorize",
            params={
                "client_id": get_settings().microsoft_client_id,
                "response_type": "code",
                "response_mode": "query",
                "redirect_uri": redirect_uri(),
                "scope": " ".join(scopes(shared)),
                "state": state,
                "code_challenge": challenge(verifier),
                "code_challenge_method": "S256",
                "prompt": "select_account",
            },
        )
    )


def _tokens(data: dict, shared: bool = False) -> dict:
    try:
        response = httpx.post(
            f"{LOGIN}/{authority(shared)}/oauth2/v2.0/token",
            data={
                "client_id": get_settings().microsoft_client_id,
                "client_secret": get_settings().microsoft_client_secret,
                **data,
            },
            timeout=30,
        )
    except httpx.HTTPError:
        raise ProviderError(
            503, "Microsoft sign-in is temporarily unavailable. Try again."
        ) from None
    if response.status_code >= 400:
        # Never persist/print raw OAuth responses: they may contain account info.
        try:
            code = response.json().get("error")
        except (ValueError, AttributeError):
            code = None
        if code in {"invalid_grant", "interaction_required", "consent_required"}:
            raise ProviderAuthError(
                "Microsoft access expired or was revoked. Reconnect this account."
            )
        if code in {"invalid_client", "unauthorized_client"}:
            raise ProviderError(
                409,
                "Microsoft app credentials are invalid or expired. Check this installation’s configuration.",
            )
        raise ProviderError(
            response.status_code, "Microsoft could not complete sign-in. Try again."
        )
    try:
        result = response.json()
        if (
            not isinstance(result.get("access_token"), str)
            or not result["access_token"]
        ):
            raise ValueError
        int(result.get("expires_in", 3600))
        return result
    except (ValueError, TypeError, AttributeError):
        raise ProviderError(
            502, "Microsoft returned an incomplete sign-in response."
        ) from None


def exchange_code(code: str, verifier: str, shared: bool) -> dict:
    tokens = _tokens(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri(),
            "code_verifier": verifier,
            "scope": " ".join(scopes(shared)),
        },
        shared,
    )
    granted = {
        s.removeprefix("https://graph.microsoft.com/")
        for s in tokens.get("scope", "").split()
    }
    if not {"User.Read", "Calendars.ReadWrite"}.issubset(granted) or (
        shared and SHARED_SCOPE not in granted
    ):
        raise ProviderAuthError(
            "Microsoft calendar permission was not granted. Reconnect and allow calendar access."
        )
    if not tokens.get("refresh_token"):
        raise ProviderAuthError(
            "Microsoft did not grant background access. Reconnect this account."
        )
    return tokens


def fetch_profile(token: str) -> tuple[str, str]:
    from .microsoft_api import MicrosoftCalendarClient

    profile = MicrosoftCalendarClient(token).request(
        "GET", "/me", params={"$select": "id,mail,userPrincipalName"}
    )
    identity = profile.get("id")
    email = profile.get("mail") or profile.get("userPrincipalName")
    if (
        not isinstance(identity, str)
        or not identity
        or not isinstance(email, str)
        or not email
    ):
        raise ProviderAuthError("Microsoft did not return an account identity.")
    return identity, email.strip().lower()


def store_tokens(account: Account, tokens: dict) -> None:
    account.access_token_enc = encrypt(tokens["access_token"])
    if tokens.get("refresh_token"):
        account.refresh_token_enc = encrypt(tokens["refresh_token"])
    account.token_expiry = utcnow() + timedelta(
        seconds=int(tokens.get("expires_in", 3600))
    )
    account.status = "active"
    account.last_error = None


def access_token_for(db: Session, account: Account) -> str:
    token = decrypt(account.access_token_enc)
    if (
        token
        and account.token_expiry
        and account.token_expiry > utcnow() + timedelta(minutes=2)
    ):
        return token
    refresh = decrypt(account.refresh_token_enc)
    try:
        if not refresh:
            raise ProviderAuthError("Reconnect Microsoft to restore calendar access.")
        # Omitting scope on refresh preserves the original consent, including
        # optional Shared access. Rotated refresh tokens must replace old ones.
        tokens = _tokens({"grant_type": "refresh_token", "refresh_token": refresh})
    except ProviderAuthError as exc:
        account.status = "needs_reauth"
        account.last_error = str(exc)
        db.commit()
        raise
    store_tokens(account, tokens)
    db.commit()
    return tokens["access_token"]
