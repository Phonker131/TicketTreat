"""Spoof-resistance and fallback behavior for gateway-provided rate-limit IPs."""
import hashlib
import hmac
import os
import unittest
from unittest.mock import patch

from starlette.requests import Request

from demo_client_ip import source_ip


SECRET = "this-is-a-64-character-secret-for-test-only-and-not-for-production!!!"


def _request(headers=None, peer="10.3.2.1"):
    return Request({
        "type": "http",
        "method": "GET",
        "path": "/demo/auth/login",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "client": (peer, 12345),
    })


def _signed(ip):
    signature = hmac.new(SECRET.encode(), f"tt-ip-v1:{ip}".encode(), hashlib.sha256).hexdigest()
    return {"x-tickettreat-edge-ip": ip, "x-tickettreat-edge-signature": signature}


class ClientIpTest(unittest.TestCase):
    def test_valid_signed_external_ip(self):
        with patch.dict(os.environ, {"TICKETTREAT_GATEWAY_IP_SECRET": SECRET}):
            self.assertEqual(source_ip(_request(_signed("24.133.244.97"))), "24.133.244.97")

    def test_valid_ipv6_normalized(self):
        with patch.dict(os.environ, {"TICKETTREAT_GATEWAY_IP_SECRET": SECRET}):
            self.assertEqual(source_ip(_request(_signed("2001:0db8::0001"))), "2001:db8::1")

    def test_forged_identity_and_headers_not_trusted(self):
        with patch.dict(os.environ, {"TICKETTREAT_GATEWAY_IP_SECRET": SECRET}):
            self.assertEqual(source_ip(_request({"x-real-ip": "8.8.8.8", "x-forwarded-for": "8.8.8.8"})), "10.3.2.1")
            self.assertEqual(source_ip(_request({"x-tickettreat-edge-ip": "8.8.8.8", "x-tickettreat-edge-signature": "0"*64})), "10.3.2.1")
            forged = _signed("8.8.8.8")
            forged["x-tickettreat-edge-ip"] = "9.9.9.9"
            self.assertEqual(source_ip(_request(forged)), "10.3.2.1")

    def test_invalid_ip_falls_back_even_with_matching_signature(self):
        with patch.dict(os.environ, {"TICKETTREAT_GATEWAY_IP_SECRET": SECRET}):
            self.assertEqual(source_ip(_request(_signed("not-an-ip"))), "10.3.2.1")

    def test_missing_or_short_secret_is_safe(self):
        with patch.dict(os.environ, {"TICKETTREAT_GATEWAY_IP_SECRET": "short"}):
            self.assertEqual(source_ip(_request(_signed("8.8.8.8"))), "10.3.2.1")
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(source_ip(_request(_signed("8.8.8.8"))), "10.3.2.1")

    def test_missing_peer_safe(self):
        req = _request()
        req.scope.pop("client")
        self.assertEqual(source_ip(req), "unknown")


if __name__ == "__main__":
    unittest.main()
