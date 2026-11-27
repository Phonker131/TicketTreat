import {expect,test} from "@playwright/test";

const events=Array.from({length:19},(_,index)=>({
  id:995100+index,title:`Desktop Event ${index+1}`,organizer:"Amber Events",
  organizer_profile:null,location:"Praha 1",country_code:"CZ",city:"Praha",
  description:"Desktop catalogue regression",max_participants:30,registered_count:2,
  spots_left:28,price:"100",currency:"CZK",languages:["en"],image_url:null,
  starts_at:`2026-12-${String(index+1).padStart(2,"0")}T19:00:00`,is_cancelled:false,
}));

test("wheel over the desktop feed scrolls events and releases the page at both edges",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
  await page.goto("/?lang=cs&nostory",{waitUntil:"domcontentloaded"});
  const grid=page.locator(".tt-night-events .event-grid.tt-feed-row");
  await expect(grid.locator(".event-card")).toHaveCount(8);
  await grid.hover();
  const start=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,160);
  await expect.poll(()=>grid.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>scrollY)).toBe(start);
  await page.mouse.wheel(0,-200);
  await expect.poll(()=>grid.evaluate(el=>el.scrollLeft)).toBe(0);
  await page.mouse.wheel(0,-120);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(start);
  await grid.hover();
  await page.mouse.wheel(0,8000);
  await expect.poll(()=>grid.evaluate(el=>el.scrollWidth-el.clientWidth-el.scrollLeft)).toBeLessThanOrEqual(1);
  const atEnd=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,140);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(atEnd);
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

for(const {width,height} of [{width:1280,height:600},{width:1366,height:768},{width:1920,height:1080}]){
  test(`desktop event cards and show-more control fit a ${width}x${height} screen`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(events)}));
    await page.goto("/?lang=cs&nostory",{waitUntil:"domcontentloaded"});
    const feed=page.locator(".tt-night-events .event-grid.tt-feed-row");
    await expect(feed.locator(".event-card")).toHaveCount(8);
    const measurements=await page.evaluate(()=>{
      const section=document.querySelector(".tt-night-events")!;
      const feed=document.querySelector(".tt-night-events .event-grid.tt-feed-row")!;
      const card=feed.querySelector<HTMLElement>(".event-card")!;
      const poster=card.querySelector<HTMLElement>(".tp-ecard-media")!;
      const pager=document.querySelector(".tt-night-events .tt-discovery-pagination")!;
      const lastBottom=Math.max(feed.getBoundingClientRect().bottom,pager.getBoundingClientRect().bottom);
      return {
        blockHeight:lastBottom-section.getBoundingClientRect().top,
        cardWidth:card.getBoundingClientRect().width,
        posterRatio:poster.getBoundingClientRect().height/poster.getBoundingClientRect().width,
        horizontalOverflow:feed.scrollWidth>feed.clientWidth,
      };
    });
    expect(measurements.blockHeight).toBeLessThanOrEqual(height+2);
    expect(measurements.posterRatio).toBeCloseTo(1.25,1);
    expect(measurements.horizontalOverflow).toBe(true);
    if(height===600)expect(measurements.cardWidth).toBeLessThan(200);
  });
}

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
