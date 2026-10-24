# TicketTreat Telegram bot localization — 2026-10-24

**Source:** user-supplied `botfather-texts.md` (English + Russian), adapted by adding fully translated Czech and Ukrainian. The exact English/Russian descriptions, About and `/start` copy live in `bot/src/bot_profile_copy.py`. New translations are authored for the other two languages. The canonical `join` CTA on the site and bot uses Book a spot / Записаться / Rezervovat místo / Забронювати місце.

## What the bot updates automatically

On Railway bot startup, a background thread calls the official Telegram Bot API to compare and apply each of the following for **default English**, **English**, **Russian**, **Czech**, **Ukrainian**:

- `getMyDescription` → `setMyDescription`, max 512 characters
- `getMyShortDescription` → `setMyShortDescription`, max 120 characters
- `getMyCommands` → `setMyCommands`; five commands: `/events`, `/tickets`, `/passport`, `/reminders`, `/help`

This operation is idempotent; no token is printed, no environment values are changed, and transient Telegram errors cannot abort the webhook service.

The production bot implements a localized `/start` and two clean action buttons ("Show events" and "My tickets" in English). `/events`, `/tickets`, `/passport`, `/reminders`, `/help`, `/support`, `/link`, and `/myid` have localized replies. User language is initially detected from the Telegram `message.from_user.language_code`, including `cs-CZ`/`uk-UA`, but an explicit language setting saved in the user's TicketTreat profile takes precedence. Unknown locales use English.

The original locale-aware user profile/event/chat translations remain available for all four languages.

## What is NOT included in the supplied Markdown

The file mentions `avatar-640.png` and `start-picture-640x360.png`, but does not contain these files or a URL to them. The bot avatar and description picture were **not** replaced. The description picture must be supplied and installed through @BotFather's Edit Description Picture controls. The existing avatar maintenance procedure is separate.

No changes to the unrelated admin, notification, payments, QR-code, ticket generation, or webhook security behavior are required for the copy update.

## Operational limitation of /reminders

The source text calls the command "Set up reminders". The server currently schedules reminders at the **event/organizer level**, with default lead times of 7 days, 24 hours and 3 hours; organizers may change this. There is no per-user reminders configuration screen yet. The localized `/reminders` command truthfully explains the schedule and links to the user's tickets rather than advertising a nonexistent individual toggle. Do not assume all organizers use the defaults or that every reminder will be delivered.

## Smoke test

1. Change Telegram interface to English, Russian, Czech or Ukrainian, start a private chat with @TicketTreatBot and send `/start`. Inspect the welcome, the first name and two buttons.
2. Check `/events`, `/tickets`, `/passport`, `/reminders`, `/help`, `/link` and `/support`.
3. Reopen the bot profile and command picker. Confirm localized descriptions and five commands.
4. Change the preferred language in the TicketTreat profile, restart the bot conversation, and confirm the explicit preference overrides the Telegram UI locale.
5. Test the two Mini App buttons from a private chat and check the same commands in a group chat (regular HTTPS link instead of the private-only `web_app` inline button).
6. Inspect Railway bot logs for `TicketTreat bot profile updated` or `TicketTreat bot profile setup failed`. Check webhook startup success.
7. Upload the actual artwork separately once the two named files are available.
