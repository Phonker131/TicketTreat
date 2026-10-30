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

test("brandbook: organizer directory shows one non-clickable example",async({page})=>{
  await page.goto("/organizers?nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".tt-organizer-ghost")).toHaveCount(1);
  await expect(page.locator(".tt-organizer-ghost a")).toHaveCount(0);
  await expect(page.locator(".tt-organizer-ghost h2")).toBeVisible();
});

test("brandbook: all publicly referenced brand stamps exist",async({request})=>{
 for(const path of ["/brand/glyph-ticket.svg","/tickettreat-wordmark-dark.svg"]){
  const response=await request.get(path);
  expect(response.ok(),path).toBe(true);
  expect(await response.text()).toContain("<svg");
 }
});


test("official vector wordmarks match the brandbook with no font or blend dependencies",async({request,page})=>{
  for(const [path,letterColor] of [["/tickettreat-wordmark.svg","#15141F"],["/tickettreat-wordmark-dark.svg","#F0EBE1"]]){
    const res=await request.get(path);
    expect(res.ok(),path).toBeTruthy();
    const content=await res.text();
    expect(content).toContain("viewBox");
    expect(content).toContain(letterColor);
    expect(content).toContain("#F4B400");
    expect(content).toContain("#FF5533");
    expect(content).toContain("<path");
    expect(content).not.toMatch(/<text\b|mix-blend-mode|font-family/i);
  }
  for(const theme of ["light","dark"]){
    await page.addInitScript((t)=>localStorage.setItem("tt4-theme",t),theme);
    await page.goto("/?nostory",{waitUntil:"domcontentloaded"});
    await expect(page.locator(".wordmark")).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
    const shown=page.locator(theme==="dark"?".wordmark-logo-dark":".wordmark-logo-light");
    await expect(shown).toBeVisible();
    const size=await shown.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height}});
    expect(size.width).toBeGreaterThan(100);
    expect(size.height).toBeGreaterThan(15);
  }
});
