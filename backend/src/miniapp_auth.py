"""Validation of Telegram Mini App launch data.

Use validate_init_data() on the server for every Mini App request. Never use
initDataUnsafe or a client-supplied telegram_id for authorization.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl


class MiniAppAuthError(ValueError):
    """Untrusted, malformed, or expired Telegram Mini App data."""


def validate_init_data(
    init_data: str,
    bot_token: str,
    *,
    max_age_seconds: int = 3600,
    now: int | None = None,
) -> dict[str, Any]:
    if not init_data or not bot_token:
        raise MiniAppAuthError("Missing Telegram launch data or server token")
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
        fields = dict(pairs)
        if len(fields) != len(pairs):
            raise MiniAppAuthError("Duplicate initData keys")
        supplied_hash = fields.pop("hash")
        if len(supplied_hash) != 64 or any(c not in "0123456789abcdefABCDEF" for c in supplied_hash):
            raise MiniAppAuthError("Malformed initData hash")
        auth_date = int(fields["auth_date"])
    except (KeyError, TypeError, ValueError) as exc:
        raise MiniAppAuthError("Malformed Telegram initData") from exc

    check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, supplied_hash.lower()):
        raise MiniAppAuthError("Invalid Telegram initData signature")

    current = int(time.time()) if now is None else now
    if auth_date > current + 60 or current - auth_date > max_age_seconds:
        raise MiniAppAuthError("Telegram initData has expired")

    try:
        user = json.loads(fields["user"])
        telegram_id = user["id"]
        if not isinstance(telegram_id, int) or isinstance(telegram_id, bool) or telegram_id <= 0:
            raise ValueError("Invalid user id")
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise MiniAppAuthError("Missing or invalid Telegram user") from exc
    return user
