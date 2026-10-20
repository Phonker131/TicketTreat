# Crowdly email notifications — setup on Railway

Transactional emails for the showcase:
- Welcome immediately after manual website registration.
- Booking confirmation with QR PNG ticket after demo checkout / waitlist promotion.
- Check-in confirmation when ticket is scanned the first time.
- English, Czech, Russian and Ukrainian templates.

Provider: [Resend](https://resend.com), sent by an address such as Crowdly <no-reply@yourdomain.com>.

### Turn on real emails
1. Sign up for Resend and verify a domain you own under https://resend.com/domains.
2. Add Resend's exact DNS verification records (SPF/DKIM; DMARC recommended).
3. Generate an API key with permission to send emails.
4. In Railway project stunning-spontaneity, choose **Demo API** > **Variables**.
5. Add RESEND_API_KEY, EMAIL_FROM and EMAIL_NOTIFICATIONS_ENABLED=true, and confirm WEB_APP_URL is the actual frontend public URL.
6. Railway redeploys Demo API. Never put the API key in GitHub, frontend NEXT_PUBLIC_ variables, or this chat.

### Test
Create a NEW website account with an email you control, purchase a demo ticket, and run check-in. Check all three emails and Resend delivery logs.

### Safety and reliability
The PostgreSQL demo_email_outbox is automatically created if absent. Email tasks are queued within the relevant transaction and a Demo API background worker retries temporary errors with Resend idempotency keys. Sending does not block the user flow.

By default notifications are disabled and no old events are queued for later sending. This demo does not verify email ownership or handle bounce webhooks, so it is not yet ready for an unrestricted public launch. The Telegram bot's existing flows are unchanged.
