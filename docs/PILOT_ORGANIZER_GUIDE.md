# TicketTreat — pilot organizer guide (Czechia)

**Available:** `https://tickettreat.eu` (web and Telegram Mini App). This guide describes the deployed free-pilot feature set as of **24 October 2026**. It does not authorize selling tickets through TicketTreat or replace legal policies.

## Before publishing an event

1. Use a verified organizer account, enable MFA, and confirm the correct organizer owns the event in TicketTreat.
2. Create an event with title, description, Czech location, local date/time, capacity, cover photo and optional media/gallery; check it in preview.
3. For a free pilot, set the event price to free and publish. If users pay externally, clearly disclose the organizer's independent payment instructions and cancellation policy. **TicketTreat does not collect the payment.**
4. Confirm booking cutoff, capacity and staff scanner permissions.
5. Verify that a test account can book and receive a ticket through both web and Telegram Mini App.

## At registration

- Free events: booking produces a QR ticket; a single attendee must not count twice against capacity.
- Fully booked events: attendees join a waitlist; offer-expiry worker is enabled. A user in an organizer's 3-visit loyalty tier has priority within that organizer's waitlist, with FIFO within a tier.
- External-pay reservations: organizer confirms receipt of funds outside TicketTreat, then accepts participation; unpaid reservations expire after 24 hours. This is not a payment gateway.
- Email confirmations, support notifications and Telegram delivery are queued; verify the actual recipient can receive them. Users may block the bot or unsubscribe where appropriate.

## Entrance check-in

- Staff should use the scoped scanner in organizer administration, not the legacy shared-admin API.
- Scan the actual QR from a ticket. The server validates capacity, ticket status, event and privilege; repeat scans do not add extra attendance.
- If there is poor connectivity, look up the participant and contact an authorized organizer. **Do not manually declare a person admitted without server confirmation** when capacity matters.
- Confirm the scanned ticket belongs to the correct event; organizers should practice a 10–20-person dry run.

## After event

- Review checked-in count, no-shows and organizer insights. Only completed and verified check-ins grant seasonal loyalty stamps.
- Cancellations/reminders must be tested with a throwaway event before first public admission.
- Support tickets and data requests are handled through the designated staff; do not export attendees for unrelated marketing without a valid basis.
- Keep pilot KPIs: four events through TicketTreat, target 70% self-service registrations, QR admit time and notification success.

## What is not currently a guaranteed perk

Early registration windows, VIP companion bookings, automatic birthday rewards and a cross-studio loyalty passport are roadmap items. Only the 3-visit waitlist priority is automated.

See [release gate](UNIFIED_RELEASE_GATE.md) and [operations](PRODUCTION_OPERATIONS.md).
