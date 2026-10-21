# TicketTreat — personal data retention and erasure design

**Status: pending business/legal approval.** Do not invent statutory periods or automatically remove event/financial records without reviewing Czech and EU requirements.

| Category | System location | Proposed handling | Retention duration |
| --- | --- | --- | --- |
| Active user account and contact data | `demo_web_accounts`, `demo_guests` | Retain while providing the service; process verified erasure requests | **[APPROVE]** |
| Free-event booking/attendance | `demo_tickets`, check-ins | Retain while event is active; eligible historical records may be erased | **[APPROVE]** via `PRIVACY_FREE_TICKET_RETENTION_DAYS` |
| Legacy Telegram registrations | `registrations`, `users` | Preserve until canonical reconciliation and verified retention review | **[APPROVE]** |
| Paid events/settlements | Future PSP and payment records | Legal holds, tax/accounting/consumer and dispute requirements | **[APPROVE BEFORE PSP ACTIVATION]** |
| Organizer audit / privileged actions | Event and account audit tables | Minimize personal data; protect against tampering | **[APPROVE]** |
| Transactional email metadata | `demo_email_outbox` | Keep only what is required to deliver and troubleshoot | **[APPROVE]** |
| Security logs and session metadata | Logs, `demo_web_sessions` | Rotate, aggregate, revoke and avoid PII-bearing URLs | **[APPROVE]** |
| Backups | Offsite encrypted archive | Automatic rotation, restricted access and verifiable restore | **[APPROVE]** |

## Request lifecycle

1. Authenticated account holder creates an erasure request after re-entering their password; can withdraw while pending.
2. MFA-protected global administrator reviews status and blockers, and documents a case reference.
3. Automatic fulfillment is limited to safe accounts: no owned events, no linked legacy Telegram identity requiring manual handling, no active waitlist, and no unresolved financial/retained bookings.
4. Safe fulfillment removes eligible personal and ticket information, rotates old guest tokens, revokes sessions, and pseudonymizes the account; retains an internal non-secret audit marker.
5. Blocked requests require a manual, documented decision on retention/legal holds. An automated denial is **not** the final response to the data subject.
6. Data in encrypted offsite backups is removed through approved backup expiry/rotation; application-level erasure does not instantaneously rewrite all prior backups.

## Release owner decisions required

- Confirm a lawful, specific retention period for free bookings and establish separate payment/financial periods.
- Decide what attendance reports may remain in aggregated anonymized form.
- Approve privacy notices, processor contracts, deletion-response SLAs, and data-subject communication.
- Configure actual Railway offsite backups and retention policies.
