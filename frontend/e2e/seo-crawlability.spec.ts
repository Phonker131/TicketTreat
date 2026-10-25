import {test, expect} from "@playwright/test";

/**
 * SEO entrypoints must be publicly accessible to search engine crawlers.
 * These HTTP smoke tests catch accidental 404s, HTML error pages, regressions
 * to a cached sitemap, and robots rules that hide the sitemap.
 */
test("Googlebot can retrieve the sitemap as XML with canonical public URLs", async ({request}) => {
  const response=await request.get("/sitemap.xml",{
    headers:{"user-agent":"Googlebot/2.1 (+http://www.google.com/bot.html)"},
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/xml/i);
  const sitemap=await response.text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  expect(sitemap).toContain("<loc>https://tickettreat.eu</loc>");
  expect(sitemap).toContain("<loc>https://tickettreat.eu/organizers</loc>");
  for(const privateRoute of ["/profile","/admin","/tickets","/checkout","/security","/privacy"]){
    expect(sitemap).not.toContain("<loc>https://tickettreat.eu"+privateRoute);
  }
});

test("Googlebot can retrieve robots.txt and discover sitemap.xml",async({request})=>{
  const response=await request.get("/robots.txt",{
    headers:{"user-agent":"Googlebot/2.1 (+http://www.google.com/bot.html)"},
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/text\/plain/i);
  const rules=await response.text();
  expect(rules).toContain("User-Agent: *");
  expect(rules).toContain("Sitemap: https://tickettreat.eu/sitemap.xml");
  expect(rules).not.toMatch(/Disallow:\s*\/sitemap\.xml/);
  expect(rules).toContain("Disallow: /profile");
  expect(rules).toContain("Disallow: /admin");
});
