# TicketTreat — Czech/EU public launch legal readiness register
Status: **NOT LEGALLY SIGNED OFF**. Updated 2026-10-23. Applies to the Czechia pilot (event platform, website, Google OAuth, Telegram bot/Mini App). The documents in /frontend are a draft for review, **not a legal opinion or certificate of GDPR compliance**.

## 0. Release decision and accountable person (HARD BLOCKER)
- [ ] Identify the genuine **data controller** (natural person / sole trader / company). A brand name alone is not a controller. Decide whether the platform and organizer are independent or joint controllers for each purpose. Record responsibility, who handles access/erasure requests, and any Art. 26 allocation if necessary.
- [ ] Decide who legally offers the platform and who **sells/adopts the ticket contract**. If the pilot is a regular commercial activity, independently verify the necessary Czech business registration, licensing and tax position before selling tickets. No fictitious Czech IČO/s.r.o.
- [ ] Publish approved legal identity and working contact through **Railway → Frontend → Variables**:
  - `LEGAL_OPERATOR_NAME` — verified full personal/trade/legal entity name (as legally appropriate).
  - `LEGAL_OPERATOR_ADDRESS` — approved reachable correspondence/business address (use professional advice if personal privacy matters; don't publish home address casually).
  - `LEGAL_PRIVACY_EMAIL` — verified monitored email inbox for GDPR requests; test receipt and responses.
  - `LEGAL_OPERATOR_ICO` — set only if one legally exists; otherwise omit, never make it up.
- [ ] Rebuild/redeploy Frontend after variables change and verify both `/privacy-policy` and `/terms` show the same actual controller details, not the "pending" notice. Approve the public documents in Czech and English.
- [ ] Provide additional mandatory seller/trader identification (and where applicable company register, taxes, VAT and contact information) at checkout and in terms before any paid tickets. The responsible person may differ from the data controller or event organizer.
- [ ] Confirm the official web support channel `https://tickettreat.eu/support` is accessible, monitored, and handles replies through authenticated tickets and verified email. Separately verify `LEGAL_PRIVACY_EMAIL` as a working GDPR contact channel; do not rely on tickets requiring login as the only route for data-subject requests.

## Pilot commercial model (confirmed by founders, 2026-10-23)
- Free events: TicketTreat supplies registration, QR tickets, reminders and check-in.
- Priced events: the participant pays **the organizer directly**, outside TicketTreat. The pilot platform does not charge or receive participant money, does not process payment card details, and does not reimburse money it never received. Do not present a mock credit-card/Apple Pay/Google Pay checkout as real.
- Where payment is required, any organizer contract, organizer identity, contact, full price, payment instructions, refund/complaint handling, admission confirmation and applicable taxes are determined by the responsible seller/organizer. Do not mark an attendee as paid based on a TicketTreat registration alone.
- In the current public web UI, free ticket checkout is maintained. Priced-event checkout and any fake payment UI are withheld pending an explicit organizer-direct registration/payment-confirmation design. If this model changes, review legal texts, roles and backend before enabling it.
- This does **not** eliminate the possibility of Czech online-marketplace, EU DSA/P2B or consumer-law obligations. Applicability depends on whether contracts between organizers and users can be concluded on TicketTreat and on the platform's actual activities; direct-to-organizer payment alone is not a blanket exemption. See ČOI explanation https://coi.gov.cz/faq/6-jak-funguji-on-line-trziste/ and https://e-sbirka.gov.cz/sb/1992/634.
- If TicketTreat charges an organizer separately for platform services, commercial obligations, invoicing and tax treatment of **that B2B arrangement** still need legal/accounting review.

## 1. GDPR (Regulation (EU) 2016/679) + Czech Act No. 110/2019 Sb.
- [ ] Map personal-data flows and who decides purposes. Create/approve a **record of processing activities** (Art. 30 applicability to assess; exemption isn't automatic, especially for non-occasional processing).
- [ ] For each data category (account, emails, login, tickets, check-in, organizers, security, marketing, bot data), document purpose, legal basis (Art. 6), necessary fields, recipients, transfer safeguards and retention/deletion rule.
- [ ] Approve **specific retention periods or sufficiently clear criteria** by category; implement scheduled deletion & backup expiry accordingly. See `docs/DATA_RETENTION_MATRIX.md`, currently *not approved*. Do not invent durations in the public notice.
- [ ] Inventory Railway, Resend, Google, Telegram and other providers, their actual location, Art. 28 processor agreements where relevant, additional subprocessors, cross-border flows and Chapter V legal bases (SCCs, adequacy etc.).
- [ ] Provide users with Art. 13/14 information **when data is collected**, not only in a footer. Signup & event checkout now link to the notice; review every other intake (Telegram, organizer dashboard, Google link).
- [ ] Handle verified rights requests: access, rectification, erasure, restriction, portability when applicable, objections/consent withdrawal. Respond without undue delay, generally **within 1 month**, extensions properly explained. Verify support inbox, audit trail, deadlines, access-controlled process, and backend deletion execution.
- [ ] Document incident response and breach triage; where applicable notify supervisory authority within **72 hours after awareness** (GDPR Art. 33), and affected people when Art. 34 threshold met. Test backup/restore, role access, MFA, least privilege, account takeover and QR scanning controls.
- [ ] Review children/minors, special-category event data, profiling and necessity for a DPIA (Art. 35); don't assume that all event types have identical legal risks.

## 2. Czech cookie/ePrivacy and direct marketing
- [ ] Audit **actual** site requests, cookies and localStorage on guest home, login, Google OAuth, checkout and Telegram Mini App on desktop/mobile. Note that a Telegram script is loaded by the web layout; confirm third-party requests and purposes.
- [ ] Only strictly necessary technical cookies/storage can be used without optional consent; document their purpose and duration in a Czech-accessible privacy/cookie notice.
- [ ] **Before enabling any non-essential cookies/tracking** (analytics, ads, fingerprinting), implement an equally prominent ACCEPT / REJECT control, no non-essential storage before consent, easy withdrawal and consent logs as appropriate. Do not add a fake banner when there are no optional cookies.
- [ ] Separate essential booking/cancellation reminders from **marketing**. Check Czech Act No. 480/2004 Sb. and GDPR for consent or the narrowly applicable existing-customer exception; implement clear unsubscribe and suppression for optional commercial messages. Do not bundle marketing permission into Terms.

## 3. Ticket sales and consumer information (Czech Civil Code 89/2012 Sb.; Consumer Protection Act 634/1992 Sb.)
- [ ] Before any **paid** ticket sale, name the actual contracting trader/seller, organizer and their roles; display the event schedule, admission terms, total price including mandatory fees and taxes, payment options, cancellation/refund/complaint terms and contact.
- [ ] Keep the on-platform paid checkout disabled in the pilot. If introduced later, the payment obligation must be conspicuous and the seller/processor/relevant contract and payment confirmation must be disclosed correctly.
- [ ] Explain the **specific-date leisure service exception** for ordinary 14-day no-reason withdrawal (Czech Civil Code § 1837(j)) where it really applies; don't claim that all tickets and services have no cancellation/consumer rights.
- [ ] Add legally required consumer complaint channels and **ADR** notice where the operator/trader is subject to it; ČOI normally covers many consumer service disputes, but check the actual contractual seller and type of dispute.
- [ ] Confirm event terms can be kept/read in a durable format where required, and consumer information is appropriately available in the language used in the contracting flow. Czech page text is supplied alongside English; get a native Czech legal review.
- [ ] Check **Digital Services Act** platform/intermediary rules, trader traceability where applicable, notice-and-action and contract transparency when independent organizers publish event offers. Direct payment outside TicketTreat alone does not exclude obligations. Separately assess EU P2B when TicketTreat facilitates direct business-to-consumer transactions on contractual terms with organizers.

## 4. Google and launch communications
- [ ] `/privacy-policy` and `/terms` are public over HTTPS without login, correct canonical domain and no 404; verify in incognito and Google Cloud Branding.
- [ ] Verify `tickettreat.eu` ownership, consent-screen branding, published identity and contact details. Google scopes remain `openid email profile`. Verify the final Google OAuth launch configuration and callback.
- [ ] Confirm real project support/notification mailbox and monitoring responsibilities, and update contacts if changing from personal to registered company.
- [ ] Re-review and version Privacy Policy/Terms whenever payments, marketing, analytics, providers, countries, retention policy or controller identity change.

## Scope of engineering changes completed in this branch
- Public Privacy Policy and Terms with English and Czech information, GDPR identity disclosure, Google/Telegram, Czech dated-events withdrawal and conditional ADR.
- Public operator metadata from server-only Frontend env variables with **explicit warning if missing**.
- GDPR links at account signup and checkout; legal footer visible without login.
- Pilot participant checkout for priced events is withheld in the web UI; existing backend payment and ticket APIs still require a separate audit and a production configuration gate. No changes to storage deletion rules; legal pages alone are **not** compliance-ready.

## Sources for legal review
- GDPR arts. 5, 6, 12–15, 17–22, 24–26, 28, 30, 32–35, 44–49 (EUR-Lex Regulation (EU) 2016/679).
- Czech supervisory authority guidance: https://uoou.gov.cz/verejnost/zakladni-prirucka-k-ochrane-udaju and https://uoou.gov.cz/verejnost/qa-otazky-a-odpovedi/cookies
- European Commission on rights request deadlines: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- Czech Trade Inspection Authority on consumer rights/withdrawal: https://coi.gov.cz/pro-spotrebitele/spotrebitelsky-pruvodce/
- Czech Trade Inspection Authority ADR: https://coi.gov.cz/pro-podnikatele/informace-pro-prodejce-zbozi-a-sluzeb/mimosoudni-reseni-spotrebitelskych-sporu-adr/

**Release gate:** no public mass launch or paid-ticket checkout should be described as legally approved until qualified Czech/EU counsel checks the actual operator identity, contracts, data flows and payment/marketplace model, and the owner signs off the above.
