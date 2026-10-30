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


test("event language selector stays readable and selectable at mobile and desktop widths",async({page})=>{
 for(const mode of ["dark","light"] as const)for(const width of [320,375,390,430,768,1280]){
  await page.setViewportSize({width,height:844});
  await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),mode);
  await page.goto("/?nostory&lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
  await page.evaluate(()=>{
   const shell=document.querySelector(".app-shell");
   if(!shell)throw Error("Missing app shell");
   shell.insertAdjacentHTML("beforeend",`<form class="panel form-stack" id="language-test-fixture">
     <fieldset class="event-language-fieldset"><legend>Event languages</legend>
      <div class="event-language-options">
       <label class="event-language-option"><input type="checkbox" name="languages" value="en" checked><span class="event-language-flag" aria-hidden="true">🇬🇧</span><span class="event-language-name">English</span></label>
       <label class="event-language-option"><input type="checkbox" name="languages" value="cs"><span class="event-language-flag" aria-hidden="true">🇨🇿</span><span class="event-language-name">Čeština</span></label>
       <label class="event-language-option"><input type="checkbox" name="languages" value="ru" checked><span class="event-language-flag" aria-hidden="true">🇷🇺</span><span class="event-language-name">Русский</span></label>
       <label class="event-language-option"><input type="checkbox" name="languages" value="uk"><span class="event-language-flag" aria-hidden="true">🇺🇦</span><span class="event-language-name">Українська</span></label>
      </div></fieldset></form>`);
  });
  const fixture=page.locator("#language-test-fixture");
  await expect(fixture.locator("label")).toHaveCount(4);
  const boxes=fixture.locator('input[type="checkbox"]');
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).not.toBeChecked();
  await fixture.getByText("Čeština").click();
  await expect(boxes.nth(1)).toBeChecked();
  await fixture.getByText("Čeština").click();
  await expect(boxes.nth(1)).not.toBeChecked();
  const metrics=await fixture.evaluate((el)=>{
   const rows=[...el.querySelectorAll(".event-language-option")];
   const info=rows.map(row=>{
    const box=row.querySelector("input")!.getBoundingClientRect();
    const label=row.querySelector(".event-language-name")!.getBoundingClientRect();
    const container=row.getBoundingClientRect();
    const style=getComputedStyle(row);
    return {bw:box.width,bh:box.height,lw:label.width,lh:label.height,
      contained:box.left>=container.left&&label.right<=container.right+1,
      flex:style.display==="flex"};
   });
   const field=el.querySelector(".event-language-fieldset")!.getBoundingClientRect();
   return {info,fieldWidth:field.width,inView:field.left>=-1&&field.right<=innerWidth+1,
           noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
  });
  expect(metrics.noOverflow,`${mode}, ${width}`).toBe(true);
  expect(metrics.inView).toBe(true);
  for(const row of metrics.info){
   expect(row.bw).toBeGreaterThanOrEqual(20);
   expect(row.bw).toBeLessThanOrEqual(24);
   expect(row.bh).toBeGreaterThanOrEqual(20);
   expect(row.bh).toBeLessThanOrEqual(24);
   expect(row.lw).toBeGreaterThan(75);
   expect(row.lh).toBeLessThan(30);
   expect(row.contained).toBe(true);
   expect(row.flex).toBe(true);
  }
 }
});
