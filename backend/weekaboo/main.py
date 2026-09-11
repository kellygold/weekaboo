import asyncio
import contextlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import scheduler
from .api import accounts, calendars, events, microsoft_accounts
from .config import get_settings
from .errors import register_error_handlers
from .storage import get_db, initialize
from .integrations.google_config import load
from .integrations import microsoft_oauth
from .integrations.pullsignal import request_pull
from .integrations import sync_engine
from .models import Calendar, Event
from .serializers import calendar_out
from sqlalchemy import select, func


@asynccontextmanager
async def lifespan(app):
    initialize()
    task = scheduler.start()
    try:
        yield
    finally:
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Weekaboo", version="0.1.0", lifespan=lifespan,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
origins = {"http://localhost:8080", "http://127.0.0.1:8080", get_settings().frontend_url.rstrip("/")}


@app.middleware("http")
async def browser_boundary(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in origins:
        return JSONResponse({"error": {"message": "Origin not allowed"}}, status_code=403)
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("sec-fetch-site") == "cross-site":
        return JSONResponse({"error": {"message": "Cross-site request blocked"}}, status_code=403)
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


register_error_handlers(app)
for router in [accounts.router, microsoft_accounts.router, calendars.router, events.router]:
    app.include_router(router, prefix="/api")


@app.get("/api/health")
def health():
    return {"app": "weekaboo", "version": "0.1.0", "storage": "weekaboo"}


@app.get("/api/setup")
def setup():
    return {"google_configured": load().configured, "microsoft_configured": microsoft_oauth.configured(), "icloud_available": True}


@app.post("/api/sync")
def sync():
    request_pull()
    return {"status": "requested"}


@app.get("/api/sync/status")
def sync_status(db=Depends(get_db)):
    return {"pending_pushes": db.scalar(select(func.count()).select_from(Event).where(Event.sync_state != "synced")),
            "calendars": [calendar_out(c) for c in db.scalars(select(Calendar))]}


@app.post("/api/sync/run")
def sync_run(db=Depends(get_db)):
    before = db.scalar(select(func.count()).select_from(Calendar))
    pushed = sync_engine.push_pending(db)
    pulled = sync_engine.pull_all(db)
    after = db.scalar(select(func.count()).select_from(Calendar))
    return {"pushed": pushed, "pulled": pulled, "new_calendars": after - before}


@app.post("/api/sync/calendars")
def discover(db=Depends(get_db)):
    new = sync_engine.discover_all(db)
    return {"new_calendars": new, "total_calendars": db.scalar(select(func.count()).select_from(Calendar))}


static = Path(__file__).resolve().parents[2] / "dist"
if (static / "assets").is_dir():
    # Vite keeps public assets outside its hashed /assets bundle. Serve the
    # mascot, audio and fonts as files when using the built app, too.
    for directory in ("assets", "brand", "fonts"):
        if (static / directory).is_dir():
            app.mount(f"/{directory}", StaticFiles(directory=static / directory), name=directory)

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            return JSONResponse({"error": {"message": "Unknown endpoint"}}, status_code=404)
        return FileResponse(static / "index.html", headers={"Cache-Control": "no-cache"})
