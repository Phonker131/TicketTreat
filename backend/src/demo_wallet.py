"""Apple Wallet event passes. Requires a real Apple Pass Type ID signing certificate.

No unsigned/fake .pkpass is ever served. Wallet QR uses the exact TicketTreat
scanner payload, and ticket ownership is checked by the caller before signing.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import zipfile
from datetime import timezone
from zoneinfo import ZoneInfo

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7
from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageFont


def _pem(name: str) -> bytes:
    return os.getenv(name, "").replace("\\n", "\n").strip().encode("utf-8")


def configured() -> bool:
    required = ("APPLE_WALLET_PASS_TYPE_ID", "APPLE_WALLET_TEAM_ID",
                "APPLE_WALLET_CERT_PEM", "APPLE_WALLET_KEY_PEM",
                "APPLE_WALLET_WWDR_PEM")
    return all(os.getenv(name, "").strip() for name in required)


def _draw_icon(size: int) -> bytes:
    im = Image.new("RGB", (size, size), "#ff5533")
    draw = ImageDraw.Draw(im)
    border = max(1, size // 14)
    draw.rounded_rectangle((border, border, size-border-1, size-border-1),
                           radius=max(2, size//5), outline="#15141f", width=border)
    # Draw the actual brand initials, rather than a non-functional placeholder.
    font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "TT", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size-tw)/2, (size-th)/2-bbox[1]), "TT", font=font, fill="#15141f")
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def _draw_logo() -> bytes:
    im = Image.new("RGBA", (320, 100), (0,0,0,0))
    draw = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    draw.rounded_rectangle((0, 0, 319, 99), radius=16, fill="#ff5533")
    draw.text((18, 40), "TICKETTREAT", fill="#15141f", font=font)
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def _signing_material():
    if not configured():
        raise HTTPException(503, "wallet_not_configured")
    try:
        cert = x509.load_pem_x509_certificate(_pem("APPLE_WALLET_CERT_PEM"))
        wwdr = x509.load_pem_x509_certificate(_pem("APPLE_WALLET_WWDR_PEM"))
        key = serialization.load_pem_private_key(_pem("APPLE_WALLET_KEY_PEM"), password=None)
        if not hasattr(key, "sign"):
            raise ValueError("invalid signing key")
        # Reject a key which does not belong to the supplied pass certificate.
        if (key.public_key().public_bytes(serialization.Encoding.DER,
             serialization.PublicFormat.SubjectPublicKeyInfo) !=
            cert.public_key().public_bytes(serialization.Encoding.DER,
             serialization.PublicFormat.SubjectPublicKeyInfo)):
            raise ValueError("certificate key mismatch")
    except (ValueError, TypeError) as exc:
        raise HTTPException(503, "wallet_signing_material_invalid") from exc
    return cert, wwdr, key


def build_pass(ticket, event) -> bytes:
    if ticket.ticket_status != "active" or event is None or event.is_cancelled:
        raise HTTPException(409, "ticket_not_active")
    cert, wwdr, key = _signing_material()
    pass_type = os.environ["APPLE_WALLET_PASS_TYPE_ID"].strip()
    team = os.environ["APPLE_WALLET_TEAM_ID"].strip()
    if not pass_type.startswith("pass.") or not team:
        raise HTTPException(503, "wallet_signing_material_invalid")

    starts = event.starts_at
    if starts is not None and starts.tzinfo is None:
        starts = starts.replace(tzinfo=ZoneInfo("Europe/Prague"))
    start_iso = starts.isoformat() if starts is not None else None
    code = str(ticket.code)[:80]
    label = str(event.title or "TicketTreat event")[:100]
    content = {
        "formatVersion": 1,
        "passTypeIdentifier": pass_type,
        "teamIdentifier": team,
        "serialNumber": f"tickettreat-{ticket.id}",
        "organizationName": "TicketTreat",
        "description": label,
        "logoText": "TICKETTREAT",
        "backgroundColor": "rgb(21,20,31)",
        "foregroundColor": "rgb(255,255,255)",
        "labelColor": "rgb(244,180,0)",
        "sharingProhibited": True,
        "eventTicket": {
            "primaryFields": [{"key":"event", "label":"EVENT", "value":label}],
            "secondaryFields": ([{"key":"date","label":"DATE","value":start_iso,
                                  "dateStyle":"PKDateStyleMedium","timeStyle":"PKDateStyleShort"}]
                                if start_iso else []),
            "auxiliaryFields": [{"key":"ticket","label":"TICKET","value":code}],
            "backFields": [{"key":"venue","label":"VENUE",
                            "value":str(event.location or "Czechia")[:180]},
                           {"key":"policy","label":"ENTRY",
                            "value":"Present this QR code at the entrance. Cancelled tickets are invalid."}],
        },
        "barcodes": [{
            "format":"PKBarcodeFormatQR",
            "message":f"TICKETTREAT:TICKET:{ticket.qr_token}",
            "messageEncoding":"iso-8859-1",
            "altText":code
        }]
    }
    if start_iso:
        content["relevantDate"] = start_iso

    resources = {
        "pass.json": json.dumps(content, ensure_ascii=False, separators=(",",":")).encode("utf-8"),
        "icon.png": _draw_icon(29),
        "icon@2x.png": _draw_icon(58),
        "logo.png": _draw_logo(),
        "logo@2x.png": _draw_logo(),
    }
    manifest = json.dumps({name:hashlib.sha1(data).hexdigest()
                           for name,data in resources.items()}, separators=(",",":")).encode()
    signature = (pkcs7.PKCS7SignatureBuilder().set_data(manifest)
        .add_signer(cert, key, hashes.SHA256()).add_certificate(wwdr)
        .sign(serialization.Encoding.DER,
              [pkcs7.PKCS7Options.DetachedSignature,pkcs7.PKCS7Options.Binary]))
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in resources.items():
            zf.writestr(name, data)
        zf.writestr("manifest.json", manifest)
        zf.writestr("signature", signature)
    return archive.getvalue()
