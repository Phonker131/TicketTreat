import {test,expect} from "@playwright/test";

const urls=["/?nostory&lang=en","/business?lang=en","/tickets?lang=en","/loyalty?lang=en","/organizers?lang=en"] as const;
for(const theme of ["dark","light"] as const){
 for(const width of [320,390,768,1280,1440]){
  test("handoff layout "+theme+" "+width+"px",async({page})=>{
   await page.setViewportSize({width,height:844});
   await page.addInitScript((mode)=>localStorage.setItem("tt4-theme",mode),theme);
   for(const path of urls){
    await page.goto(path,{waitUntil:"domcontentloaded"});
    await expect(page.locator(".topbar, .tt-business-header").first()).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),{message:path+" must not overflow viewport"}).toBe(true);
    const oversized=await page.locator("main h1,main h2,main h3").evaluateAll(els=>els.filter(el=>{
      const r=el.getBoundingClientRect();
      // only visible headings; wrapping must not leak outside the page.
      // Neighboring slides in a horizontally scrollable tutorial are not page overflow.
      if(el.closest(".tt-v12-phones,.tt-example-ticket-tray"))return false;
      return r.width>0 && (r.left< -2 || r.right>window.innerWidth+2);
    }).map(el=>({text:el.textContent?.slice(0,65),rect:el.getBoundingClientRect().toJSON()})));
    expect(oversized,path+" heading bounds").toEqual([]);
   }
  });
 }
}
test("business header stays one row at desktop widths",async({page})=>{
 for(const width of [1280,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto("/business?lang=en",{waitUntil:"domcontentloaded"});
  const header=page.locator(".tt-business-header");
  await expect(header).toHaveCSS("height","72px");
  const positions=await header.locator(".tt-business-logo,.tt-business-signin").evaluateAll(els=>els.map(x=>{const r=x.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}));
  expect(Math.abs(positions[0].top-positions[1].top)).toBeLessThan(20);
  await expect(header.locator(".tt-business-nav")).toBeVisible();
 }
});
test("home and organizer presentations show interface components rather than glyph placeholders",async({page})=>{
 await page.goto("/?nostory&lang=en");
 await expect(page.locator(".tt-night-hero .tt-device-phone")).toBeVisible();
 await expect(page.locator(".tt-v12-how .tt-device-phone")).toHaveCount(3);
 await expect(page.locator(".tt-v12-ticket .tt-device-phone")).toHaveCount(2);
 await page.goto("/business?lang=en");
 await expect(page.locator(".tt-business-hero .tt-device-laptop")).toHaveCount(1);
 await expect(page.locator(".tt-business-sides .tt-device-phone")).toHaveCount(2);
 await expect(page.locator(".tt-business-sides .tt-device-laptop")).toHaveCount(1);
 await expect(page.locator(".tt-business-apply-form input")).toHaveCount(3);
 await expect(page.locator(".tt-business-apply-form textarea")).toHaveCount(1);
});
test("sample tickets do not present a QR code as real admission",async({page})=>{
 await page.goto("/tickets?lang=en");
 const tray=page.locator(".tt-example-ticket-tray");
 // This section appears when the user's account has no real tickets.
 if(await tray.count()){
  await expect(tray.locator(".tt-example-ticket")).toHaveCount(3);
  await tray.locator(".tt-example-ticket button").first().click();
  await expect(tray.locator(".tt-example-not-qr")).toContainText("QR");
  await expect(tray).toContainText("Not a valid");
 }
});
