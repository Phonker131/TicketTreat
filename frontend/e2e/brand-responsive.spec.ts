import {test, expect} from "@playwright/test";

const widths = [
  {name:"small-phone",width:320,height:700},
  {name:"iphone",width:390,height:844},
  {name:"large-phone",width:430,height:932},
  {name:"tablet",width:768,height:1024},
  {name:"small-laptop",width:1024,height:768},
  {name:"desktop",width:1440,height:900},
];

for (const viewport of widths) {
  test(`responsive shell at ${viewport.name} (${viewport.width}px)`, async ({page}) => {
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto("/",{waitUntil:"domcontentloaded"});
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".hero")).toBeVisible();
    await expect(page.getByRole("link",{name:"TicketTreat",exact:true})).toBeVisible();
    await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect.poll(async()=>page.locator(".hero").evaluate(el=>el.getBoundingClientRect().width > 0)).toBe(true);
    await page.screenshot({path:`test-results/brand-${viewport.name}.png`,fullPage:true});
  });
}

test("mobile navigation and accessible keyboard focus",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const nav=page.locator(".topbar-nav");
  const menu=page.locator(".topbar-menu-toggle");
  await expect(menu).toHaveAttribute("aria-label","Открыть меню");
  await expect(menu).toBeEnabled();
  await expect(nav).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded","true");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link",{name:/Support|Поддержка|Podpora|Підтримка/})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  await page.keyboard.press("Tab");
  await expect.poll(async()=>page.evaluate(()=>["A","BUTTON","SELECT"].includes(document.activeElement?.tagName||""))).toBe(true);
});

for(const width of [320,375,390,430,768,850,1024,1199]){
  test(`mobile navbar stays inside ${width}px and closes after link navigation`,async({page})=>{
    await page.setViewportSize({width,height:812});
    await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
    const nav=page.locator(".topbar-nav");
    const toggle=page.locator(".topbar-menu-toggle");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-label","Open menu");
    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(6);
    const rects=await nav.getByRole("link").evaluateAll(links=>links.map(link=>{
      const rect=link.getBoundingClientRect();
      return {left:rect.left,right:rect.right,width:rect.width,scrollWidth:link.scrollWidth};
    }));
    for(const rect of rects){
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width+1);
      expect(rect.width).toBeGreaterThan(100);
      expect(rect.scrollWidth).toBeLessThanOrEqual(Math.ceil(rect.width)+1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    await nav.getByRole("link",{name:"Support"}).click();
    await expect(page).toHaveURL(/\/support/);
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded","false");
  });
}

test("mobile menu animates on open and close and marks the current page",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
  const menu=page.locator(".topbar-menu-toggle");
  const nav=page.locator("#tt-primary-nav");
  await expect(menu).toBeEnabled();
  await expect(nav).toBeHidden();
  const duration=await nav.evaluate(el=>getComputedStyle(el).transitionDuration);
  expect(duration).not.toBe("0s");
  expect(await menu.locator(".topbar-menu-icon > span").count()).toBe(3);
  await menu.click();
  await expect(nav).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded","true");
  await expect(nav.getByRole("link",{name:"Events"})).toHaveAttribute("aria-current","page");
  await expect.poll(async()=>nav.evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(1);
  const rotated=await menu.locator(".topbar-menu-icon > span").first().evaluate(el=>getComputedStyle(el).transform);
  expect(rotated).not.toBe("none");
  await menu.click();
  await expect(nav).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  await menu.click();
  await expect(nav).toBeVisible();
  await nav.getByRole("link",{name:"Support"}).click();
  await expect(page).toHaveURL(/\/support/);
  await expect(nav).toBeHidden();
  await expect(nav.getByRole("link",{name:"Support",includeHidden:true})).toHaveAttribute("aria-current","page");
});

test("reduced motion removes animations without hiding navigation",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:320,height:700});
  await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
  const menu=page.locator(".topbar-menu-toggle");
  const nav=page.locator("#tt-primary-nav");
  await expect(menu).toBeEnabled();
  const duration=await menu.evaluate(el=>getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(.05);
  await menu.click();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link",{name:"Support"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
});

test("desktop navbar remains permanently visible",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".topbar-nav")).toBeVisible();
  await expect(page.locator(".topbar-menu-toggle")).toBeHidden();
});

test("public pilot header opens the official TicketTreat bot", async ({page}) => {
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const bot = page.locator("a.mode-pill-link");
  await expect(bot).toHaveAttribute("href","https://t.me/TicketTreatBot");
  await expect(bot).toContainText("Telegram Mini App");
});

