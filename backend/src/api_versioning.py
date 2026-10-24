"""Versioned public TicketTreat API routes, with backward compatibility.

The existing /demo/* paths are persisted in old app versions, Telegram links
and tests. New clients use /api/v1/* while *all* authorization, tenancy,
rate-limit and security header middleware continues to run against the original
route handler after a shallow ASGI path translation.
"""
from __future__ import annotations

from typing import Callable


class TicketTreatApiVersioning:
    """Translate only the fixed /api/v1/ prefix; never redirect user requests.

    Install as FastAPI's outermost application middleware after all HTTP
    middlewares are registered, so authentication cannot be bypassed by the
    difference in public prefixes.
    """
    def __init__(self, app: Callable):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api/v1/"):
                canonical = "/demo/" + path[len("/api/v1/"):]
                scope = {**scope, "path": canonical, "raw_path": canonical.encode("utf-8")}
        await self.app(scope, receive, send)
