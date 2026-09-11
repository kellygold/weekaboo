# Portions adapted from Mantel, MIT © 2026 Mantel contributors. See licenses/Mantel-MIT.txt.
"""Which provider serves which linked account."""

from sqlalchemy.orm import Session

from ...models import Account
from ...config import get_settings
from ..google_oauth import access_token_for
from .base import CalendarProvider, ProviderAuthError, ProviderError
from .google import GoogleProvider

DEFAULT_TIMEZONE = "UTC"


def for_account(db: Session, account: Account) -> CalendarProvider:
    """Build a provider explicitly; unsupported accounts cannot block other accounts."""
    if account.provider == "icloud":
        from .. import icloud_auth
        from .icloud import ICloudProvider

        client = icloud_auth.client_for(account)
        home = icloud_auth.calendar_home_for(db, account, client)
        return ICloudProvider(client, home, _home_timezone(db))
    if account.provider == "google":
        return GoogleProvider(access_token_for(db, account))
    if account.provider == "microsoft":
        from .. import microsoft_oauth
        from .microsoft import MicrosoftProvider
        if account.status == "needs_reauth":
            raise ProviderAuthError("Reconnect Microsoft to restore calendar access.")
        return MicrosoftProvider(microsoft_oauth.access_token_for(db, account))
    raise ProviderError(400, "Unsupported calendar provider")


def _home_timezone(db: Session) -> str:
    return get_settings().timezone


def validate_event(provider: str, event, previous=None) -> None:
    """Check provider restrictions before queuing a local edit; never makes I/O."""
    if provider == "microsoft":
        from .microsoft import validate_event as validate_microsoft
        validate_microsoft(event, previous)
