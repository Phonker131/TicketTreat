# TicketTreat — privacy notice (DRAFT, not approved for publication)

> **LEGAL/OPERATIONAL BLOCKER:** TicketTreat has no confirmed registered legal entity/controller details in this repository. This document is an engineering draft, **not an operative privacy notice**. Do not publish it as final until a Czech/EU privacy specialist and the registered business verify the contents.

## Controller and contact

- Data controller (legal entity/name): **[FILL BEFORE LAUNCH]**
- Registered address, business ID and contact email: **[FILL BEFORE LAUNCH]**
- Privacy contact / relevant representative: **[FILL BEFORE LAUNCH]**
- Effective date and version: **[FILL BEFORE LAUNCH]**

## Personal data processed

- Account registration details (name, email, optional phone, profile and city)
- Verified Telegram ID, username and app identity linkage (when a user signs in through Telegram)
- Event bookings, tickets, QR access codes and check-in history
- Organizer administration, approvals and access-control audit records
- Security events such as sign-in attempts, session identifiers and error identifiers
- Transactional email delivery metadata, only if the service is configured

## Purposes and legal bases — review before publication

- Provide the website, event registration, entry and account service: **[validate contractual/legal basis]**
- Security, fraud prevention and authorized organizer administration: **[validate legitimate interests/security obligations]**
- Required financial/recordkeeping after payment activation: **[define applicable tax/legal obligations]**
- Marketing is **not enabled** through the transactional mail system; it requires a separate legal basis and user preferences where applicable.

## Processors / infrastructure

Verify agreements, data location, subprocessors and transfer safeguards for Railway, email provider (Resend when enabled), Telegram Mini App and future payment provider. **[complete controller/processor list before launch]**

## Retention, erasure and backups

Define approved durations and legal holds in [the retention matrix](DATA_RETENTION_MATRIX.md). An account can export data and submit an erasure request. Eligible erasure requests may be fulfilled by an MFA-authenticated administrator, subject to conflict/retention checks. Backups remain subject to the separate, documented backup retention/deletion window.

## Individuals' rights

Explain how to request access, rectification, deletion, restriction, objection, portability and how to contact the competent supervisory authority. Identify the contact, response process and exceptional legal retention grounds before publication.

## Cookies and authentication

The website uses server-set HttpOnly account-session cookies. Any analytics, third-party media embeds, optional cookies or marketing tools require a separate consent/notice review where applicable.

## Security

TicketTreat uses access-controlled endpoints, role ownership, MFA for privileged users, credential hashing, encrypted MFA seeds and controlled QR access. No system should be represented as immune to compromise.

## Change control

Legal approval: **[name/date]**. Publication owner: **[name]**. Version: **[version]**. Keep amendments and the current effective notice available to users.


## Timely data-subject request handling

As a general rule, GDPR requests require a response without undue delay and within **one calendar month**, with a possible two-month extension where justified by complexity/volume. The controller must notify the person about the extension and reasons within the initial month. The application's `response_due_at` is a queue reminder, not automatic legal fulfillment or an automatically approved extension. A refused request still requires an explanation and information about supervisory-authority/court remedies.

Official guidance: [ÚOOÚ: Práva subjektu údajů](https://uoou.gov.cz/poradna/poradna-gdpr/prava-subjektu-udaju) and [European Commission: requests from individuals](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).
