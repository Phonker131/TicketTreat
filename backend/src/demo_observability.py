"""Privacy-aware, structured ASGI request logs for Railway.

Only route templates are logged: never raw URLs because some legacy paths
contain bearer guest/QR tokens. No request bodies, user emails or headers.
"""
from __future__ import annotations
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import logging
import time
import uuid
from fastapi import Request

LOGGER=logging.getLogger("tickettreat.requests")
if not LOGGER.handlers:
    handler=logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    LOGGER.addHandler(handler)
LOGGER.setLevel(logging.INFO)
LOGGER.propagate=False


@dataclass
class RequestActor:
    account_id: int | None = None
    guest_id: int | None = None
    session_issued: bool = False


# A separate mutable object per request also works with FastAPI's sync workers,
# which receive a copy of the calling context.
_actor: ContextVar[RequestActor | None] = ContextVar("request_actor", default=None)


def verified_account(account_id: int, *, session_issued: bool = False) -> None:
    actor = _actor.get()
    if actor is not None:
        actor.account_id = account_id
        actor.session_issued |= session_issued


def verified_guest(guest_id: int) -> None:
    actor = _actor.get()
    if actor is not None:
        actor.guest_id = guest_id


def safe_route(request: Request) -> str:
    resolved=request.scope.get("route")
    path=getattr(resolved,"path",None)
    if path:
        return path
    # If routing is unresolved (404/500), do not log the raw untrusted URL.
    return "<unresolved>"


def install_request_logging(app):
    @app.middleware("http")
    async def privacy_safe_request_log(request:Request,call_next):
        started=time.monotonic()
        request_id=uuid.uuid4().hex
        actor = RequestActor()
        context = _actor.set(actor)
        status=500
        try:
            response=await call_next(request)
            status=response.status_code
            response.headers["X-Request-ID"]=request_id
            return response
        except Exception:
            LOGGER.error(json.dumps({"event":"unhandled_exception","request_id":request_id}))
            raise
        finally:
            _actor.reset(context)
            record={"timestamp":datetime.now(timezone.utc).isoformat(), "event":"request","request_id":request_id,
                    "method":request.method,
                    "route":safe_route(request),
                    "status":status,
                    "elapsed_ms":round((time.monotonic()-started)*1000,2)}
            record.update({k: v for k, v in asdict(actor).items() if v is not None and v is not False})
            LOGGER.info(json.dumps(record,separators=(",",":")))
