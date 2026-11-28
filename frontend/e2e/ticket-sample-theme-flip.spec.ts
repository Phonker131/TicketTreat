import {test,expect} from "@playwright/test";

/**
 * The old promotional sample-ticket carousel is no longer mounted on /tickets.
 * Verify the actual signed-out empty state, history switch and theme behavior
 * at the same mobile/desktop breakpoints instead of testing dead components.
 */
for(const viewport of [
  {name:"iPhone",width:390,height:844},
  {name:"desktop",width:1440,height:900},
]){
  test(`empty ticket wallet is usable across themes (${viewport.name})`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto("/tickets?lang=en",{waitUntil:"domcontentloaded"});
    await expect(page.getByText("No upcoming tickets yet.")).toBeVisible();
    await expect(page.getByRole("link",{name:"Find an event"})).toHaveAttribute("href","/#events");
    await expect(page.locator(".tp-tickets-empty,.tp-wallet,.tp-wallet-mobile")).toHaveCount(0);

    const toggle=page.locator(".tt-theme-toggle");
    for(let i=0;i<2;i++){
      const current=await page.locator("html").getAttribute("data-theme");
      const next=current==="dark"?"light":"dark";
      await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme",next);
      await expect(page.getByText("No upcoming tickets yet.")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  });
}

test("ticket history shows an independent, accessible empty state",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tickets?lang=en",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"History",exact:true}).click();
  await expect(page.getByRole("button",{name:"History",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByText("No past bookings yet.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Find an event"})).toHaveCount(0);
});
