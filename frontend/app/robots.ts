import type {MetadataRoute} from "next";
// Allow crawlers to read noindex on HTML pages. API routes remain disallowed.
// robots.txt does not provide authorization or security boundaries.
export default function robots():MetadataRoute.Robots{
  return {rules:[{userAgent:"*",allow:"/",disallow:["/api/"]}],
    sitemap:"https://tickettreat.eu/sitemap.xml",host:"https://tickettreat.eu"};
}
