import type {MetadataRoute} from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules:[{
      userAgent:"*",
      allow:["/","/privacy-policy","/cookie-policy","/terms","/legal-notice"],
      disallow:[
        "/api/",
        "/admin",
        "/checkout",
        "/organizer",
        "/profile",
        "/tickets",
        "/security",
        "/support",
        "/loyalty",
        "/privacy",
      ],
    }],
    sitemap:"https://tickettreat.eu/sitemap.xml",
    host:"https://tickettreat.eu",
  };
}
