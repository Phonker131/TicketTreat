# Production SEO regression suite

From `frontend/`:

```sh
npm install --no-audit --no-fund
BACKEND_API_URL=http://127.0.0.1:8100 npm run build
npm run test:seo
```

Keep port 8100 unused during the build. Playwright starts the disposable API on
127.0.0.1:8100 **after** the build, then starts `next start` on 127.0.0.1:3100.
Existing servers are never reused. Both processes stop when the suite finishes.
No database, credentials, external API or browser download is required.

The fixture contains one future published event, a public organizer, and events
that are past, cancelled, hidden, missing a date, have an invalid date or an empty
title. Dates are relative to fixture startup. An exact sitemap assertion catches
missing dynamic entries as well as accidental inclusion of excluded events.
The fixture does not model backend authorization or organizer publication logic;
those remain the responsibility of backend tests.

The dedicated workflow runs on production-branch PRs and pushes. General E2E
runs still execute the HTTP, XML and robots checks; the exact fixture-dependent
assertions run only with `playwright.seo.config.ts`.

The suite checks XML structure, canonical origin, duplicates, private route
boundaries, effective crawler permissions (including `/privacy-policy`), GET,
HEAD, slash redirects, the sitemap's immediate-revalidation cache contract, and every listed
page's HTTP status/indexability. Detail pages also need matching canonical URLs.
It intentionally does not require a canonical tag on static pages that do not
currently declare one, or forbid `/api` and `/organizer` without a slash when the
current robots rules only forbid their slash-prefixed descendants.

This is a local production-build contract, not a live hosting/CDN or Google
Search Console check. It does not assert immediate event-list freshness: the
application's event fetch has a 180-second revalidation policy.
