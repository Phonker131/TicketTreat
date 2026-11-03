import {test,expect} from "@playwright/test";

/** Regression coverage for organizer screenshots (iPhone Safari sizing,
 * light paper reminder text, narrow admin header, and overlapping onboarding).
 * Protected admin routes cannot be reached without login in browser fixtures:
 * inject the same markup after React hydration to exercise the production CSS.
 */
for(const width of [320,375,390,430,900,1024]){
  test(`organizer header keeps its title and admin actions readable at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:760});
    await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
    await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
    await page.evaluate(()=>{
      document.querySelector(".app-shell")?.insertAdjacentHTML("beforeend",`
        <main class="page">
          <div class="admin-heading" data-layout-fixture>
            <div><span class="status status-demo">Global administrator</span>
              <h1>All TicketTreat events</h1>
              <p>Full access, organizer assignments and moderation.</p>
            </div>
            <div class="admin-event-actions">
              <a class="button button-primary" href="#">Analytics</a>
              <a class="button button-outline" href="#">Organizer profile</a>
              <a class="button button-outline" href="#">Manage accounts</a>
              <a class="button button-outline" href="#">Website content</a>
              <a class="button button-outline" href="#">Support desk</a>
              <a class="button button-outline" href="#">Organizer applications</a>
              <a class="button button-outline" href="#">Privacy requests</a>
              <a class="button button-sun" href="#">Scan ticket</a>
            </div>
          </div>
        </main>`);
    });
    const layout=await page.locator("[data-layout-fixture]").evaluate(el=>{
      const title=el.querySelector("h1")!.getBoundingClientRect();
      const text=el.querySelector("h1")!;
      const controls=[...el.querySelectorAll(".admin-event-actions .button")].map(x=>x.getBoundingClientRect());
      return {titleWidth:title.width,titleScroll:text.scrollWidth,
        actionsFit:controls.every(r=>r.width>=65 && r.left>=-1 && r.right<=innerWidth+1),
        noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
    });
    expect(layout.titleWidth).toBeGreaterThan(160);
    expect(layout.titleScroll).toBeLessThanOrEqual(layout.titleWidth+2);
    expect(layout.actionsFit).toBe(true);
    expect(layout.noOverflow).toBe(true);
  });
}

for(const theme of ["dark","light"] as const){
  test(`organizer reminder paper hints stay legible in ${theme} theme`,async({page})=>{
    await page.setViewportSize({width:375,height:812});
    await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
    await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
    await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
    await page.evaluate(()=>{
      document.querySelector(".app-shell")?.insertAdjacentHTML("beforeend",`
        <main class="page">
          <section class="panel form-stack admin-event-actions" data-reminder-fixture>
            <section class="tt-reminder-editor">
              <h3>Attendee reminders</h3>
              <p class="form-note">Text appears in every email reminder.</p>
              <label class="tt-reminder-label">Message
                <textarea>Organizer message</textarea><small>19/1000</small></label>
              <p class="form-note">Email: all selected times for verified ticket holders.</p>
            </section>
          </section>
        </main>`);
    });
    const values=await page.locator("[data-reminder-fixture]").evaluate(root=>{
      const paper=root.querySelector(".tt-reminder-editor")!;
      const bg=getComputedStyle(paper).backgroundColor;
      const rgb=(css:string)=>{const v=css.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);if(!v)throw Error(css);return [Number(v[1]),Number(v[2]),Number(v[3])]};
      const lum=(col:number[])=>col.map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4})
        .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      return [...root.querySelectorAll(".tt-reminder-editor .form-note, .tt-reminder-editor .tt-reminder-label small")]
        .map(x=>{const a=lum(rgb(getComputedStyle(x).color)),b=lum(rgb(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
    });
    for(const ratio of values)expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

for(const width of [320,390]){
  test(`publish date and time fields fit a ${width}px organizer card`,async({page})=>{
    await page.setViewportSize({width,height:700});
    await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
    await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
    await page.evaluate(()=>{
      document.querySelector(".app-shell")?.insertAdjacentHTML("beforeend",`
        <main class="page">
          <div class="admin-event-actions"></div>
          <section class="panel form-stack" data-publish-fixture>
            <h2>Publish event</h2>
            <div class="tt-publication-schedule">
              <div class="tt-publication-schedule-fields">
                <label>Publish date<input type="date" value="2026-11-20"></label>
                <label>Publish time<input type="time" value="18:30"></label>
              </div>
              <button type="button" class="button button-outline">Schedule</button>
            </div>
          </section>
        </main>`);
    });
    const rects=await page.locator("[data-publish-fixture]").evaluate(el=>{
      const box=el.getBoundingClientRect();
      const inputs=[...el.querySelectorAll("input,button")].map(x=>x.getBoundingClientRect());
      return {noOverflow:document.documentElement.scrollWidth<=innerWidth+1,
        within:inputs.every(r=>r.left>=box.left-1 && r.right<=box.right+1),
        tallEnough:inputs.every(r=>r.height>=44)};
    });
    expect(rects.noOverflow).toBe(true);
    expect(rects.within).toBe(true);
    expect(rects.tallEnough).toBe(true);
  });
}

for(const [width,height] of [[320,640],[375,667],[390,740],[430,812]] as const){
  test(`onboarding at ${width}x${height}: buttons never get covered by mock phone`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto("/?story&lang=en",{waitUntil:"domcontentloaded"});
    const tour=page.locator(".tp-tour");
    await expect(tour).toBeVisible();
    for(let i=0;i<3;i++){
      const next=tour.locator(".tp-tour-next");
      await expect(next).toBeVisible();
      const bounds=await next.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        const at=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
        return {top:rect.top,bottom:rect.bottom,
          clickable:at===el||el.contains(at),vertical:rect.top>=0&&rect.bottom<=innerHeight+1};
      });
      expect(bounds.vertical).toBe(true);
      expect(bounds.clickable).toBe(true);
      if(i<2)await next.click();
    }
    await tour.locator(".tp-tour-next").click();
    await expect(tour).toHaveCount(0);
  });
}