test("registration does not reveal platform-owner recovery or JSON export", async ({page}) => {
  await page.goto("/profile",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("Global administrator permissions can only be assigned by the platform owner.")).toHaveCount(0);
  await expect(page.getByText("Recover global admin access")).toHaveCount(0);
  await expect(page.getByText("Скачать мои данные (JSON)")).toHaveCount(0);
});

test("homepage footer exposes Google OAuth legal links and copyright for guests", async ({page}) => {
  await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
  const footer=page.locator("footer.tt-legal-footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByText(/© 20\d\d TicketTreat/)).toBeVisible();
  await expect(footer.getByRole("link",{name:"Privacy Policy"})).toHaveAttribute("href","/privacy-policy");
  await expect(footer.getByRole("link",{name:"Terms of Service"})).toHaveAttribute("href","/terms");
  await expect(footer.getByRole("link",{name:"Legal Notice / Operator"})).toHaveAttribute("href","/legal-notice");
});

test("legal footer and documents are accessible on narrow screens without sign-in", async ({page}) => {
  await page.setViewportSize({width:320,height:700});
  for(const location of ["/","/privacy-policy","/terms"]){
    await page.goto(location,{waitUntil:"domcontentloaded"});
    await expect(page.locator("footer.tt-legal-footer")).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await expect(page.getByRole("heading",{name:"Terms of Service"})).toBeVisible();
  await page.goto("/privacy-policy");
  await expect(page.getByRole("heading",{name:"Privacy Policy",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"What Google sign-in accesses"})).toBeVisible();
});

test("Czech and EU legal pages publish controller status and consumer-law details",async({page})=>{
  await page.goto("/privacy-policy",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Operator / Provozovatel a správce údajů"})).toBeVisible();
  await expect(page.getByRole("heading",{name:/Úplné informace o zpracování osobních údajů/})).toBeVisible();
  await expect(page.getByText(/openid/).first()).toBeVisible();
  await page.goto("/terms",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Obchodní podmínky – české znění/})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Complaints and alternative dispute resolution"})).toBeVisible();
});

test("account signup shows notice at collection without bundled marketing consent",async({page})=>{
  await page.goto("/profile",{waitUntil:"domcontentloaded"});
  await page.locator(".auth-tabs button").first().click();
  const form=page.locator("form.panel.form-stack").first();
  await expect(form.getByRole("link",{name:/Privacy Policy|политикой конфиденциальности|zásady ochrany osobních údajů|політикою конфіденційності/})).toHaveAttribute("href","/privacy-policy");
  await expect(form.getByRole("link",{name:/Terms of Service|условиями использования|obchodní podmínky|умовами користування/})).toHaveAttribute("href","/terms");
});

test("public operator notice is available without signing in",async({page})=>{
  await page.goto("/legal-notice",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Legal Notice / Operator"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Operator / Provozovatel a správce údajů"})).toBeVisible();
});

test("Czech pilot legal terms clearly disclose organizer-direct payments",async({page})=>{
  await page.goto("/terms",{waitUntil:"domcontentloaded"});
  await expect(page.getByText(/does not accept, collect or transfer participant payments/)).toBeVisible();
  await expect(page.getByText(/Platba probíhá mimo platební systém TicketTreat/)).toBeVisible();
  await page.goto("/privacy-policy",{waitUntil:"domcontentloaded"});
  await expect(page.getByText(/does not collect attendees' card details/)).toBeVisible();
});

test("priced events never show TicketTreat fake payment or automatic paid tickets",async({page})=>{
  const event={id:9372,title:"Direct organizer payment test",organizer:"Independent organizer",
    location:"Prague",country_code:"CZ",city:"Prague",description:"Event test",
    max_participants:30,registered_count:2,spots_left:28,
    price:"350",currency:"CZK",languages:["cs"],payment_required:true,
    image_url:null,starts_at:"2026-12-10T18:00:00+01:00",is_cancelled:false};
  await page.route("**/api/gateway/events/9372",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(event)}));
  // Force legacy demo flag on to prove the public UI still cannot
  // simulate a paid TicketTreat checkout.
  await page.route("**/api/gateway/demo/config",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      demo_payment_mode:true,verified_accounts_required:true})}));
  await page.goto("/events/9372");
  await expect(page.getByText(/directly with the organizer|напрямую организатору|přímo pořadateli|безпосередньо організатору/i).first()).toBeVisible();
  await expect(page.locator('a[href*="/checkout/9372"]')).toBeVisible();
  await page.goto("/checkout/9372");
  await expect(page.getByRole("heading",{name:/Organizer-direct payment|Payment directly to the organizer|Оплата напрямую организатору|Platba přímo pořadateli|Оплата безпосередньо організатору/})).toBeVisible();
  await expect(page.locator(".payment-methods")).toHaveCount(0);
  await expect(page.locator(".fake-card-fields")).toHaveCount(0);
});

