import {test,expect} from "@playwright/test";

/** Phone + Telegram WebView share the same responsive layout. */
for (const viewport of [{width:390,height:844},{width:320,height:667}]) {
  test(`cookie choices stay compact and usable at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.addInitScript(()=>localStorage.removeItem("tt_cookie_choice_v1"));
    await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
    const banner=page.getByTestId("tt-cookie-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-editing","false");
    const {height,bottom}=await banner.evaluate(el=>({
      height:el.getBoundingClientRect().height,bottom:el.getBoundingClientRect().bottom
    }));
    expect(height).toBeLessThanOrEqual(viewport.width===320?270:245);
    expect(bottom).toBeLessThanOrEqual(viewport.height);
    await expect(banner.getByRole("button",{name:"Accept all"})).toBeVisible();
    await expect(banner.getByRole("button",{name:"Essential only"})).toBeVisible();
    await expect(banner.getByRole("link",{name:"Cookie Policy"})).toBeVisible();
    await banner.getByRole("button",{name:"Customize"}).click();
    await expect(banner).toHaveAttribute("data-editing","true");
    await expect(banner.getByText("Embedded Google Maps")).toBeVisible();
    await banner.getByRole("button",{name:"Essential only"}).click();
    await expect(banner).toHaveCount(0);
  });
}

test("mobile swipe image keeps the full 4:5 poster instead of a short crop",async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>{
    const fixture=document.createElement("div");
    fixture.innerHTML=`<div class="tp-deck" style="width:340px">
      <div class="tp-deck-stage" style="width:320px">
        <article class="tp-deck-card"><div class="tp-deck-img">
          <img alt="Poster" src="/favicon.svg" />
        </div></article>
      </div></div>`;
    fixture.setAttribute("data-swiper-ratio-fixture","");
    document.body.appendChild(fixture);
  });
  const image=page.locator("[data-swiper-ratio-fixture] .tp-deck-img");
  const result=await image.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    const img=el.querySelector("img");
    return {ratio:rect.height/rect.width,fit:img?getComputedStyle(img).objectFit:""};
  });
  expect(result.ratio).toBeGreaterThan(1.23);
  expect(result.ratio).toBeLessThan(1.27);
  expect(result.fit).toBe("contain");
});

test("mobile event title and details have no oversized blank strip",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>{
    const fixture=document.createElement("div");
    fixture.className="app-shell";
    fixture.setAttribute("data-event-spacing-fixture","");
    fixture.innerHTML=`<main class="page event-page">
      <section class="event-hero">
        <div class="event-image" style="height:200px"></div>
        <div class="event-hero-copy">
          <div class="event-badges"></div><h1>Werewolf Night</h1>
        </div>
      </section>
      <section class="detail-grid"><div class="detail-item"><span>Starts</span><strong>20:00</strong></div></section>
    </main>`;
    document.body.appendChild(fixture);
  });
  const gap=await page.locator("[data-event-spacing-fixture]").evaluate(root=>{
    const hero=root.querySelector(".event-hero")!.getBoundingClientRect();
    const facts=root.querySelector(".detail-grid")!.getBoundingClientRect();
    return facts.top-hero.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(22);
});
