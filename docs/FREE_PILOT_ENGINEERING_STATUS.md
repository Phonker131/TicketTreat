# TicketTreat — actual Free Pilot engineering status

**Checked 24 October 2026.** This replaces the outdated pre-deployment checklist from 21 October. Product: **TicketTreat**. Pilot geography: Czechia. Actual data is stored in Railway production PostgreSQL.

## Production infrastructure

| Component | Verified state / implementation |
| --- | --- |
| Next.js website / Telegram Mini App | Online; the frontend uses the production-facing FastAPI via an HttpOnly same-origin gateway |
| TicketTreat API | Online (Railway service was originally named `Demo API`); canonical `/api/v1/*`, with `/demo/*` compatibility |
| Legacy Backend | Online, independent server-to-server bot interface with private API key; not a public admin interface |
| Telegram Bot | Online; HTTPS webhook registered with Telegram, Telegram-secret-header checking, previous getUpdates polling conflicts avoided |
| PostgreSQL | Online; private-network-only, 0 public TCP proxies |
| Backup worker | Encrypted AES-256-GCM archives at 03:00 and 15:00 UTC into a private Railway AMS-region bucket |
| Restore | 24 October: real production encrypted archive restored and queried inside isolated PostgreSQL 18; disposable service removed |
| Monitoring | Website/API probe every 15 minutes, Railway incidents to admin Telegram chats; latest monitor run successful |
| CI | Python unit, PostgreSQL integration, production TypeScript build, Chromium browser E2E and dependency vulnerability checks |

The production backup bucket is **in the same Railway account**; this is not a full independent disaster-recovery replica. Never claim the presence of live staging: a temporary restore environment does not equal a permanent staging service.

## Features that are in the current code and deployment

- Event discovery, organizer publishing and CMS event/gallery content, protected QR tickets and check-in, attendance/insights, staff and organizer permissions, admin MFA.
- Website account login/verification, Google OAuth, Telegram Mini App signed login, linking an existing Telegram identity to web identity.
- Free registration, waitlist and timed offer mechanisms; offer-expiry and reservation-expiry workers enabled in the **single-replica** production API.
- Direct-to-organizer **external payment confirmation** on paid-reservation requests. The platform does not accept, settle or refund payments.
- Support tickets and replies by email, event cancellations/reminders and outbound Telegram/email queues.
- Per-organizer quarterly loyalty passports: levels 0 / 3 / 6 / 12 confirmed check-ins. 3-visit waitlist priority operates; early booking, extra VIP guest and gifts are **not yet live**.
- Apple Wallet pass support subject to signing credentials; user-facing multilang includes Czech, English, Russian and Ukrainian, with remaining content localisation to verify.
- GDPR request/cookie controls exist technically; they require final operator details and legally approved data-retention policy before open launch.

## Remaining launch gates — not confirmed done

1. Real device smoke test: Google login, existing Telegram bot link, ticket purchase-free checkout, wallet pass, QR scan and duplicate scan, cancellation and email+bot delivery.
2. Group event rehearsal: 10–20 volunteers, simultaneous final-seat registrations/check-ins, staff scanner access, cancellation and poor mobile connectivity recovery.
3. Final controller/operator contact details, privacy notice and contractual processor arrangements — outside this technical release; no false claims of compliance.
4. Owner-controlled backup encryption-key escrow, proper retention/deletion policy and alerts for missed backup schedules; preferably a second-provider backup copy.
5. Long-lived **staging** environment with a separate database, test bot token and disabled real outbound messaging.
6. Monitor resources and test Telegram webhook delivery on a real phone; Railway status alone is not enough.

**Not a launch requirement for the free pilot:** built-in card payments, subscription billing, VIP gifts, multi-studio loyalty network, advanced CRM and separate native apps.

## Production API compatibility policy

New clients should use `/api/v1/*`, gateway `/api/gateway/api/v1/*`. Keep old `/demo/*` and `/api/gateway/demo/*` routes while old Telegram, QR and stored media URLs exist. The legacy `DEMO_ISOLATED_API` and database-model identifiers remain deliberately for stable migrations/configuration; do not mass-rename SQL tables or erase compatibility headers.

See [operations](PRODUCTION_OPERATIONS.md), [release gate](UNIFIED_RELEASE_GATE.md) and [organizer guide](PILOT_ORGANIZER_GUIDE.md).
