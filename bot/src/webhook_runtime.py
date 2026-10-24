"""Authenticated Telegram Bot API webhook for the TicketTreat bot.

The shared bot token is never exposed in URLs or logs. Telegram's secret-token
header is checked before JSON parsing or running any existing handlers.
"""
from __future__ import annotations

import hmac
import json
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

MAX_UPDATE_BYTES = 1024 * 1024


def webhook_app(bot, *, url: str, secret: str) -> FastAPI:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("BOT_WEBHOOK_URL must be a public HTTPS URL without credentials")
    if not 32 <= len(secret) <= 256 or any(not (c.isalnum() and c.isascii() or c in "_-") for c in secret):
        raise ValueError("BOT_WEBHOOK_SECRET must contain 32-256 ASCII letters, numbers, dashes or underscores")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # No drop_pending_updates: recover valid messages after any outage.
        registered = await run_in_threadpool(
            bot.set_webhook, url=url, secret_token=secret, drop_pending_updates=False
        )
        if registered is not True:
            raise RuntimeError("Telegram webhook registration failed")
        print("TicketTreat Telegram webhook registered", flush=True)
        yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/health")
    async def health():
        return {"status": "ready"}

    @app.post("/telegram/update")
    async def telegram_update(request: Request):
        provided = request.headers.get("x-telegram-bot-api-secret-token", "")
        if not hmac.compare_digest(provided, secret):
            raise HTTPException(status_code=403, detail="forbidden")
        if int(request.headers.get("content-length", "0") or 0) > MAX_UPDATE_BYTES:
            raise HTTPException(status_code=413, detail="update_too_large")
        raw = await request.body()
        if len(raw) > MAX_UPDATE_BYTES:
            raise HTTPException(status_code=413, detail="update_too_large")
        try:
            payload = json.loads(raw)
            if not isinstance(payload, dict) or not isinstance(payload.get("update_id"), int):
                raise ValueError("invalid update envelope")
            from telebot.types import Update
            update = Update.de_json(raw.decode("utf-8"))
        except (ValueError, TypeError, UnicodeDecodeError):
            raise HTTPException(status_code=400, detail="invalid_telegram_update") from None
        # Preserve all current bot handlers. Their backend state-changing
        # operations are protected by existing account/capacity checks.
        await run_in_threadpool(bot.process_new_updates, [update])
        return {"ok": True}

    return app
