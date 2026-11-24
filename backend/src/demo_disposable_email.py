"""Reject disposable email domains when creating new TicketTreat accounts.

Keep this separate from normalizing/looking up email: existing users must still
be able to sign in, recover access, or appeal a false positive. The bundled
CC0 list is read locally, so signup does not depend on a third-party API.
"""
from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException


LIST_PATH = Path(__file__).parent / "data" / "disposable_email_blocklist.conf"


def _domain(value: str) -> str:
    """Canonical domain; never match arbitrary substrings like 'mail.tm.test'."""
    candidate = value.strip().casefold().rstrip(".")
    try:
        return candidate.encode("idna").decode("ascii")
    except UnicodeError:
        return ""


@lru_cache(maxsize=1)
def _bundled_domains() -> frozenset[str]:
    with LIST_PATH.open(encoding="utf-8") as file:
        return frozenset(_domain(line) for line in file if line.strip() and not line.startswith("#"))


def _configured_domains(variable: str) -> frozenset[str]:
    return frozenset(_domain(item) for item in re.split(r"[,;\s]+", os.getenv(variable, "")) if item)


def is_disposable_email(email: str) -> bool:
    domain = _domain(email.rsplit("@", 1)[-1])
    if not domain:
        return False  # Email-format validation remains the caller's job.
    allowed = _configured_domains("SIGNUP_EMAIL_DOMAIN_ALLOWLIST")
    if domain in allowed:
        return False
    blocked_extra = _configured_domains("SIGNUP_EMAIL_DOMAIN_BLOCKLIST_EXTRA")
    known = _bundled_domains()
    # Match the domain or its subdomains, but not lookalikes or parent domains.
    labels = domain.split(".")
    return any((suffix := ".".join(labels[index:])) in known or suffix in blocked_extra
               for index in range(len(labels)))


def require_signup_email_allowed(normalized_email: str) -> None:
    try:
        blocked = is_disposable_email(normalized_email)
    except OSError:
        # Never silently disable the signup filter if deployment omitted data.
        raise HTTPException(503, "signup_email_filter_unavailable") from None
    if blocked:
        raise HTTPException(422, "disposable_email_not_allowed")
