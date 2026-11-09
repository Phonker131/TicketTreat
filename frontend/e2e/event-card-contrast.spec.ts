import {test,expect} from "@playwright/test";

// Regression for white-on-white event metadata in the iOS homepage card.
// Use the real card class hierarchy without relying on live events or API data.
for(const theme of ["dark","light"] as const){
  for(const width of [390,1280]){
    test(`event card stays readable in ${theme} mode at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.addInitScript((t)=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
      await expect(page.locator(".tt-night-events")).toBeVisible();
      await page.evaluate(()=>{
        const section=document.querySelector(".tt-night-events");
        if(!section)throw new Error("Events section missing");
        section.insertAdjacentHTML("beforeend",`
          <div class="event-grid tp-feed">
            <article class="event-card" data-contrast-fixture>
              <div class="tt-event-poster-wrap"><div class="tt-event-date-sticker"><strong>10</strong><span>NOV TUE</span></div></div>
              <div class="event-card-body">
                <div class="event-card-meta"><span>10 NOV 2026 AT 19:20</span><span>100 CZK</span></div>
                <h2>Liar's Bar</h2>
                <a class="tt-event-organizer-link" href="/organizers/amber">Amber Events</a>
                <p class="event-card-location">Ellise Bar</p>
                <p class="event-card-languages">Event languages: Russian</p>
                <div class="event-card-footer">
                  <span class="status">●</span>
                  <a class="button button-secondary" href="/events/987">Details</a>
                </div>
              </div>
            </article>
          </div>`);
      });
      const card=page.locator("[data-contrast-fixture]");
      const contrast=await card.evaluate(el=>{
        const parse=(css:string):number[]=>{
          const match=css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
          if(!match)throw new Error("Invalid CSS color: "+css);
          return match.slice(1,4).map(Number);
        };
        const luminance=(rgb:number[])=>rgb.reduce((sum,value,i)=>{
          const x=value/255,linear=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
          return sum+linear*[.2126,.7152,.0722][i];
        },0);
        const ratio=(fg:string,bg:string)=>{
          const x=luminance(parse(fg)),y=luminance(parse(bg));
          return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        };
        const body=el.querySelector<HTMLElement>(".event-card-body");
        if(!body)throw new Error("Card body missing");
        const background=getComputedStyle(body).backgroundColor;
        const pairs=[
          ["h2",background],
          [".event-card-meta span:first-child",background],
          [".tt-event-organizer-link",background],
          [".event-card-location",background],
          [".event-card-languages",background],
          [".event-card-meta span:last-child",getComputedStyle(el.querySelector(".event-card-meta span:last-child")!).backgroundColor],
          [".event-card-footer .status",getComputedStyle(el.querySelector(".event-card-footer .status")!).backgroundColor],
          [".event-card-footer .button-secondary",getComputedStyle(el.querySelector(".event-card-footer .button-secondary")!).backgroundColor],
          [".tt-event-date-sticker strong",getComputedStyle(el.querySelector(".tt-event-date-sticker")!).backgroundColor],
        ] as const;
        return {background,cardBackground:getComputedStyle(el).backgroundColor,
          results:pairs.map(([selector,bg])=>{
            const node=el.querySelector(selector);
            if(!node)throw new Error("Missing: "+selector);
            return {selector,ratio:ratio(getComputedStyle(node).color,bg)};
          })};
      });
      expect(contrast.background).toBe("rgb(251, 249, 244)");
      expect(contrast.cardBackground).toBe("rgb(251, 249, 244)");
      for(const pair of contrast.results)expect(pair.ratio,pair.selector).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await card.locator(".button-secondary").hover();
      await expect.poll(()=>card.locator(".button-secondary").evaluate(el=>{
        const css=getComputedStyle(el);
        return {color:css.color,background:css.backgroundColor};
      })).toEqual({color:"rgb(255, 255, 255)",background:"rgb(2, 7, 10)"});
    });
  }
}
