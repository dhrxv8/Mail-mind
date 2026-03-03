# MailMind

Your AI email assistant that actually knows you.

Connect multiple Gmail accounts, bring your own AI key (Claude, GPT, Grok, or Gemini), and build a personal memory layer that compounds over time.

---

## Quick Start (Local)

```bash
# 1. Clone the repo
git clone https://github.com/dhrxv8/Mail-mind.git
cd Mail-mind

# 2. Backend — install deps & generate secrets
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/generate_keys.py   # prints SECRET_KEY + ENCRYPTION_KEY
cp .env.production.example .env   # paste generated keys + fill remaining values

# 3. Run DB migrations
alembic upgrade head

# 4. Start the API
uvicorn main:app --reload --port 8000

# 5. Frontend — open a second terminal
cd ../frontend
npm install                       # required before first run or after pulling changes
npm run dev
# → http://localhost:5173
```

> **Note:** Always run `npm install` in `/frontend` before `npm run dev` or `npm run build`,
> especially after pulling new commits that added or updated packages.

---

## Features

- **Multi-account Gmail inbox** — student, personal, and work Gmail in one unified view
- **Living email memory** — vector embeddings of your email history so AI knows your world
- **Bring Your Own AI key** — Claude, GPT-4, Grok, or Gemini; zero AI inference markup
- **AI inbox triage** — emails auto-labelled Urgent / Action Required / FYI
- **Daily briefing** — AI-generated morning summary of what matters today
- **Draft reply** — one-click AI draft suggestions for any email
- **Stripe billing** — Free tier (2 accounts, 30-day depth) and Pro ($6/mo)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, arq (async task queue) |
| Database | PostgreSQL 15 |
| Cache / Queue | Redis 7 |
| AI | Pluggable: Anthropic, OpenAI, xAI, Google (BYOAI) |
| Gmail | Google Gmail API v1, Cloud Pub/Sub (real-time push) |
| Billing | Stripe Checkout + Customer Portal |
| Frontend | React 18, Vite, Tailwind CSS 3, React Router 6 |
| Auth | Google OAuth 2.0, JWT (HS256) |

---

## Environment Variables

See `backend/.env.production.example` for the full list.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (used by arq too) |
| `SECRET_KEY` | JWT signing secret (min 32 chars) |
| `ENCRYPTION_KEY` | 32-byte base64 AES-256 key — see Troubleshooting |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO` | Stripe Price ID for the Pro monthly plan |
| `PUBSUB_TOPIC` | Google Cloud Pub/Sub topic for Gmail push |
| `ENCRYPTION_KEY` | 32-byte base64 key — generate with `scripts/generate_keys.py` |

---

## Database Migrations

```bash
alembic upgrade head     # apply all pending migrations
alembic downgrade -1     # roll back one step
alembic revision --autogenerate -m "description"   # create a new migration
```

Migration chain: `001_initial_schema` → `002` → `003` → `004` → `005_billing_byoai`

---

## Background Workers

The arq worker handles email sync jobs and memory chunking:

```bash
cd backend
python -m src.workers.main
```

In production, deploy this as a separate Railway service (same repo, different start command).

---

## Deployment

### Backend → Railway

1. Create a new Railway project, link this repo, set **Root Directory** to `backend/`
2. Railway auto-detects `Dockerfile` and `railway.toml` — no extra config needed
3. Add all env vars from `.env.production.example` in the Railway dashboard
4. The Dockerfile runs `alembic upgrade head` automatically before starting the server

```bash
# Or via Railway CLI
cd backend && railway up
```

### Frontend → Vercel

1. Import the repo on Vercel, set **Root Directory** to `frontend/`, **Framework** to Vite
2. Add environment variable: `VITE_API_URL=https://your-api.railway.app`
3. Click **Deploy** — Vercel runs `npm install && npm run build` automatically

### Worker → Railway (separate service)

Create a second Railway service from the same repo:
- Root directory: `backend/`
- Start command: `python -m src.workers.main`

---

## Troubleshooting

### `ENCRYPTION_KEY must decode to exactly 32 bytes`

This error means your `ENCRYPTION_KEY` env var is incorrect. Generate a valid one:

```bash
cd backend
python scripts/generate_keys.py
```

Copy the printed `ENCRYPTION_KEY=...` line into your `.env`. The key must be a base64 string
that decodes to **exactly 32 bytes** (the script uses `os.urandom(32)` to guarantee this).

**Common mistake:** hand-written keys like `"test-key-32-bytes!"` that look like they're
32 characters are not 32 *bytes* when base64-decoded. Always use the generator.

### `ModuleNotFoundError` after `git pull`

Dependencies changed. Re-install:

```bash
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

### Gmail OAuth `redirect_uri_mismatch`

The `GOOGLE_REDIRECT_URI` in your `.env` must exactly match the URI registered in
[Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.

### Stripe webhook not firing locally

Use the Stripe CLI to forward events:

```bash
stripe listen --forward-to localhost:8000/billing/webhook
```

Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET` in your `.env`.

---

## API Docs

Available in development mode (`APP_ENV=development`, the default):
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Disabled automatically when `APP_ENV=production`.

## Health Check

```
GET /health
→ {"status":"ok","version":"1.0.0","env":"development","uptime_seconds":42,"redis":"ok"}
```

---

## What's Next

- [ ] **Google OAuth verification** — submit app for Google's OAuth consent screen review to remove the "unverified app" warning for new users
- [ ] **Onboard first 10 users** — share the Vercel URL, collect feedback, watch logs
- [ ] **Custom domain** — add your domain in Vercel + Railway and update `GOOGLE_REDIRECT_URI`
- [ ] **Rate limiting** — add `slowapi` middleware to prevent abuse of the AI endpoints
- [ ] **Email notifications** — send a welcome email on sign-up (Resend or SendGrid)
- [ ] **Attachment support** — store and search email attachments in memory
- [ ] **Mobile app** — React Native / Expo shell wrapping the existing API
- [ ] **Self-hosted option** — Docker Compose file for users who want to run locally forever
