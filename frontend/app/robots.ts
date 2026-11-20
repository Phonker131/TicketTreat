import type {MetadataRoute} from "next";
// Allow crawlers to read noindex on HTML pages. API routes remain disallowed,
// except the public event posters/galleries and organizer logos/covers that pages
// reference as og:image and JSON-LD images (longer Allow rules win over Disallow).
// robots.txt does not provide authorization or security boundaries.
// Keep the static primary sitemap first and discover the supplemental live events/organizers sitemap.
// The latter returns 503 while its upstream is unavailable, allowing crawlers to retry safely.
export default function robots():MetadataRoute.Robots{
  return {rules:[{userAgent:"*",allow:["/","/api/gateway/demo/events/*/poster","/api/gateway/demo/events/*/gallery/",
    "/api/gateway/demo/public/organizers/*/media/"],disallow:["/api/"]}],
    sitemap:["https://tickettreat.eu/sitemap.xml","https://tickettreat.eu/sitemap-events.xml"],host:"https://tickettreat.eu"};
}
