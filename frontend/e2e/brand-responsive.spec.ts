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
