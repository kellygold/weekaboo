from dataclasses import dataclass
from ..config import get_settings


@dataclass(frozen=True)
class GoogleConfig:
    client_id: str
    client_secret: str
    base_url: str

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    @property
    def redirect_uri(self) -> str:
        return f"{self.base_url.rstrip('/')}/api/accounts/google/callback"


def load(db=None) -> GoogleConfig:
    cfg = get_settings()
    return GoogleConfig(cfg.google_client_id, cfg.google_client_secret, cfg.public_base_url)
