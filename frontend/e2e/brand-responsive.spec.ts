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
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link").first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect.poll(async()=>page.evaluate(()=>document.activeElement?.tagName === "A" || document.activeElement?.tagName === "BUTTON" || document.activeElement?.tagName === "SELECT")).toBe(true);
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
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const footer=page.locator("footer.tt-legal-footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByText(/© 20\d\d TicketTreat/)).toBeVisible();
  await expect(footer.getByRole("link",{name:"Privacy Policy"})).toHaveAttribute("href","/privacy-policy");
  await expect(footer.getByRole("link",{name:"Terms of Service"})).toHaveAttribute("href","/terms");
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
