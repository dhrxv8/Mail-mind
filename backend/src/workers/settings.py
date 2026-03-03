"""
arq worker configuration.

Start the worker:
    arq src.workers.settings.WorkerSettings

All background functions are registered here.  New jobs added each phase
are imported and appended to ``functions``.
"""

from arq import cron
from arq.connections import RedisSettings

from src.config import get_settings
from src.workers.email_sync import (
    initial_sync_job,
    initial_watch_setup,
    process_new_messages,
)
from src.workers.insights import (
    daily_insights_cron,
    daily_insights_job,
    triage_email,
)
from src.workers.memory_engine import process_email_into_memory, reprocess_user_memory
from src.workers.token_refresh import refresh_account_token, refresh_all_tokens

_settings = get_settings()


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(_settings.REDIS_URL)

    # All callable job functions the worker can execute
    functions = [
        # Phase 2 — OAuth token refresh
        refresh_account_token,
        refresh_all_tokens,
        # Phase 3 — email sync
        initial_sync_job,
        process_new_messages,
        initial_watch_setup,
        # Phase 4 — memory engine
        process_email_into_memory,
        reprocess_user_memory,
        # Phase 6 — triage + daily insights
        triage_email,
        daily_insights_job,
    ]

    # Scheduled cron jobs
    cron_jobs = [
        # Refresh Google OAuth tokens at :00 and :45 of every hour.
        # Google access tokens expire after 60 min; refreshing at 45-min
        # intervals guarantees a token is never older than ~45 min.
        cron(refresh_all_tokens, minute={0, 45}),
        # Generate daily email briefings at 08:00 UTC for all active users.
        cron(daily_insights_cron, hour=8, minute=0),
    ]

    max_jobs = 20
    job_timeout = 300   # 5 minutes per job before arq considers it failed
    keep_result = 3600  # keep job results for 1 hour (for debugging)
