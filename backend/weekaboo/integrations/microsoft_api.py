"""Small Graph transport: fixed origin, bounded pagination, sanitized errors."""

import hashlib
import time
from urllib.parse import quote, urlparse

import httpx

from .providers.base import ProviderAuthError, ProviderError

BASE = "https://graph.microsoft.com/v1.0"
_backoff: dict[str, float] = {}


def q(value: str) -> str:
    return quote(value, safe="")


class MicrosoftCalendarClient:
    def __init__(self, token: str, http: httpx.Client | None = None):
        self.token = token
        self.http = http
        self.key = hashlib.sha256(token.encode()).hexdigest()

    def request(self, method: str, path: str, **kwargs) -> dict:
        url = path if path.startswith("https://") else BASE + path
        parsed = urlparse(url)
        # nextLink is remote input, never a license to forward bearer tokens to
        # another origin (or into a redirect). Validate every pagination hop.
        if (
            parsed.scheme != "https"
            or parsed.netloc != "graph.microsoft.com"
            or not parsed.path.startswith("/v1.0/")
            or parsed.fragment
        ):
            raise ProviderError(502, "Microsoft returned an invalid pagination link.")
        if _backoff.get(self.key, 0) > time.monotonic():
            raise ProviderError(429, "Microsoft asked us to wait before syncing again.")
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Prefer": 'outlook.timezone="UTC", IdType="ImmutableId"',
            **kwargs.pop("headers", {}),
        }
        try:
            if self.http:
                response = self.http.request(
                    method, url, headers=headers, follow_redirects=False, **kwargs
                )
            else:
                with httpx.Client(timeout=30, follow_redirects=False) as client:
                    response = client.request(method, url, headers=headers, **kwargs)
        except httpx.HTTPError:
            raise ProviderError(
                503, "Microsoft Calendar is temporarily unreachable."
            ) from None
        if response.status_code == 401:
            raise ProviderAuthError(
                "Microsoft rejected calendar access. Reconnect the account."
            )
        if response.status_code == 429:
            try:
                delay = max(
                    1, min(86400, int(response.headers.get("Retry-After", "60")))
                )
            except ValueError:
                delay = 60
            _backoff[self.key] = time.monotonic() + delay
        if response.status_code >= 300:
            messages = {
                403: "Microsoft denied access to this calendar. Check its sharing permissions.",
                404: "Microsoft could not find this event or calendar.",
                409: "The Microsoft event changed. Sync before trying again.",
                412: "The Microsoft event changed elsewhere. Sync before trying again.",
                429: "Microsoft asked us to wait before syncing again.",
            }
            raise ProviderError(
                response.status_code,
                messages.get(
                    response.status_code,
                    "Microsoft Calendar could not complete this request.",
                ),
            )
        if response.status_code == 204:
            return {}
        try:
            body = response.json()
            if not isinstance(body, dict):
                raise ValueError
            return body
        except ValueError:
            raise ProviderError(
                502, "Microsoft returned an invalid calendar response."
            ) from None

    def collection(self, path: str, params: dict | None = None) -> list[dict]:
        items = []
        seen = set()
        for _ in range(200):
            if path in seen:
                raise ProviderError(
                    502, "Microsoft repeated a calendar page; sync was not applied."
                )
            seen.add(path)
            body = self.request("GET", path, params=params)
            values = body.get("value")
            if not isinstance(values, list) or any(
                not isinstance(item, dict) for item in values
            ):
                raise ProviderError(
                    502, "Microsoft returned an incomplete calendar page."
                )
            items.extend(values)
            path = body.get("@odata.nextLink")
            if not path:
                return items
            if not isinstance(path, str) or not path.startswith(BASE + "/"):
                raise ProviderError(
                    502, "Microsoft returned an invalid pagination link."
                )
            params = None
        raise ProviderError(
            502, "Microsoft returned too many calendar pages; sync was not applied."
        )
