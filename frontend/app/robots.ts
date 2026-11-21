import type {MetadataRoute} from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/api/gateway/demo/events/*/poster", "/api/gateway/demo/events/*/gallery/",
        "/api/gateway/demo/public/organizers/*/media/"],
      disallow: ["/api/"],
    }],
    sitemap: ["https://tickettreat.eu/sitemap-pages.xml", "https://tickettreat.eu/sitemap-events.xml"],
    host: "https://tickettreat.eu",
  };
}
