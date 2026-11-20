import type {MetadataRoute} from "next";
// Allow crawlers to read noindex on HTML pages. API routes remain disallowed.
// robots.txt does not provide authorization or security boundaries.
// Advertise the new static public-pages sitemap while preserving the legacy
// /sitemap.xml endpoint for links and existing Search Console submissions.
// The latter returns 503 while its upstream is unavailable, allowing crawlers to retry safely.
export default function robots():MetadataRoute.Robots{
  return {rules:[{userAgent:"*",allow:"/",disallow:["/api/"]}],
    sitemap:["https://tickettreat.eu/sitemap-pages.xml","https://tickettreat.eu/sitemap-events.xml"],host:"https://tickettreat.eu"};
}
