"""Verified browser IP for abuse throttling across the public Next.js gateway.

The backend can also be called directly and via Railway private networking.
Never trust arbitrary X-Forwarded-For / X-Real-IP headers here: an internal
caller could spoof them. Only the public gateway may sign the edge IP.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import os

from fastapi import Request


def source_ip(request: Request) -> str:
    """Return an authenticated gateway client IP or the network peer IP.

    Missing/misconfigured credentials fail closed to the peer rather than
    accepting an attacker-controlled forwarding header.
    """
    peer = request.client.host if request.client else "unknown"
    secret = os.getenv("TICKETTREAT_GATEWAY_IP_SECRET", "")
    claimed_ip = request.headers.get("x-tickettreat-edge-ip", "")
    supplied_signature = request.headers.get("x-tickettreat-edge-signature", "")
    if len(secret) < 32 or not claimed_ip or len(claimed_ip) > 45:
        return peer
    if len(supplied_signature) != 64:
        return peer
    try:
        normalized = str(ipaddress.ip_address(claimed_ip))
    except ValueError:
        return peer
    expected = hmac.new(
        secret.encode("utf-8"), f"tt-ip-v1:{claimed_ip}".encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, supplied_signature):
        return peer
    return normalized
