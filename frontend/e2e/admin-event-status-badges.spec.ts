import {test,expect} from "@playwright/test";

// The dashboard pill previously inherited the 52px height of the mock phone
// status bar (.tp-status). Keep it compact even when brand layers change.
for (const theme of ["dark","light"] as const) {
  for (const width of [320,390,768,1280]) {
    test(`admin event status pills stay compact in ${theme} at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:800});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      // Keep the fixture outside the React tree, so hydration cannot detach it.
      await page.evaluate(()=>{
        document.body.insertAdjacentHTML("beforeend",`
          <div class="app-shell" data-status-fixture>
            <main class="page">
              <div class="admin-heading"><h1>All TicketTreat events</h1></div>
              <div class="admin-event-grid tp-admin-grid">
                <a href="#" class="admin-event-card tp-admin-card">
                  <div class="tp-ecard-date"><strong>15</strong><span>JAN</span></div>
                  <span class="tp-status is-draft"><span class="tp-status-name">Draft</span><span class="tp-status-divider" aria-hidden="true">·</span><span class="tp-status-number">#20</span></span>
                  <h3>BARFIGHT</h3><p>Fri 15 Jan · Czech Inn Bar</p>
                  <div class="tp-admin-guests">0 / 30 guests</div>
                </a>
                <a href="#" class="admin-event-card tp-admin-card">
                  <div class="tp-ecard-date"><strong>05</strong><span>JAN</span></div>
                  <span class="tp-status is-published"><span class="tp-status-name">Published</span><span class="tp-status-divider" aria-hidden="true">·</span><span class="tp-status-number">#19</span></span>
                  <h3>DETECTIVE TABLE</h3><p>Tue 5 Jan · Nerd Alert</p>
                  <div class="tp-admin-guests">0 / 20 guests</div>
                </a>
              </div>
            </main>
          </div>`);
      });
      const results=await page.locator("[data-status-fixture]").evaluate(root=>{
        const rgb=(s:string)=>{const m=s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);if(!m)throw Error("Unrecognized color "+s);return m.slice(1,4).map(Number)};
        const lum=(s:string)=>rgb(s).reduce((sum,c,i)=>{const v=c/255;return sum+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i]},0);
        const contrast=(a:string,b:string)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
        return [...root.querySelectorAll<HTMLElement>(".tp-admin-card")].map(card=>{
          const pill=card.querySelector<HTMLElement>(".tp-status")!;
          const name=pill.querySelector<HTMLElement>(".tp-status-name")!;
          const number=pill.querySelector<HTMLElement>(".tp-status-number")!;
          const date=card.querySelector<HTMLElement>(".tp-ecard-date")!;
          const box=pill.getBoundingClientRect(),bounds=card.getBoundingClientRect();
          const nameBox=name.getBoundingClientRect(),numberBox=number.getBoundingClientRect();
          const bg=getComputedStyle(pill).backgroundColor;
          return {
            status:name.textContent,number:number.textContent,
            height:box.height,dateHeight:date.getBoundingClientRect().height,
            withinCard:box.left>=bounds.left-1&&box.right<=bounds.right+1,
            withinViewport:box.left>=-1&&box.right<=window.innerWidth+1,
            inlineLayout:nameBox.right<numberBox.left,
            fontSize:parseFloat(getComputedStyle(pill).fontSize),
            labelContrast:contrast(getComputedStyle(name).color,bg),
            numberContrast:contrast(getComputedStyle(number).color,bg)
          };
        });
      });
      expect(results.map(r=>r.status)).toEqual(["Draft","Published"]);
      expect(results.map(r=>r.number)).toEqual(["#20","#19"]);
      for (const pill of results) {
        expect(pill.height,pill.status ?? "status pill").toBeGreaterThanOrEqual(28);
        expect(pill.height,pill.status ?? "status pill").toBeLessThanOrEqual(32);
        expect(pill.height,pill.status ?? "status pill").toBeLessThan(pill.dateHeight);
        expect(pill.withinCard,pill.status ?? "status pill").toBe(true);
        expect(pill.withinViewport,pill.status ?? "status pill").toBe(true);
        expect(pill.inlineLayout,pill.status ?? "status pill").toBe(true);
        expect(pill.fontSize,pill.status ?? "status pill").toBeLessThanOrEqual(12);
        expect(pill.labelContrast,pill.status ?? "status pill").toBeGreaterThanOrEqual(4.5);
        expect(pill.numberContrast,pill.status ?? "status pill").toBeGreaterThanOrEqual(4.5);
      }
    });
  }
}