test("support center is linked publicly, does not permit anonymous complaints and works on mobile",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
  await page.locator(".topbar-menu-toggle").click();
  await expect(page.locator(".topbar-nav")).toBeVisible();
  await expect(page.locator(".topbar-nav").getByRole("link",{name:/Support|Поддержка|Podpora|Підтримка/})).toHaveAttribute("href","/support");
  await expect(page.locator("footer").getByRole("link",{name:/Support|Поддержка|Podpora|Підтримка/})).toHaveAttribute("href","/support");
  await page.goto("/support",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Служба поддержки|Support|Podpora|Служба підтримки/})).toBeVisible();
  await expect(page.getByRole("link",{name:/Войти|Sign in|Přihlásit se|Увійти/})).toBeVisible();
  await expect(page.locator("form").filter({has:page.getByRole("button",{name:/Отправить обращение|Send ticket|Odeslat|Надіслати/})})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test("support admin page does not expose inbox to signed-out visitors",async({page})=>{
  await page.goto("/admin/support",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Служба поддержки"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Входящие тикеты"})).toHaveCount(0);
});

test("cookie consent is opt-in, rejecting persists and preferences can be changed",async({page})=>{
  await page.goto("/?lang=en",{waitUntil:"domcontentloaded"});
  const banner=page.getByTestId("tt-cookie-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button",{name:"Allow Google Maps"})).toBeVisible();
  await expect(banner.getByRole("button",{name:"Reject optional"})).toBeVisible();
  await banner.getByRole("button",{name:"Reject optional"}).click();
  await expect(banner).toHaveCount(0);
  const consent=await page.evaluate(()=>JSON.parse(localStorage.getItem("tt_cookie_choice_v1")||"null"));
  expect(consent.necessary).toBe(true);
  expect(consent.externalMedia).toBe(false);
  expect(consent.version).toBe("2026-10-23/maps-v1");
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.locator("footer").getByRole("button",{name:"Cookie settings"}).click();
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("checkbox",{name:"Embedded Google Maps"})).not.toBeChecked();
  await banner.getByRole("checkbox",{name:"Embedded Google Maps"}).check();
  await banner.getByRole("button",{name:"Save my choice"}).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tt_cookie_choice_v1")||"null").externalMedia)).toBe(true);
  await page.goto("/cookie-policy?lang=en");
  await expect(page.getByRole("heading",{name:"Cookie Policy / Zásady cookies"})).toBeVisible();
  await page.getByRole("button",{name:"Cookie settings / Nastavení cookies"}).click();
  await expect(banner).toBeVisible();
  await banner.getByRole("button",{name:"Reject optional"}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tt_cookie_choice_v1")||"null").externalMedia)).toBe(false);
});

test("Google Maps iframe never loads until opt-in and is removed on withdrawal",async({page})=>{
  const event={id:9373,title:"Venue map test",organizer:"Independent organizer",
    location:"Prague 1",country_code:"CZ",city:"Prague",description:"Event test",
    max_participants:20,registered_count:0,spots_left:20,
    price:"0",currency:"CZK",languages:["en"],payment_required:false,
    image_url:null,starts_at:"2026-12-11T18:00:00+01:00",is_cancelled:false};
  await page.route("**/api/gateway/events/9373",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(event)}));
  await page.goto("/events/9373?lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("tt-cookie-banner")).toBeVisible();
  await page.getByRole("button",{name:"Reject optional"}).click();
  await page.getByRole("button",{name:"Show map"}).click();
  await expect(page.locator('iframe[src*="maps.google.com"]')).toHaveCount(0);
  await expect(page.getByText("The embedded Google Maps frame requires optional consent.")).toBeVisible();
  await page.getByRole("button",{name:"Manage cookie preferences"}).click();
  await page.getByTestId("tt-cookie-banner").getByRole("button",{name:"Allow Google Maps"}).click();
  await expect(page.locator('iframe[src*="maps.google.com"]')).toHaveCount(1);
  await page.locator("footer").getByRole("button",{name:"Cookie settings"}).click();
  await page.getByTestId("tt-cookie-banner").getByRole("button",{name:"Reject optional"}).click();
  await expect(page.locator('iframe[src*="maps.google.com"]')).toHaveCount(0);
});

test("Cookie banner remains usable on 320px narrow devices",async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto("/?lang=cs",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:"Odmítnout volitelné"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Povolit Mapy Google"})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
