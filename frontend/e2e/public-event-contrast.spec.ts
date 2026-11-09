import {test,expect} from "@playwright/test";

// A public event must never activate admin/dashboard background rules just
// because it includes public calendar/share buttons.
const event={
  id:940917,title:"Werewolf",organizer:"Amber Events",location:"Prague",
  country_code:"CZ",city:"Prague",description:"Werewolf is a party game for 10 to 16 people. Our host explains the rules so everyone can play.",
  starts_at:"2026-11-20T19:20:00+01:00",max_participants:16,
  registered_count:2,spots_left:14,price:"100",currency:"CZK",
  languages:["en"],image_url:null,is_cancelled:false,visibility:"public",
  publication:{status:"published",visible:true,publish_at:null}
};
for(const theme of ["dark","light"] as const){
  for(const width of [390,1280]){
    test(`public event detail contrast in ${theme} theme at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.route("**/api/gateway/events/940917",r=>r.fulfill({
        status:200,contentType:"application/json",body:JSON.stringify(event)
      }));
      await page.goto("/events/940917?lang=en",{waitUntil:"domcontentloaded"});
      const detail=page.locator(".event-page");
      await expect(detail.getByRole("heading",{name:"Werewolf"})).toBeVisible();
      await expect(detail.locator(".event-description")).toContainText("party game");
      await expect(detail.locator(".tt-event-share-actions")).toBeVisible();
      await expect(detail.locator(".admin-event-actions")).toHaveCount(0);
      const results=await detail.evaluate(root=>{
        const rgb=(v:string):number[]=>{
          const m=v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
          if(!m)throw Error("Unexpected color "+v);
          return m.slice(1,4).map(Number);
        };
        const lum=(v:string)=>rgb(v).reduce((sum,c,i)=>{
          const x=c/255,linear=x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
          return sum+linear*[.2126,.7152,.0722][i];
        },0);
        const ratio=(c:string,b:string)=>{
          const x=lum(c),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        };
        const bg=getComputedStyle(root).backgroundColor;
        const selectors=[".event-hero h1",".event-description",".back-link"];
        return {
          bg,colors:selectors.map(selector=>{
            const node=root.querySelector(selector);
            if(!node)throw Error("Missing "+selector);
            return {selector,ratio:ratio(getComputedStyle(node).color,bg)};
          })
        };
      });
      expect(results.bg).toBe(theme==="dark"?"rgb(2, 7, 10)":"rgb(240, 235, 225)");
      for(const c of results.colors)expect(c.ratio,c.selector).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    });
  }
}
