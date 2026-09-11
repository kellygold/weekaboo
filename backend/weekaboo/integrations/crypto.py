"""Tokens stay encrypted in storage. Key creation belongs to setup, never startup."""
from cryptography.fernet import Fernet, InvalidToken
from ..config import get_settings


def encrypt(value: str | None) -> str | None:
    return Fernet(get_settings().secret_key.encode()).encrypt(value.encode()).decode() if value is not None else None


def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        return Fernet(get_settings().secret_key.encode()).decrypt(value.encode()).decode()
    except InvalidToken:
        return None
