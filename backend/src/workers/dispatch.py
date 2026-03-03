"""
arq Redis pool — FastAPI dependency.

The pool is created once at application startup via the ``lifespan``
context manager in ``main.py`` and stored on ``app.state.arq_redis``.

Route handlers access it with::

    arq = Depends(get_arq_pool)
    await arq.enqueue_job("job_name", arg1, arg2)
"""

from fastapi import Request


async def get_arq_pool(request: Request):
    """Yield the shared arq Redis pool attached to the app state."""
    return request.app.state.arq_redis
