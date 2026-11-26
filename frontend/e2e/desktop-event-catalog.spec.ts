import {expect,test} from "@playwright/test";

const events=Array.from({length:19},(_,index)=>({
  id:995100+index,title:`Desktop Event ${index+1}`,organizer:"Amber Events",
  organizer_profile:null,location:"Praha 1",country_code:"CZ",city:"Praha",
  description:"Desktop catalogue regression",max_participants:30,registered_count:2,
  spots_left:28,price:"100",currency:"CZK",languages:["en"],image_url:null,
  starts_at:`2026-12-${String(index+1).padStart(2,"0")}T19:00:00`,is_cancelled:false,
}));

test("desktop catalogue exposes later events through normal page scrolling",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
  await page.goto("/?lang=cs&nostory",{waitUntil:"domcontentloaded"});
  const grid=page.locator(".tt-night-events .event-grid.tt-feed-row");
  await expect(grid.locator(".event-card")).toHaveCount(8);
  const layout=await grid.evaluate(element=>{
    const css=getComputedStyle(element);
    const first=element.children[0].getBoundingClientRect();
    const fifth=element.children[4].getBoundingClientRect();
    return {
      direction:css.gridAutoFlow,
      overflow:css.overflowX,
      mask:css.maskImage,
      secondRow:fifth.top>=first.bottom-1,
      pageFits:document.documentElement.scrollWidth<=innerWidth+1,
    };
  });
  expect(layout).toEqual({direction:"row",overflow:"visible",mask:"none",secondRow:true,pageFits:true});
  await page.evaluate(()=>window.scrollTo(0,0));
  await grid.locator(".event-card").last().scrollIntoViewIfNeeded();
  const lastVisible=await grid.locator(".event-card").last().evaluate(card=>{
    const rect=card.getBoundingClientRect();
    return rect.top<innerHeight&&rect.bottom>0&&window.scrollY>0;
  });
  expect(lastVisible).toBe(true);
});

test("catalogue loads events eight at a time and resets on mode change",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
  await page.goto("/?lang=cs&nostory",{waitUntil:"domcontentloaded"});
  const cards=page.locator(".tt-night-events .tt-feed-row .event-card");
  const more=page.locator(".tt-discovery-pagination button");
  const progress=page.locator(".tt-discovery-pagination p");
  await expect(cards).toHaveCount(8);
  await expect(progress).toHaveText("Zobrazeno 8 z 19");
  await more.click();
  await expect(cards).toHaveCount(16);
  await expect(progress).toHaveText("Zobrazeno 16 z 19");
  await more.click();
  await expect(cards).toHaveCount(19);
  await expect(more).toHaveCount(0);
  await page.locator(".tt-night-events .tp-seg button").nth(2).click();
  await expect(page.locator(".tt-night-events .tp-events-empty.is-compact")).toBeVisible();
  await page.locator(".tt-night-events .tp-seg button").first().click();
  await expect(cards).toHaveCount(8);
  await expect(more).toBeVisible();
});

test("saved events are also shown in batches",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.addInitScript(ids=>localStorage.setItem("tickettreat_wanted_events",JSON.stringify(ids)),events.map(e=>e.id));
  await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await page.locator(".tt-night-events .tp-seg button").nth(2).click();
  const cards=page.locator(".tt-night-events .tt-feed-row .event-card");
  await expect(cards).toHaveCount(8);
  await expect(page.locator(".tt-discovery-pagination p")).toHaveText("Showing 8 of 19");
  await page.locator(".tt-discovery-pagination button").click();
  await expect(cards).toHaveCount(16);
});

for(const width of [390,1280]){
  test(`empty saved illustration stays centered at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
    await page.goto("/?lang=cs&nostory",{waitUntil:"domcontentloaded"});
    await page.locator(".tt-night-events .tp-seg button").nth(2).click();
    const empty=page.locator(".tt-night-events .tp-events-empty.is-compact");
    const picture=empty.locator(".tt-empty-graphic");
    await expect(picture).toBeVisible();
    const alignment=await picture.evaluate(tile=>{
      const outer=tile.getBoundingClientRect();
      const graphic=tile.querySelector(".tt-empty-graphic-glyph")!.getBoundingClientRect();
      const logo=tile.querySelector(".tp-poster-art-tag")!.getBoundingClientRect();
      return {
        centered:Math.abs((outer.left+outer.width/2)-(graphic.left+graphic.width/2))<=1,
        logoCentered:Math.abs((outer.left+outer.width/2)-(logo.left+logo.width/2))<=1,
        imageLoaded:getComputedStyle(tile.querySelector(".tt-empty-graphic-glyph")!).backgroundImage.includes("glyph-burst.svg"),
        pageFits:document.documentElement.scrollWidth<=innerWidth+1,
      };
    });
    expect(alignment).toEqual({centered:true,logoCentered:true,imageLoaded:true,pageFits:true});
  });
}
