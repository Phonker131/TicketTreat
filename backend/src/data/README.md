# Disposable email domain data

`disposable_email_blocklist.conf` is copied verbatim from
[`disposable-email-domains/disposable-email-domains`](https://github.com/disposable-email-domains/disposable-email-domains),
commit `9cf2bee345b0276e1b65cee7484beb51e5c715b1` (2026-11-25 snapshot).
The source list is dedicated to the public domain under CC0 1.0.

The list is loaded locally by `demo_disposable_email.py`. Never contact a third
party with a registrant's email address at signup time. Update this snapshot
periodically with a reviewed PR and run the registration tests before release.

`SIGNUP_EMAIL_DOMAIN_BLOCKLIST_EXTRA` adds comma-separated domains immediately
through Railway configuration. `SIGNUP_EMAIL_DOMAIN_ALLOWLIST` overrides an
accidental false positive, **exact domain only**. Existing accounts may still
log in and recover access, even if their email provider is later listed.
