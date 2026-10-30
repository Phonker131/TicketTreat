import {test,expect} from "@playwright/test";

test("dark admin moderation history and notification widgets retain readable text", async ({page}) => {
  await page.goto("/?nostory",{waitUntil:"domcontentloaded"});
  // React hydration can remove fixtures injected before client handlers attach.
  await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme","dark");
    const root=document.querySelector(".app-shell");
    if(!root) throw new Error("Missing app shell");
    root.insertAdjacentHTML("beforeend",`
      <main class="page admin-event-actions" data-test-contrast-fixture>
        <section class="panel form-stack">
          <h3>Moderation history</h3>
          <div class="participant-row"><div>
            <strong>broadcast</strong>
            <small>Organizer #5</small>
            <small>campaign:1:email:2:telegram:0</small>
          </div><small>23/10/2026, 16:29:16</small></div>
          <p class="form-note">Recipients of notifications</p>
          <div class="tt-broadcast-history"><strong>Notification history</strong><small>Sent 2</small></div>
          <div class="tt-broadcast-stats"><div><strong>2</strong><small>Delivered</small></div></div>
        </section>
      </main>`);
  });
  const ratios=await page.locator("[data-test-contrast-fixture]").evaluate(root=>{
    const pairs=[
      [".participant-row strong",".panel"],
      [".participant-row small",".panel"],
      [".participant-row>small",".panel"],
      [".form-note",".panel"],
      [".tt-broadcast-history strong",".tt-broadcast-history"],
      [".tt-broadcast-history small",".tt-broadcast-history"],
      [".tt-broadcast-stats small",".tt-broadcast-stats>div"]
    ];
    const rgb=(value:string)=>{const m=value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);if(!m) throw new Error("Unexpected color: "+value);return [Number(m[1]),Number(m[2]),Number(m[3])]};
    const lum=(col:number[])=>{const [r,g,b]=col.map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
    return pairs.map(([selector,surface])=>{
      const element=root.querySelector(selector);
      const background=root.querySelector(surface);
      if(!element||!background) throw new Error("Missing contrast fixture: "+selector);
      const a=lum(rgb(getComputedStyle(element).color)),b=lum(rgb(getComputedStyle(background).backgroundColor));
      return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
  });
  for(const {selector,ratio} of ratios)expect(ratio,`${selector} contrast`).toBeGreaterThanOrEqual(4.5);
});

test("brand stamp glyphs never use multiply blending on dark cards",async({request})=>{
  for(const icon of ["asterisk","cross","plus","burst","wave"]){
    const res=await request.get(`/brand/glyph-${icon}.svg`);
    expect(res.ok(),icon).toBeTruthy();
    const svg=await res.text();
    expect(svg,icon).not.toMatch(/mix-blend-mode\s*:\s*multiply/);
    expect(svg,icon).toContain("<svg");
  }
});


/* Theme-aware admin cards: inspect the actual painted card, not its parent.
   Protected routes require login, so inject representative markup only after
   hydration to exercise the same CSS declarations without exposing user data. */
for(const theme of ["dark","light"] as const){
  for(const width of [320,390,768]){
    test(`organizer analytics + support cards: ${theme} ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
      await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
      await page.evaluate(()=>{
        const root=document.querySelector(".app-shell");
        if(!root)throw Error("Missing app-shell");
        root.insertAdjacentHTML("beforeend",`
          <main class="page tt-analytics-dashboard" data-admin-contrast-test>
            <section class="panel"><h2>Items to review</h2>
              <div class="tt-analytics-tasks">
                <a href="/admin/events/1" class="tt-analytics-task">
                  <span><strong>Low occupancy</strong><small>Amber HB TEST</small></span>
                  <span>There is still time to promote this event. ↗</span>
                </a>
              </div>
            </section>
          </main>
          <main class="page tt-support-page" data-support-contrast-test>
            <div class="tt-support-heading-nav"><a class="back-link" href="/admin">← Admin dashboard</a><span class="eyebrow">TICKETTREAT / SUPPORT DESK</span></div>
            <h1>Support desk</h1><div class="stats-grid">
              <div class="stat-card"><strong>0</strong><span>Unread</span></div>
              <div class="stat-card"><strong>0</strong><span>Awaiting response</span></div>
              <div class="stat-card"><strong>0</strong><span>Answered</span></div>
            </div>
          </main>`);
      });
      const results=await page.evaluate(()=>{
        const calc=(foreground:Element,background:Element)=>{
          const rgb=(c:string)=>{const m=c.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);if(!m)throw Error(c);return [Number(m[1]),Number(m[2]),Number(m[3])]};
          const luminance=(c:number[])=>c.map(x=>{const z=x/255;return z<=.04045?z/12.92:((z+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
          const a=luminance(rgb(getComputedStyle(foreground).color)),b=luminance(rgb(getComputedStyle(background).backgroundColor));
          return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        };
        const task=document.querySelector("[data-admin-contrast-test] .tt-analytics-task")!;
        const stat=document.querySelector("[data-support-contrast-test] .stat-card")!;
        const pairs=[
          calc(task.querySelector("strong")!,task),
          calc(task.querySelector("small")!,task),
          calc(task.querySelector("span:last-child")!,task),
          calc(stat.querySelector("strong")!,stat),
          calc(stat.querySelector("span")!,stat)
        ];
        const back=document.querySelector("[data-support-contrast-test] .back-link")!.getBoundingClientRect();
        const eyebrow=document.querySelector("[data-support-contrast-test] .eyebrow")!.getBoundingClientRect();
        const title=document.querySelector("[data-support-contrast-test] h1")!.getBoundingClientRect();
        const actionRects=[...document.querySelectorAll(".topbar-actions > *")].map(el=>el.getBoundingClientRect()).filter(r=>r.width>0);
        const taskRect=task.getBoundingClientRect();
        return {pairs,spacing:eyebrow.top-back.bottom,titleSpacing:title.top-eyebrow.bottom,
          taskInViewport:taskRect.left>=-1&&taskRect.right<=innerWidth+1,
          actionsInViewport:actionRects.every(r=>r.left>=-1&&r.right<=innerWidth+1),
          noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
      });
      for(const ratio of results.pairs)expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(results.spacing).toBeGreaterThanOrEqual(7);
      expect(results.titleSpacing).toBeGreaterThanOrEqual(2);
      expect(results.taskInViewport).toBe(true);
      expect(results.actionsInViewport).toBe(true);
      expect(results.noOverflow).toBe(true);
    });
  }
}
