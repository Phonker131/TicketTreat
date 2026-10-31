# TicketTreat — Search Console and sitemap status (31 October 2026)

This is a dated snapshot, **not** a promise of Google indexing. The domain property is `sc-domain:tickettreat.eu`. Google Search Console data was read through the connected Search Console analytics service.

## Verified in Google Search Console

- Submitted sitemap present in the available report: `https://tickettreat.eu/sitemap-diagnostic.xml`, submitted 2026-10-29 11:49:17 UTC; last downloaded 2026-10-31 09:17:52 UTC. Three submitted URLs, **0 reported errors**, **0 reported warnings**.
- The submitted-sitemap report **did not return** `https://tickettreat.eu/sitemap.xml` or `https://tickettreat.eu/sitemap-events.xml`. This does **not** prove Google has never discovered them; Google's report shows explicitly submitted maps, not every discovered file.
- Search Analytics recorded impressions and one click for this domain in 24–29 October. Search appearances do **not** prove that every submitted page has been indexed.
- Search Analytics also reported historic impressions for `/profile` and `/support` and one HTTP-homepage URL. These require Google URL Inspection to check the current indexed canonical and last crawl, **not** a robots.txt Disallow: crawler access is necessary to observe their existing noindex directives.

## Independently verified production evidence

- Railway frontend HTTP logs on 31 October show the Googlebot user agent fetching `/robots.txt` and `/sitemap-diagnostic.xml`, both with HTTP 200 at 09:17:52 UTC.
- The stable primary `frontend/public/sitemap.xml` contains 13 canonical public routes and must keep working when API data is unavailable.
- The dynamic supplemental `/sitemap-events.xml` fetches published future events and public organizer slugs. API outages must return HTTP 503 (retryable), **never** a fictitious empty XML listing.
- The release CI verifies sitemap XML, robots permissions, canonical URLs, noindex private pages, dynamic fixtures, response codes and metadata. CI does not replace a Googlebot live fetch or Search Console indexing report.

## What changed

- `robots.txt` advertises **both** `/sitemap.xml` (stable) and `/sitemap-events.xml` (dynamic). The diagnostic file remains separately available but is **not** a replacement for the primary map.
- Event and organizer social previews normalize valid relative poster/cover URLs to absolute HTTPS Open Graph images; invalid protocols are discarded.
- Regression checks cover the two announced sitemaps, data failures and image normalization. The schema, payments and wallet implementation do not change.

## Operator follow-up in Search Console

1. Open **Google Search Console → tickettreat.eu → Indexing → Sitemaps**.
2. Use **Add a new sitemap** and submit `sitemap.xml`. Also submit `sitemap-events.xml` after its post-deploy live fetch succeeds; these are two separate files, not `sitemap-diagnostic.xml`.
3. In the Sitemaps report check status and last read time later. A successful fetch only proves the sitemap could be read; crawling/indexing decisions are separate.
4. Use **URL Inspection** to check `https://tickettreat.eu/`, `https://tickettreat.eu/cs`, at least one real published `/events/{id}`, and previously seen `/profile` and `/support`. Verify page canonical, indexing state and last crawl; request reindexing where appropriate.
5. Confirm that `http://tickettreat.eu/` redirects to the HTTPS canonical using a real live HTTP client (not established by our available direct web fetch).
6. Reinspect mobile Safari content and monitor Googlebot response codes after release.

No Search Console submission or indexed-page count has been claimed here. The connected analytics service can read submitted-sitemap information but does **not** offer a sitemap-submit action.


## 31 October follow-up: dynamic sitemap report

The connected Search Console sitemap report subsequently returned:
- `https://tickettreat.eu/sitemap-events.xml` submitted at 2026-10-31 11:43:30 UTC, last downloaded at 11:43:31 UTC, **one reported error, zero discovered URLs**.
- Railway frontend HTTP logs recorded `/sitemap-events.xml` HTTP 200 at 11:43:31 UTC for a request identifying as Googlebot. A 200 alone does not confirm valid or nonempty XML, nor does it authenticate the client's actual crawler identity.
- This surfaced an actual edge case: when both dynamic sources return valid but empty arrays, the response is a syntactically correct `<urlset>` **with no `<url>` elements**. Google treats empty sitemaps as an error. The new implementation includes the valid canonical `/organizers` directory page as a minimal baseline, plus future events and organizer profiles when present. A dedicated isolated test covers empty data sources.
- The Search Console API available here exposes an error **count**, not the human-readable error details. Therefore the empty-sitemap edge case is a confirmed code defect and a **plausible explanation**, not an independently confirmed diagnosis of Google's specific error. Click the affected sitemap in Search Console to see its exact error text and resubmit after the fix is online.
- The stable main `/sitemap.xml` remains unchanged, including its 13 static URLs.
