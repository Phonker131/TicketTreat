import {test, expect} from "@playwright/test";
import robotsParser from "robots-parser";
import {JSDOM} from "jsdom";

const origin = "https://tickettreat.eu";
const googlebot = "Googlebot/2.1 (+http://www.google.com/bot.html)";
const privateRoots = ["/api", "/admin", "/checkout", "/organizer", "/profile", "/tickets", "/security", "/support", "/loyalty", "/privacy"];

function sitemapLocations(xml: string): string[] {
  // JSDOM's XML parser throws for malformed documents; scripts never execute.
  const dom = new JSDOM(xml, {contentType: "application/xml"});
  const root = dom.window.document.documentElement;
  const parsed = {
    root: root.localName,
    namespace: root.namespaceURI,
    entries: Array.from(root.children).map(url => ({
      name: url.localName,
      namespace: url.namespaceURI,
      locs: Array.from(url.children).filter(child => child.localName === "loc").map(loc => ({
        value: loc.textContent || "", namespace: loc.namespaceURI, children: loc.children.length,
      })),
    })),
  };
  dom.window.close();
  expect(parsed.root).toBe("urlset");
  const namespace = "http://www.sitemaps.org/schemas/sitemap/0.9";
  expect(parsed.namespace).toBe(namespace);
  expect(parsed.entries.length).toBeGreaterThan(0);
  return parsed.entries.map(entry => {
    expect(entry.name).toBe("url");
    expect(entry.namespace).toBe(namespace);
    expect(entry.locs).toHaveLength(1);
    expect(entry.locs[0].namespace).toBe(namespace);
    expect(entry.locs[0].children).toBe(0);
    const loc = entry.locs[0].value;
    expect(loc).toBe(loc.trim());
    const url = new URL(loc); // No base: relative URLs must fail.
    expect(url.origin).toBe(origin);
    expect(url.username + url.password + url.search + url.hash).toBe("");
    expect(privateRoots.some(path => url.pathname === path || url.pathname.startsWith(path + "/"))).toBe(false);
    return loc;
  });
}

for (const [agent, userAgent] of [["Googlebot", googlebot], ["browser", "Mozilla/5.0"]]) {
  for (const [path, mime] of [["/sitemap.xml", /application\/xml|text\/xml/i], ["/robots.txt", /text\/plain/i]] as const) {
    test(`${agent}: GET and HEAD ${path} are directly accessible`, async ({request}) => {
      const options = {headers: {"user-agent": userAgent}, maxRedirects: 0};
      const get = await request.get(path, options);
      expect(get.status()).toBe(200);
      expect(get.headers()["content-type"]).toMatch(mime);
      const head = await request.head(path, options);
      expect(head.status()).toBe(200);
      expect(head.headers()["content-type"]).toBe(get.headers()["content-type"]);
      expect((await head.body()).length).toBe(0);
      const slash = await request.get(path + "/", options);
      expect([301, 308]).toContain(slash.status());
      expect(new URL(slash.headers().location, origin).href).toBe(origin + path);
    });
  }
}

test("static diagnostic sitemap is valid XML and independent of API",async({request})=>{
  const expected=[origin+"/",origin+"/cs",origin+"/faq"];
  const path="/sitemap-diagnostic.xml";
  for(const agent of [googlebot,"Mozilla/5.0"]){
    const opts={headers:{"user-agent":agent},maxRedirects:0};
    const response=await request.get(path,opts);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/application\/xml|text\/xml/i);
    expect(sitemapLocations(await response.text())).toEqual(expected);
    const head=await request.head(path,opts);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe(response.headers()["content-type"]);
    expect((await head.body()).length).toBe(0);
  }
});

test("sitemap is valid XML with unique canonical public URLs", async ({request}) => {
  const response = await request.get("/sitemap.xml", {headers: {"user-agent": googlebot}, maxRedirects: 0});
  expect(response.status()).toBe(200);
  const locations = sitemapLocations(await response.text());
  const normalized = locations.map(loc => new URL(loc).href);
  expect(new Set(normalized).size).toBe(normalized.length);
  expect(normalized).toEqual(expect.arrayContaining([origin + "/", origin + "/cs",origin + "/en",origin + "/uk",origin + "/faq", origin + "/cs/faq", origin + "/en/faq", origin + "/uk/faq",origin + "/privacy-policy",origin + "/terms",origin + "/cookie-policy",origin + "/legal-notice", origin + "/organizers"]));
});

test("robots allows noindex HTML routes while blocking API",async({request})=>{
  const response=await request.get("/robots.txt",{maxRedirects:0});
  expect(response.status()).toBe(200);
  const robots=robotsParser(origin+"/robots.txt",await response.text());
  expect(robots.getSitemaps()).toEqual([origin+"/sitemap.xml"]);
  for(const agent of ["Googlebot","Bingbot","TicketTreatAuditBot"]){
    for(const path of ["/","/sitemap.xml","/faq","/cs/faq","/en/faq","/uk/faq",
      "/organizers","/events/910001","/privacy-policy","/cookie-policy","/terms","/legal-notice",
      "/admin","/profile","/tickets","/checkout/910001","/support","/privacy"]){
      expect(robots.isAllowed(origin+path,agent),agent+": "+path).toBe(true);
    }
    for(const path of ["/api/","/api/gateway/demo/health"]){
      expect(robots.isAllowed(origin+path,agent),agent+": "+path).toBe(false);
    }
  }
});

