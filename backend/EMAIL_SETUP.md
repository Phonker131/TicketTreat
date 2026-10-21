# TicketTreat transactional email

Email delivery uses [Resend](https://resend.com) and an outbox persisted in PostgreSQL. Delivery is **disabled by default**. Verify your own sender domain and DNS records before enabling it.

## Environment

Configure these values on the **FastAPI server**, not in client-side `NEXT_PUBLIC_*` variables:

```dotenv
EMAIL_NOTIFICATIONS_ENABLED=false
RESEND_API_KEY=
EMAIL_FROM=
AUTH_CODE_SECRET=
WEB_APP_URL=
```

Use a random, independent `AUTH_CODE_SECRET` of at least 32 characters. `WEB_APP_URL` should be the actual HTTPS TicketTreat website. Never commit real values.

## Transactional flows

- Welcome/booking emails and QR ticket confirmations.
- Check-in confirmations and verified-account event reminders.
- Email ownership verification by one-time code.
- Password recovery by a one-time code; resets revoke all website sessions.

Reminders are service notifications, **not consent for promotional campaigns**. Handle subscription preferences and applicable legal requirements before marketing emails.

## Test before enabling in production

1. Verify sender domain, DNS records and Resend account permissions.
2. Test verification, password reset, booking, reminder and check-in emails on staging.
3. Confirm invalid/expired codes and excessive attempts are rejected.
4. Check idempotency, retry behavior, queue backlog, bounces and domain reputation.
5. Confirm that no unauthenticated user can trigger another user's ticket or recover an account using self-declared email.

See [release checklist](../docs/UNIFIED_RELEASE_GATE.md); mail configuration alone does not constitute production acceptance.
