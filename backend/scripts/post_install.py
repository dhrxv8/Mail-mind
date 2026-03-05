"""
Post-install helper — prints next-step instructions after dependencies are installed.

Usage:
    python scripts/post_install.py
"""

print()
print("  MailMind ready — run docker-compose up -d")
print()
print("  Next steps:")
print("  1. Copy .env.production.example → .env and fill in values")
print("  2. python scripts/generate_keys.py   # generate SECRET_KEY + ENCRYPTION_KEY")
print("  3. alembic upgrade head              # apply all DB migrations")
print("  4. uvicorn main:app --reload         # start the API")
print()