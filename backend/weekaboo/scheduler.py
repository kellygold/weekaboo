"""One serialized sync worker; API mutations share its write lock."""
import asyncio
import contextlib
import logging
from .config import get_settings
from .storage import SessionLocal, write_lock
from .integrations import sync_engine
from .integrations.pullsignal import register_pull_signal
from .integrations.pushqueue import register_push_signal

log = logging.getLogger(__name__)


def run_sync(pull: bool = True):
    with write_lock, SessionLocal() as db:
        pushed = sync_engine.push_pending(db)
        pulled = sync_engine.pull_all(db) if pull else 0
        return {"pushed": pushed, "pulled": pulled}


async def worker(signal: asyncio.Event):
    loop = asyncio.get_running_loop()
    next_pull = 0.0
    while True:
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(signal.wait(), get_settings().push_interval_seconds)
        forced = signal.is_set()
        signal.clear()
        try:
            pull = forced or loop.time() >= next_pull
            await asyncio.to_thread(run_sync, pull)
            if pull:
                next_pull = loop.time() + get_settings().sync_interval_seconds
        except Exception:
            log.exception("Calendar synchronization failed; will retry")


def start():
    if not get_settings().sync_enabled:
        return None
    loop = asyncio.get_running_loop()
    signal = asyncio.Event()
    register_pull_signal(signal, loop)
    register_push_signal(signal, loop)
    return asyncio.create_task(worker(signal))
