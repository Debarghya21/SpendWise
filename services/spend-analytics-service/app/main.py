import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.consumers.po_consumer import consumer
from app.db import ensure_indexes, get_db
from app.routes.analytics import router as analytics_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("analytics")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        ensure_indexes(get_db())
    except Exception as exc:  # noqa: BLE001 - Mongo may still be starting; readiness probe covers it
        log.warning("Could not create indexes yet: %s", exc)
    if config.CONSUMER_ENABLED:
        consumer.start()
    yield
    consumer.stop()


app = FastAPI(
    title="SpendWise Spend Analytics Service",
    version="1.0.0",
    description="Consumes purchase-order events and serves spend analytics.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(analytics_router)


@app.get("/health", tags=["health"])
def health():
    return {
        "status": "UP",
        "service": "spend-analytics-service",
        "messaging": consumer.state,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["health"])
def ready():
    try:
        get_db().command("ping")
        return {"status": "READY"}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=503, content={"status": "NOT_READY", "error": str(exc)})