test("private HTML routes include HTTP noindex and no-store",async({request})=>{
  for(const path of ["/profile","/tickets","/tickets/910001","/admin",
    "/admin/events/910001","/checkout/910001","/support","/privacy",
    "/loyalty","/organizer/apply","/security/mfa"]){
    const response=await request.get(path,{headers:{"user-agent":googlebot},maxRedirects:0});
    expect(response.headers()["x-robots-tag"],path).toMatch(/noindex/i);
    expect(response.headers()["cache-control"],path).toMatch(/no-store/i);
  }
});

test("localized FAQ pages have matching HTML and canonical hreflang",async({request})=>{
  for(const [path,title] of [["/faq","Частые вопросы"],["/cs/faq","Často kladené otázky"],
    ["/en/faq","Frequently asked questions"],["/uk/faq","Поширені запитання"]] as const){
    const response=await request.get(path,{maxRedirects:0});
    expect(response.status(),path).toBe(200);
    const dom=new JSDOM(await response.text());
    const doc=dom.window.document;
    expect(doc.querySelector("h1")?.textContent).toBe(title);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(origin+path);
    for(const locale of ["ru","cs","en","uk"]){
      expect(doc.querySelector('link[rel="alternate"][hreflang="'+locale+'"]'),locale).not.toBeNull();
    }
    expect(doc.querySelectorAll("details.tt-faq-item").length).toBe(12);
    dom.window.close();
  }
});

test("missing event returns HTTP 404, not a soft-404 HTML page",async({request})=>{
  expect((await request.get("/events/910999",{maxRedirects:0})).status()).toBe(404);
});

test("stable primary sitemap remains complete during upstream outages",async({request})=>{
  const expected=["https://tickettreat.eu/","https://tickettreat.eu/cs","https://tickettreat.eu/en","https://tickettreat.eu/uk","https://tickettreat.eu/faq","https://tickettreat.eu/cs/faq","https://tickettreat.eu/en/faq","https://tickettreat.eu/uk/faq","https://tickettreat.eu/privacy-policy","https://tickettreat.eu/terms","https://tickettreat.eu/cookie-policy","https://tickettreat.eu/legal-notice","https://tickettreat.eu/organizers"];
  const first=await request.get("/sitemap.xml",{maxRedirects:0});
  expect(first.status()).toBe(200);
  expect(sitemapLocations(await first.text())).toEqual(expected);
  for(const [fail,recover] of [["fail-events","recover-events"],["fail-organizers","recover-organizers"]]){
    await request.get("http://127.0.0.1:8100/_fixture/"+fail);
    try{
      const stable=await request.get("/sitemap.xml",{maxRedirects:0,headers:{"user-agent":googlebot}});
      expect(stable.status()).toBe(200);
      expect(sitemapLocations(await stable.text())).toEqual(expected);
      const optional=await request.get("/sitemap-events.xml",{maxRedirects:0});
      expect(optional.status()).toBe(503);
    }finally{await request.get("http://127.0.0.1:8100/_fixture/"+recover);}
  }
});

test("separate dynamic event sitemap discovers only eligible fixtures",async({request})=>{
  test.skip(process.env.TICKETTREAT_SEO_FIXTURE!=="1","Only valid with isolated SEO API");
  const response=await request.get("/sitemap-events.xml",{maxRedirects:0});
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/application\/xml/i);
  const urls=sitemapLocations(await response.text());
  expect(urls.sort()).toEqual([origin+"/events/910001",origin+"/organizers/seo-fixture"].sort());
  for(const path of ["/events/910001","/organizers/seo-fixture"]){
    const page=await request.get(path,{maxRedirects:0});
    expect(page.status(),path).toBe(200);
    const dom=new JSDOM(await page.text());
    expect(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(origin+path);
    dom.window.close();
  }
});

test("localized home pages have search-friendly descriptions and reciprocal hreflang",async({request})=>{
  for(const [path,hint] of [["/cs","Akce a vstupenky"],["/en","Events and tickets"],["/uk","Події та квитки"]] as const){
    const response=await request.get(path,{maxRedirects:0});
    expect(response.status()).toBe(200);
    const dom=new JSDOM(await response.text());
    const doc=dom.window.document;
    expect(doc.querySelector("title")?.textContent).toContain(hint);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(origin+path);
    for(const locale of ["ru","cs","en","uk"]){
      expect(doc.querySelector('link[rel="alternate"][hreflang="'+locale+'"]'),path).not.toBeNull();
    }
    dom.window.close();
  }
});
