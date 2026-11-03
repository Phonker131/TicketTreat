import {test,expect} from "@playwright/test";

/* No organizer credentials required: render the public CSS on a representative
   admin heading only after hydration, without mocking account/DB privileges. */
for(const theme of ["dark","light"] as const){
  for(const width of [390,1024,1440]){
    test(`organizer heading and hover are readable: ${theme} ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:850});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
      await expect(page.locator(".topbar-menu-toggle")).toBeEnabled();
      await page.evaluate(()=>{
        const root=document.querySelector(".app-shell")!;
        root.insertAdjacentHTML("beforeend",`
          <main class="page"><div class="admin-heading" data-admin-header-test>
            <div><span class="status status-demo">Global administrator</span>
              <h1>ALL TICKETTREAT EVENTS</h1>
              <p>Full access, organizer assignments and moderation.</p>
            </div>
            <div class="admin-event-actions">
              <a href="#" class="button button-primary">Analytics</a>
              <a href="#" class="button button-outline">Organizer profile</a>
            </div>
          </div></main>`);
      });
      const header=page.locator("[data-admin-header-test]");
      const stats=await header.evaluate(el=>{
        const rgb=(value:string)=>{const m=value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);if(!m)throw Error(value);return [Number(m[1]),Number(m[2]),Number(m[3])]};
        const lum=(col:number[])=>col.map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4})
          .reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
        const heading=el.querySelector("h1")!;
        const painted=el.closest(".app-shell")!;
        const a=lum(rgb(getComputedStyle(heading).color)),b=lum(rgb(getComputedStyle(painted).backgroundColor));
        const bound=heading.getBoundingClientRect();
        return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),
          visible:bound.width>180&&bound.height>25,noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
      });
      expect(stats.ratio).toBeGreaterThanOrEqual(4.5);
      expect(stats.visible).toBe(true);
      expect(stats.noOverflow).toBe(true);
      const outline=header.getByRole("link",{name:"Organizer profile"});
      await outline.hover();
      const hover=await outline.evaluate(el=>{
        const style=getComputedStyle(el);const rect=el.getBoundingClientRect();
        return {color:style.color,background:style.backgroundColor,shadow:style.boxShadow,
          within:rect.left>=-1&&rect.right<=innerWidth+1};
      });
      expect(hover.within).toBe(true);
      expect(hover.color).not.toBe(hover.background);
      expect(hover.shadow).not.toContain("7px 8px");
    });
  }
}
