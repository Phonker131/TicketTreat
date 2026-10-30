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
