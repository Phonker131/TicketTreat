import {test,expect} from "@playwright/test";

// Organizer profile embeds EventCard without .tt-night-home. The page's theme
// rules must never recolor the printed, pale card with a pale foreground.
for(const theme of ["dark","light"] as const){
  for(const width of [390,1280]){
    test(`organizer event cards and poster dates remain readable in ${theme} at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/?nostory",{waitUntil:"domcontentloaded"});
      await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
      // Insert outside React's tree so asynchronous hydration cannot detach it.
      await page.evaluate(()=>{
        document.body.insertAdjacentHTML("beforeend",`
          <div class="app-shell" data-organizer-card-contrast>
            <main class="page tt-organizer-public">
              <section class="tt-organizer-hero"><h1>Amber Events</h1></section>
              <section class="tt-organizer-section">
                <h2>Upcoming events</h2>
                <div class="event-grid">
                  <article class="event-card tt-event-paper-card">
                    <div class="tt-event-poster-wrap">
                      <img class="event-card-poster" src="/favicon.svg" alt="Poster"/>
                      <div class="tt-event-date-sticker"><strong>10</strong><span>NOV TUE</span></div>
                    </div>
                    <div class="event-card-body">
                      <div class="event-card-meta"><span>10 NOV 2026 AT 19:20</span><span>100 CZK</span></div>
                      <h2>Liar's Bar</h2>
                      <a href="/organizers/amber-events" class="tt-event-organizer-link">Amber Events</a>
                      <p class="event-card-location">Ellise Bar</p>
                      <p class="event-card-languages">Event languages: Russian</p>
                      <div class="event-card-footer">
                        <span class="status">●</span>
                        <a href="/events/111" class="button button-secondary">Details</a>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </main>
          </div>`);
      });
      const root=page.locator("[data-organizer-card-contrast]");
      const card=root.locator(".tt-event-paper-card");
      await expect(card).toBeVisible();
      const results=await card.evaluate(el=>{
        const parse=(color:string):number[]=>{
          const m=color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
          if(!m)throw Error("Invalid color: "+color);
          return m.slice(1,4).map(Number);
        };
        const lum=(v:number[])=>v.reduce((sum,c,i)=>{
          const x=c/255,linear=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
          return sum+linear*[.2126,.7152,.0722][i];
        },0);
        const ratio=(fg:string,bg:string)=>{
          const a=lum(parse(fg)),b=lum(parse(bg));
          return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        };
        const body=el.querySelector<HTMLElement>(".event-card-body")!;
        const bg=getComputedStyle(body).backgroundColor;
        const lookups=[
          ["h2",bg],
          [".event-card-meta span:first-child",bg],
          [".tt-event-organizer-link",bg],
          [".event-card-location",bg],
          [".event-card-languages",bg],
          [".event-card-meta span:last-child",getComputedStyle(el.querySelector(".event-card-meta span:last-child")!).backgroundColor],
          [".event-card-footer .status",getComputedStyle(el.querySelector(".event-card-footer .status")!).backgroundColor],
          [".event-card-footer .button-secondary",getComputedStyle(el.querySelector(".event-card-footer .button-secondary")!).backgroundColor],
          [".tt-event-date-sticker strong",getComputedStyle(el.querySelector(".tt-event-date-sticker")!).backgroundColor],
          [".tt-event-date-sticker span",getComputedStyle(el.querySelector(".tt-event-date-sticker")!).backgroundColor],
        ] as const;
        const sticker=el.querySelector(".tt-event-date-sticker")!.getBoundingClientRect();
        const poster=el.querySelector(".tt-event-poster-wrap")!.getBoundingClientRect();
        return {bg,colors:lookups.map(([selector,background])=>{
          const node=el.querySelector(selector)!;
          return {selector,contrast:ratio(getComputedStyle(node).color,background)};
        }),stickerWithinPoster:sticker.top>=poster.top-1&&sticker.bottom<=poster.bottom+1,
          noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
      });
      expect(results.bg).toBe("rgb(251, 249, 244)");
      for(const x of results.colors)expect(x.contrast,x.selector).toBeGreaterThanOrEqual(4.5);
      expect(results.stickerWithinPoster).toBe(true);
      expect(results.noOverflow).toBe(true);
      await card.locator(".button-secondary").hover();
      await expect.poll(()=>card.locator(".button-secondary").evaluate(el=>{
        const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor};
      })).toEqual({fg:"rgb(255, 255, 255)",bg:"rgb(22, 29, 37)"});
    });
  }
}
