import {test,expect} from "@playwright/test";

test("organizer dashboard tabs scroll inside the framed bar on narrow screens",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("tickettreat_web_auth","browser-session");
    localStorage.setItem("tt4-theme","dark");
  });
  await page.route("**/api/gateway/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({json:{
      account_id:1,email:"admin@example.invalid",role:"global_admin"
    }});
    if(path.endsWith("/manage/events"))return route.fulfill({json:[]});
    return route.fulfill({status:404,json:{detail:"fixture_not_found"}});
  });
  await page.goto("/admin?lang=en",{waitUntil:"domcontentloaded"});
  const sidebar=page.locator(".tt-dash-side");
  const nav=sidebar.locator(".tp-admin-nav");
  await expect(nav.getByRole("link",{name:"Rewards"})).toBeVisible();

  for(const width of [320,390,440,768]){
    await page.setViewportSize({width,height:844});
    for(const theme of ["dark","light"]){
      await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
      const start=await nav.evaluate(element=>{
        element.scrollLeft=0;
        const frame=element.closest(".tt-dash-side")!.getBoundingClientRect();
        const list=element.getBoundingClientRect();
        const first=element.querySelector("li:first-child")!.getBoundingClientRect();
        return {frameLeft:frame.left,frameRight:frame.right,
          listLeft:list.left,listRight:list.right,
          firstLeft:first.left,scrollWidth:element.scrollWidth,
          clientWidth:element.clientWidth,
          pageWidth:document.documentElement.scrollWidth};
      });
      expect(start.listLeft).toBeGreaterThanOrEqual(start.frameLeft+5);
      expect(start.listRight).toBeLessThanOrEqual(start.frameRight-5);
      expect(start.firstLeft).toBeGreaterThanOrEqual(start.listLeft+3);
      expect(start.scrollWidth).toBeGreaterThan(start.clientWidth);
      expect(start.pageWidth).toBeLessThanOrEqual(width+1);

      const end=await nav.evaluate(element=>{
        element.scrollLeft=element.scrollWidth;
        const list=element.getBoundingClientRect();
        const last=element.querySelector("li:last-child")!.getBoundingClientRect();
        return {lastRight:last.right,listRight:list.right,
          pageWidth:document.documentElement.scrollWidth};
      });
      expect(end.lastRight).toBeLessThanOrEqual(end.listRight-3);
      expect(end.pageWidth).toBeLessThanOrEqual(width+1);
    }
  }
});
