import {test,expect} from "@playwright/test";

test("brandbook: dark and light wordmarks follow the root theme", async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tt4-theme","dark"));
  await page.goto("/?nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".wordmark-logo-dark")).toBeVisible();
  await expect(page.locator(".wordmark-logo-light")).toBeHidden();
  await page.locator(".tt-theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator(".wordmark-logo-light")).toBeVisible();
  await expect(page.locator(".wordmark-logo-dark")).toBeHidden();
});

test("brandbook: onboarding nine steps each show distinct illustrative content",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/?story&lang=en",{waitUntil:"domcontentloaded"});
  const story=page.getByRole("dialog",{name:/TicketTreat/});
  await expect(story).toBeVisible();
  for(let step=0;step<9;step++){
    await expect(story.locator(".tt-story-scene-"+step)).toBeVisible();
    if(step<8)await story.getByRole("button",{name:/Next/}).click();
  }
  await expect(story.getByText(/Enjoy your night/i)).toBeVisible();
  await story.getByRole("button",{name:/Explore events/}).click();
  await expect(story).toHaveCount(0);
});

test("brandbook: organizer directory includes two non-clickable example slots",async({page})=>{
  await page.goto("/organizers?nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".tt-organizer-ghost")).toHaveCount(2);
  await expect(page.locator(".tt-organizer-ghost a")).toHaveCount(0);
});

test("brandbook: all publicly referenced brand stamps exist",async({request})=>{
 for(const path of ["/brand/glyph-ticket.svg","/tickettreat-wordmark-dark.svg"]){
  const response=await request.get(path);
  expect(response.ok(),path).toBe(true);
  expect(await response.text()).toContain("<svg");
 }
});
