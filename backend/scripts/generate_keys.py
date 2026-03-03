"""
Generate secure environment variable values for MailMind.

Usage:
    python scripts/generate_keys.py

Copy the printed lines into your backend/.env file.
"""

import base64
import os
import secrets

# JWT signing secret — at least 32 chars
secret_key = secrets.token_hex(32)   # 64 hex chars → well above the 32-char minimum

# AES-256 encryption key — must decode to exactly 32 bytes
# os.urandom(32) guarantees exactly 32 bytes; base64 encodes to 44 chars
encryption_key = base64.b64encode(os.urandom(32)).decode()

print("# Paste these into backend/.env")
print(f"SECRET_KEY={secret_key}")
print(f"ENCRYPTION_KEY={encryption_key}")
