# Auth-throttling IP attribution, 25 November 2026

## Finding and impact

The browser's same-origin Next.js gateway forwards auth requests to FastAPI.
Using `request.client.host` directly in FastAPI rate-limit buckets attributes
requests to an internal proxy, not necessarily to the browser's public IP.
One abusive browser could exhaust the shared signup, login or recovery quota
for unrelated users, and forensic investigation would have imprecise attribution.
Per-email and per-account rate limits still applied; no privilege escalation or
guest data access was established by this finding.

## Trust boundaries and fix

Railway's public edge overwrites `X-Real-IP` at the **Frontend's** public
ingress. The Next.js API gateway validates this field as an IP address and
adds `X-TicketTreat-Edge-IP` plus an HMAC-SHA256 signature over
`tt-ip-v1:<raw-ip>` to its newly constructed upstream headers. The header
pair is never accepted from a browser. FastAPI validates both the IP and the
signature with `TICKETTREAT_GATEWAY_IP_SECRET` before using the value in
rate-limit buckets. Invalid/missing signatures fall back to the directly
observed peer; forwarded IP headers alone are never trusted on the private
network or public backend ingress.

This is abuse throttling, **not authorization**. All roles, account bans,
session revocation and data-access rules remain independent of client IP.

## Deployment / rollback

1. Set the **same** randomly generated 32-byte-or-greater secret in Railway
   Frontend, API and Backend services. Do not commit or log the secret.
2. Deploy the FastAPI change first (it fails closed for legacy requests).
3. Deploy the Next.js gateway change from `dev/frontend-design` (the live
   frontend branch, independent of the backend release branch).
4. Check production login/signup flows, auth 429 behavior and service logs.

Rolling back the frontend alone returns backend rate-limit attribution to the
network peer; it does not allow forging IPs or bypassing account/session
authorization. Removing the secret from one service has the same safe
fallback. Rotate by changing all three services together.

## Tests

`PYTHONPATH=backend/src python -m unittest discover -s backend/src/tests -p 'test_*.py' -q`

The new unit tests cover valid IPv4/IPv6 signatures, spoofed `X-Real-IP`,
spoofed HMAC, malformed addresses, missing/short keys and unknown network
peers. GitHub's Postgres integration and browser E2E workflows must pass
before release.
