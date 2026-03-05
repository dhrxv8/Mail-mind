import logging
import time
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.accounts.router import router as accounts_router
from src.ai.router import router as ai_router
from src.auth.router import router as auth_router
from src.billing.router import router as billing_router
from src.config import get_settings
from src.gmail.router import router as gmail_router
from src.inbox.router import emails_router, router as inbox_router
from src.insights.router import router as insights_router
from src.memory.router import router as memory_router
from src.settings.router import router as settings_router
from src.users.router import router as users_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)
settings = get_settings()
_startup_time = time.time()

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create the shared arq Redis pool on startup; close it on shutdown."""
    pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    app.state.arq_redis = pool
    log.info("MailMind API started (env=%s)", settings.APP_ENV)
    yield
    await pool.close()
    log.info("MailMind API shutdown")


app = FastAPI(
    title="MailMind API",
    version="1.0.0",
    description="Personal AI Memory Engine — backend API",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handlers ─────────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return a structured 422 instead of FastAPI's verbose default."""
    errors = [
        {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation failed", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions — log safely, return 500."""
    log.exception(
        "Unhandled error on %s %s: %s",
        request.method,
        request.url.path,
        type(exc).__name__,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(accounts_router)
app.include_router(gmail_router)
app.include_router(memory_router)
app.include_router(ai_router)
app.include_router(inbox_router)
app.include_router(emails_router)
app.include_router(insights_router)
app.include_router(billing_router)
app.include_router(settings_router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health_check():
    uptime_s = round(time.time() - _startup_time)
    redis_ok = False
    try:
        await app.state.arq_redis.ping()
        redis_ok = True
    except Exception:
        log.debug("Redis health check failed", exc_info=True)
    return {
        "status": "ok",
        "version": "1.0.0",
        "env": settings.APP_ENV,
        "uptime_seconds": uptime_s,
        "redis": "ok" if redis_ok else "degraded",
    }
