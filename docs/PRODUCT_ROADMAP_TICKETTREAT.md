# TicketTreat — consolidated product roadmap

**Status:** historical planning baseline dated 2026-10-21; current shipped status verified 2026-10-24 in [engineering status](FREE_PILOT_ENGINEERING_STATUS.md). Source: user-supplied 18-page
`Crowdly-brand-and-roadmap(2).pdf` (October 2026, v1), combined with the
existing TicketTreat launch plan and audited code. The cited original PDF uses a former brand name, retained only to identify its historical source.

**Brand decision:** the product is **TicketTreat**, not Crowdly. Keep the
existing established palette. References to the old name in the original PDF
are historical only.

**Release boundary, updated:** The free-event TicketTreat platform is already deployed in Railway production. Use canonical `release/tickettreat-production` after source migration; do not enable in-platform payments or alter production data without an isolated migration rehearsal and acceptance checks.

## Live implementation reconciliation — 24 October 2026

**This section supersedes 21 October implementation columns further below.** The roadmap tables describe the original feature plan; they are not a literal live production audit.

| Roadmap workstream | Implemented now | Still not guaranteed / not enabled |
| --- | --- | --- |
| Free-event MVP | Public website, signed Telegram Mini App and bot, event publication, free QR tickets, organizer scan, cancellations, email/Telegram messages | Live group rehearsal with real phones, independent ongoing staging |
| Account identity | Email and Google login, explicit Telegram identity linking, privileged MFA, security sessions | Real-account acceptance test for each login/linking combination |
| Capacity and waitlists | Unique/locked registration, timed offers, seasonal studio waitlist priority, expiry workers active | Event-day failure playbook and measured peak-capacity load |
| Event operations | Staff scopes, owner-admin CMS, pictures/galleries, reporting, support and reminders | Final editorial localisation and real organizer training |
| Loyalty | Organizer-scoped 0/3/6/12 check-in stamps; 3-visit waitlist priority | VIP companion, early booking and birthday rewards are planned, not active |
| Externally paid events | 24-hour reservation and organizer-confirmed external payment status | No built-in payment charging, payout or refunds |
| Hosting and data | Railway production online; private DB; twice-daily AES-256-GCM backup; real isolated PostgreSQL restore validated | Off-provider DR, independent encryption-key escrow, approved retention, complete GDPR/controller details |
| API name and version | Production TicketTreat API, versioned `/api/v1/*` plus legacy `/demo/*` compatibility | Never delete compatibility paths or rename production DB tables as a cosmetic change |

The older design source used a previous brand. Its original title is cited below strictly for traceability; all product decisions and public names use **TicketTreat**.

## Scope and status vocabulary

- **Implemented / release candidate:** coded in branch, still subject to staging
  and real-device acceptance.
- **Partial:** a simpler mechanism exists, but it does not satisfy the
  complete feature described by the source roadmap.
- **Missing / to build:** not established as implemented by this audit.
- **Dependency:** needs a verified domain, PSP, legal/business approval,
  Apple/Google/third-party accounts, or production operator access.

This roadmap intentionally separates **code can be written now** from
**feature can be activated now**. A green CI run is not a live launch.

## Phase A — finish free-event pilot (P0, immediately implementable)

