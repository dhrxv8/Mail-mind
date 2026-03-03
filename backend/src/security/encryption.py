"""
AES-256-GCM symmetric encryption for storing sensitive values at rest.

Each encrypted value is stored as a base64-encoded blob containing:
    [12-byte nonce][ciphertext + 16-byte GCM auth tag]

The nonce is randomly generated per encryption, so encrypting the same
plaintext twice produces different ciphertexts — safe for token storage.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.config import get_settings


def _get_key() -> bytes:
    """Decode the 32-byte AES key from the base64 config value."""
    settings = get_settings()
    return base64.b64decode(settings.ENCRYPTION_KEY)


def encrypt(plaintext: str) -> str:
    """
    Encrypt *plaintext* with AES-256-GCM.

    Returns a URL-safe base64 string: nonce (12 B) + ciphertext + tag (16 B).
    Raises ValueError if plaintext is empty.
    """
    if not plaintext:
        raise ValueError("Cannot encrypt an empty string")

    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit random nonce — never reused
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("utf-8")


def decrypt(encrypted: str) -> str:
    """
    Decrypt a value produced by :func:`encrypt`.

    Raises cryptography.exceptions.InvalidTag if the ciphertext has been
    tampered with or the wrong key is used.
    """
    key = _get_key()
    aesgcm = AESGCM(key)
    raw = base64.urlsafe_b64decode(encrypted)
    nonce = raw[:12]
    ciphertext = raw[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
