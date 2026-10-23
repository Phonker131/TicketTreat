"""Regression tests for TicketTreat's outbound Resend transport.

Run: python -m pytest backend/tests/test_resend_transport.py
No network access or actual API keys are required.
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.error
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from demo_email import EmailDeliveryError, _send_resend


@pytest.fixture
def configured_resend():
    with patch.dict(os.environ, {"RESEND_API_KEY": "re_test_only"}):
        yield


def _sample_payload():
    return {
        "from": "TicketTreat <no-reply@tickettreat.eu>",
        "to": ["test@example.com"],
        "subject": "Integration test",
        "text": "No email should actually be sent.",
    }


def test_post_has_explicit_user_agent_and_returns_provider_id(configured_resend):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, count=-1):
            return b'{"id":"accepted-test-message"}'

    with patch("demo_email.urllib.request.urlopen", return_value=FakeResponse()) as urlopen:
        assert _send_resend(_sample_payload(), "test-success") == "accepted-test-message"
        request = urlopen.call_args.args[0]
        assert request.get_header("User-agent").startswith("TicketTreat-Mailer/1.0")
        assert request.get_header("Accept") == "application/json"
        assert request.get_header("Authorization") == "Bearer re_test_only"
        assert request.get_header("Idempotency-key").startswith("tickettreat-")


def test_cloudflare_edge_rejection_is_classified_without_leaking_body(configured_resend):
    error = urllib.error.HTTPError(
        "https://api.resend.com/emails", 403, "Forbidden",
        {"Content-Type": "text/plain"}, io.BytesIO(b"error code: 1010"),
    )
    with patch("demo_email.urllib.request.urlopen", side_effect=error):
        with pytest.raises(EmailDeliveryError) as raised:
            _send_resend(_sample_payload(), "test-cloudflare")
    assert str(raised.value) == "resend_http_403_edge_bot_signature_block"
    assert raised.value.permanent is True


def test_provider_domain_rejection_is_classified_without_logging_raw_message(configured_resend):
    provider_error = {
        "name": "validation_error",
        "message": "The example.org domain is not verified. Please verify the sender domain.",
    }
    error = urllib.error.HTTPError(
        "https://api.resend.com/emails", 403, "Forbidden",
        {"Content-Type": "application/json"},
        io.BytesIO(json.dumps(provider_error).encode("utf-8")),
    )
    with patch("demo_email.urllib.request.urlopen", side_effect=error):
        with pytest.raises(EmailDeliveryError) as raised:
            _send_resend(_sample_payload(), "test-domain")
    assert str(raised.value) == "resend_http_403_sender_domain_not_authorized"
    assert "example.org" not in str(raised.value)