| ID | Item | Current state | Acceptance target |
| --- | --- | --- | --- |
| A01 | Event lifecycle: draft → preview → scheduled publishing → published → ended / canceled | Missing | Only published events are visible/bookable; organizer can prepare content without accidental release |
| A02 | Copy an existing event ("Копировать прошлый") | Missing | All content, place, limits, photo references prefilled; new time/ID, no copied attendees |
| A03 | Event publishing validations | Partial | Reject malformed, missing, sold-out/expired details; clear editing feedback |
| A04 | Reduce attendee signup friction to at most three actions | Partial; verified account currently needed | Audit first-time signup and mobile UX; decide on guest/magic-link identity without lowering account security |
| A05 | Passwordless email magic link and passkeys | Google OAuth exists; other methods missing | Account-linking, revocation, secure email flow/WebAuthn, MFA interactions tested |
| A06 | Event page map, calendar export, share preview | Partial event page | Venue map, .ics / add-to-calendar, Telegram/WhatsApp links, OpenGraph poster |
| A07 | Organizer-generated event link and downloadable QR / printable social poster | Missing | QR leads to event public page and exports as printable image |
| A08 | More flexible transactional reminders | Partial: 24h email + bot scheduling | Editable templates for 7d/24h/3h; safe manual event-only announcement, scheduling/rescheduling and dedup |
| A09 | Free-event waitlist: time-limited claim and timely notifications | Partial: queue + automatic promotion exist | Configurable claim deadline where needed, reallocation and tracked alerts |
| A10 | Robust mobile check-in and staff workflow | Partial: QR scan, duplicate rejection, audits | Fast scan UI, check-in-by-list with strict authorization, multi-device concurrency and real-time counters |
| A11 | Attendee check-in history as foundation for loyalty | Partial: visits field/check-ins exist | Historical per-user attendance with clear event linkage and privacy controls |
| A12 | Organizer event dashboard / KPI tracking | Partial: registrations and email status exist | Bookings over time, occupancy, waiting, attendance/no-show, acquisition source and time-to-ticket |
| A13 | Full admin UX and language consistency | Partial | Search/filter/sort, event preview, clear role/error copy, CZ/EN/RU/UA admin localization |
| A14 | Add/replace gallery/media pipeline | Partial: up to 8 images in PostgreSQL | Order/cover/crop/optimization; move to object storage when serving real traffic |
| A15 | Telegram UX alignment | Partial: shared DB, signed linking, booking exist | Optional phone, deep links, “Open in TicketTreat” throughout, live Telegram-device acceptance |
| A16 | Design-system audit | Partial | Align TicketTreat icons/wordmark, Unbounded/Onest, flat colors, 60/25/10/5 ratio, light/dark themes, contrast, patterns without gradient/glow as in source PDF pp. 2–4 |
| A17 | Account privileges and recovery tests | Partial | Verified co-admin enrollment/MFA, revocation, break-glass and least-privilege check-in operator |
| A18 | Event booking rules | Partial | Per-person capacity, cutoff times, optional questions with data minimization, transparent cancellation rules |
| A19 | Staging, database backups/restore, release rollbacks | Code-only partial | Isolated Railway environment, encrypted offsite backup schedule, restore rehearsal, checked migrations |
| A20 | Monitoring and GDPR launch gates | Partial | Real alerting, approved privacy/terms/retention, DPA decisions, data export/erasure operations tested |

**Pilot success gates** from PDF p. 11: at least **four events** through the product,
at least **70% of registrations without personal messaging**, simple enough for
untrained attendees, no lost payments (once payments exist). Record measured
registration-to-ticket time and show/no-show rate from the first event.

## Phase B — studio-ready V1 (most functionality can be coded now; launch dependencies vary)

| ID | Item | Availability / constraints |
| --- | --- | --- |
| B01 | Studio organizations with owner/admin/check-in-only staff roles; self-service 10-minute onboarding | Can build now; verify permissions at DB/API level |
| B02 | Public studio profiles, schedule and follow/subscribe to new studio events | Can build now; delivery channels require configuration |
| B03 | Event recurrence, templates and bulk creation for the next month | Can build now |
| B04 | Studio CRM: attendance history, segments, return visits, inactive guests and scoped exports | Can build now; honor GDPR and marketing consent |
| B05 | Studio-specific loyalty: stamps, visit levels, streaks, early access and rewards | Can build now; award for actual check-in, never signup |
| B06 | Attendance levels (proposed only): Newcomer, Regular, Insider, VIP at first booking / 3 / 6 / 12 visits | Thresholds subject to real pilot data, not hard-coded policy |
| B07 | Bring-a-friend/referral links, group bookings and rewards conditional on check-in | Can build now; paid discounts activate after PSP |
| B08 | Smart waitlist priority by level | Requires B05, fairness/abuse policies; can build later |
| B09 | Auto-generated event announcement and poster with event QR for Instagram and Telegram | Can build now (templated design); AI is not required for V1 |
| B10 | Basic Apple Wallet and Google Wallet tickets | Implementation can start; signing/provider credentials and live tests external |
| B11 | PWA install UX, web push subscription and notification preferences | Code now; live HTTPS and device-specific testing required |
| B12 | No-show/cancellation/deposit policy engine and loyal guest rewards | Rules can be designed now; actual charges/refunds require payments and legal policy |
| B13 | Provider-ready email/push/Telegram channel fallbacks and deliverability tracking | Code now; actual Resend sender requires verified domain |
| B14 | Source tracking: organic/direct, studio referral, network discovery | Can build now; no real commission before PSP |
| B15 | Studio revenue and retention dashboard | Nonfinancial occupancy/return metrics now; actual revenue after PSP |

**V1 gates from PDF p. 12:** onboard **3–5 studios** without hands-on event
creation; target at least **30% repeat guests**; automated settlement and first
commission revenues are goals only **after** licensed payment integration.

## Payment/monetization track — design now; activation intentionally deferred

| ID | Payment/product feature | Release condition |
| --- | --- | --- |
| PAY01 | Choose business flow: agency vs direct-to-studio merchant of record | Legal, tax and contracting sign-off |
| PAY02 | PSP architecture, Stripe Connect suitability in Czechia; evaluate Czech options | Registered entity/eligible PSP account and compliance |
| PAY03 | Card checkout, Apple Pay/Google Pay, prepayment + final payment | Real provider integration, webhook idempotency, reconciliation |
| PAY04 | Refunds, date-based cancellation rules, disputes, deposits, no-show retention | Consumer law review and operational refund testing |
| PAY05 | Returned deposit as points/discount on attended event | Reliable payment ledger and loyalty accounting |
| PAY06 | Direct-to-studio payouts and transparent platform commission | PSP Connect/onboarding, financial records |
| PAY07 | Attribution commission: own direct guests low/zero fee vs network-acquired guests | Verified provenance, anti-gaming checks, agreed contracts |
| PAY08 | Invoices, VAT/accounting exports and settlement monitoring | Financial/legal rules by relevant country |
| PAY09 | Test comparison of no-show rates on events with/without deposit | Only after legal/test payments become available |

