import {test,expect} from "@playwright/test";

// Legal pages were switched from a light paper card to a dark surface,
// but older brand CSS still painted their links in nearly-black ink.
for(const theme of ["dark","light"] as const){
  for(const width of [390,1280]){
    test(`legal notice links meet text contrast in ${theme} theme at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.addInitScript(t=>localStorage.setItem("tt4-theme",t),theme);
      await page.goto("/legal-notice?lang=en",{waitUntil:"domcontentloaded"});
      const article=page.locator(".tt-legal-content");
      await expect(article.getByRole("heading",{name:"Legal documents / Právní dokumenty"})).toBeVisible();
      const findings=await article.evaluate(root=>{
        const anchors=[
          root.querySelector<HTMLAnchorElement>('a[href*="coi.gov.cz"]'),
          root.querySelector<HTMLAnchorElement>('a[href="/privacy-policy"]'),
          root.querySelector<HTMLAnchorElement>('a[href="/terms"]')
        ];
        const rgb=(v:string)=>{
          const m=v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
          if(!m)throw Error("Unexpected CSS color: "+v);
          return m.slice(1,4).map(Number);
        };
        const luminance=(s:string)=>rgb(s).reduce((sum,c,i)=>{
          const z=c/255,linear=z<=.04045?z/12.92:((z+.055)/1.055)**2.4;
          return sum+linear*[.2126,.7152,.0722][i];
        },0);
        const background=luminance(getComputedStyle(root).backgroundColor);
        return anchors.map(a=>{
          if(!a)throw Error("Legal link missing");
          const foreground=luminance(getComputedStyle(a).color);
          return {href:a.getAttribute("href"),ratio:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};
        });
      });
      for(const {href,ratio} of findings){
        expect(ratio,`Contrast for ${href} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
}
