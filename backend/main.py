"""
FastAPI entry-point for the Auto-ML-Builder backend.

Run with:
    cd backend && uvicorn main:app --reload --port 5000
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%I:%M:%S %p",
)
logger = logging.getLogger("mlforge")

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MLForge – Auto ML Builder API",
    description="Backend API for the no-code Machine Learning Model Builder",
    version="1.0.0",
)

# CORS – allow the Vite dev server (typically localhost:5173) and any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging (mirrors server/index.ts logger) ────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = datetime.now()
    response = await call_next(request)
    duration_ms = int((datetime.now() - start).total_seconds() * 1000)
    if request.url.path.startswith("/api"):
        logger.info(
            "%s %s %s in %dms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    return response


# ── Global exception handler ────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Internal Server Error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"},
    )


# ── Register routes ─────────────────────────────────────────────────────────
app.include_router(router)


# ── Health-check ─────────────────────────────────────────────────────────────


@app.get("/")
def health():
    return {"status": "ok", "service": "MLForge API"}
