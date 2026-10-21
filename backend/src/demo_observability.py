"""Privacy-aware, structured ASGI request logs for Railway.

Only route templates are logged: never raw URLs because some legacy paths
contain bearer guest/QR tokens. No request bodies, user emails or headers.
"""
from __future__ import annotations
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
        status=500
        try:
            response=await call_next(request)
            status=response.status_code
            response.headers["X-Request-ID"]=request_id
            return response
        except Exception:
            LOGGER.exception(json.dumps({"event":"unhandled_exception","request_id":request_id}))
            raise
        finally:
            record={"event":"request","request_id":request_id,
                    "method":request.method,
                    "route":safe_route(request),
                    "status":status,
                    "elapsed_ms":round((time.monotonic()-started)*1000,2)}
            LOGGER.info(json.dumps(record,separators=(",",":")))