**Critical:** current free-event-only pilot deliberately differs from original
PDF's payment-inclusive MVP (PDF pp. 9–11). Keep paid actions disabled in
Production. No simulation of paid checkout as if payment were collected.

## Phase C — V2 citywide network

| ID | Feature | Condition |
| --- | --- | --- |
| C01 | One citywide guest passport with stamps across studios | Verified cross-studio attendance, consent/privacy model |
| C02 | Studio quests, seasonal challenges, badges | Reliable C01 visits and abuse rules |
| C03 | Tier-gated/hidden events, early reservations and VIP +1 | Server-enforced eligibility; capacity & invitation controls |
| C04 | Draws for ticket spots, partner rewards and birthday offers | Promotion/legal rules and fraud controls |
| C05 | Personalized city event discovery feed and recommendations | Multiple studios and opted-in behavioral processing |
| C06 | Own vs network source attribution and commissions | Reliable referral tracking and payment/settlement |
| C07 | Cross-studio promotion and transparent guest audience permissions | Consent and studio data boundaries |
| C08 | Reviews, feedback, complaints and studio reputation/moderation | Genuine attendee verification and moderation operations |
| C09 | Anti-fraud for multi-account claims, referrals, rewards, priority queues | Rate controls, immutable check-ins, audit |
| C10 | Updating Wallet passes and smart send-times | Wallet credentials, user permission and device tests |

**V2 PDF gates:** at least **15% network-sourced registrations** and measurable
cross-studio visits; network commission should cover operating costs.

## Phase D — V3 expansion (not on critical path to first events)

- Capacitor-based iOS/Android apps with native notifications and release workflow.
- WhatsApp Business, other channel reminders, SMS as a paid critical fallback.
- AI event builder from announcement/poster; suggestions for time, pricing and expected turnout.
- Memberships, subscriptions, visit packs and gift certificates.
- Sponsored city feed, studio Pro plans and enhanced CRM.
- Google Calendar and social/analytics integrations, ad pixels with consent,
  public API and accounting/VAT exports.
- White-label studio apps and branded sites.
- Multi-city/multi-currency support and localized legal/tax rule sets.

**V3 gate:** multiple cities can operate without manual agency support and
platform revenue covers sustainable operations.

## Product decision log (resolve deliberately)

1. **Brand:** TicketTreat replaces all Crowdly-facing branding. Reuse existing
   colors, not old logo semantics centered on the letter “w”.
2. **Authentication:** original PDF calls for a 3-step, passwordless flow
   without up-front signup. Current app requires a verified identity for
   production free ticketing; prototype magic-link/passkey route carefully.
3. **Pilot monetization:** free events first; original PDF says paid/deposits in
   MVP. Paid ticketing must wait for real provider/business/legal compliance.
4. **Loyalty:** keep per-account immutable attendance history now, add
   studio-specific tiers in V1 and network passport in V2. Initial
   3/6/12 thresholds are hypotheses to validate.
5. **Studio contacts:** participant emails used for operational notifications
   are **not** a blanket opt-in for advertising. Segment and marketing later
   with user preferences, lawful basis and unsubscribe.
6. **Staging priority:** no production deployment or database migration until
   backups/restore, approval and rollback checks succeed.

## Recommended implementation sequence

1. Event lifecycle + copy/preview/publish + event link/QR + calendar/map.
2. Mobile check-in, attendance history, visit dashboard and pilot analytics.
3. Reminder templates + waitlist claims + safe organizer operational messaging.
4. Passwordless user journey improvements and co-admin/staff-level security.
5. Studio profiles/onboarding/recurrences/CRM, then loyal guest levels and referrals.
6. In parallel: Railway isolated staging, restore-tested offsite backups,
   monitoring, GDPR policies.
7. After domain: DNS/TLS, live Google OAuth, verified Resend, Telegram mobile
   smoke tests and partner-admin onboarding.
8. Pilot several free events; measure actual behavior; then start
   payment/provider/commission track. Do not pre-activate paid checkout.

Source: **Crowdly-brand-and-roadmap(2).pdf**, pages 2–4 design system,
5–6 differentiation, 8 ecosystem, 9 overall roadmap, 10–11 foundation/MVP,
12 V1, 13 V2, 14 V3, 15 loyalty, 16 revenue, 17 technology, 18 success metrics.
