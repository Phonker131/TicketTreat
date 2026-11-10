import {test,expect} from "@playwright/test";

const sampleEvent={
  id:995047,title:"Prague Quiz Night",organizer:"Amber Events",
  organizer_profile:null,location:"Praha 1",country_code:"CZ",
  city:"Praha",description:"Trivia and friends",max_participants:30,
  registered_count:2,spots_left:28,price:"100",currency:"CZK",
  languages:["en"],image_url:null,starts_at:"2026-11-21T19:00:00",
  is_cancelled:false
};

// Regression: mood tags used to be a single masked, negative-margin horizontal
// scroller. That left "With friends" clipped at the right side on iOS Safari.
// All filter buttons must now fit on screen with meaningful gaps and tap targets.
for(const locale of ["en","cs"] as const){
  for(const width of [320,375,390,768,999]){
    test(`discovery tags fit in ${locale} at ${width}px`,async({page})=>{
      await page.setViewportSize({width,height:844});
      await page.route("**/api/gateway/events",route=>route.fulfill({
        status:200,contentType:"application/json",
        body:JSON.stringify([sampleEvent])
      }));
      await page.goto(`/?lang=${locale}&nostory`,{waitUntil:"domcontentloaded"});
      const controls=page.locator(".tt-night-events .tt-discovery-controls");
      const moods=controls.locator(".tp-moods");
      await expect(moods).toBeVisible();
      await expect(moods.locator("button")).toHaveCount(5);
      await expect(controls.locator(".tp-seg button")).toHaveCount(3);
      // All three modes must occupy a single row inside the rounded frame,
      // including at 320px where the tab labels and icons are the tightest.
      const tabs=await controls.locator(".tp-seg").evaluate(seg=>{
        const frame=seg.getBoundingClientRect();
        const buttons=[...seg.querySelectorAll("button")].map(el=>el.getBoundingClientRect());
        return {
          sameRow:buttons.every(rect=>Math.abs(rect.top-buttons[0].top)<1),
          withinFrame:buttons.every(rect=>rect.left>=frame.left-1&&rect.right<=frame.right+1&&rect.top>=frame.top-1&&rect.bottom<=frame.bottom+1),
          equalWidths:Math.max(...buttons.map(rect=>rect.width))-Math.min(...buttons.map(rect=>rect.width))<2,
          noOverflow:seg.scrollWidth<=seg.clientWidth+1
        };
      });
      expect(tabs,JSON.stringify(tabs)).toEqual({sameRow:true,withinFrame:true,equalWidths:true,noOverflow:true});
      const data=await controls.evaluate(ctl=>{
        const rect=(el:Element)=>el.getBoundingClientRect();
        const section=ctl.closest(".tt-night-events")!;
        const head=rect(section.querySelector(".section-heading")!);
        const bar=rect(ctl);
        const segmented=rect(ctl.querySelector(".tp-seg")!);
        const tags=ctl.querySelector<HTMLElement>(".tp-moods")!;
        const moodBox=rect(tags);
        const buttons=[...tags.querySelectorAll<HTMLButtonElement>(".tp-mood")];
        const viewportWidth=window.innerWidth;
        const within=(r:DOMRect)=>{
          return r.left>=-1&&r.right<=viewportWidth+1;
        };
        const chips=buttons.map(button=>{
          const b=rect(button),label=rect(button.querySelector("span")!);
          return {
            text:button.textContent?.trim(),
            withinViewport:within(b),
            withinRow:b.left>=moodBox.left-1&&b.right<=moodBox.right+1,
            minTapHeight:b.height>=44,
            textWithin:label.left>=b.left-1&&label.right<=b.right+1,
            noContentOverflow:button.scrollWidth<=button.clientWidth+1,
          };
        });
        return {
          viewportWidth,
          containerWidth:bar.width,
          withinViewport:within(bar)&&within(segmented)&&within(moodBox),
          headingGap:bar.top-head.bottom,
          controlGap:moodBox.top-segmented.bottom,
          noHorizontalScroller:tags.scrollWidth<=tags.clientWidth+1,
          noMask:getComputedStyle(tags).maskImage==="none"&&getComputedStyle(tags).webkitMaskImage==="none",
          documentFits:document.documentElement.scrollWidth<=viewportWidth+1,
          chips
        };
      });
      expect(data.withinViewport,JSON.stringify(data)).toBe(true);
      expect(data.headingGap).toBeGreaterThanOrEqual(7);
      expect(data.controlGap).toBeGreaterThanOrEqual(8);
      expect(data.noHorizontalScroller,JSON.stringify(data)).toBe(true);
      expect(data.noMask).toBe(true);
      expect(data.documentFits).toBe(true);
      for(const chip of data.chips){
        expect(chip.withinViewport,chip.text).toBe(true);
        expect(chip.withinRow,chip.text).toBe(true);
        expect(chip.minTapHeight,chip.text).toBe(true);
        expect(chip.textWithin,chip.text).toBe(true);
        expect(chip.noContentOverflow,chip.text).toBe(true);
      }
      await controls.locator(".tp-mood").nth(2).click();
      await expect(controls.locator(".tp-mood").nth(2)).toHaveAttribute("aria-pressed","true");
      await controls.locator(".tp-seg button").nth(1).click();
      await expect(controls.locator(".tp-seg button").nth(1)).toHaveAttribute("aria-pressed","true");
      await controls.locator(".tp-seg button").nth(2).click();
      const empty=page.locator(".tt-night-events .tp-events-empty.is-compact");
      await expect(empty).toBeVisible();
      const logo=empty.locator(".tp-ee-p2 .tp-poster-art-tag");
      await expect(logo).toHaveText("TICKETTREAT");
      const placement=await logo.evaluate(el=>{
        const tile=el.closest(".tp-ee-p2")!.getBoundingClientRect();
        const tag=el.getBoundingClientRect();
        return {fits:tag.left>=tile.left+5&&tag.right<=tile.right-5,
          pageFits:document.documentElement.scrollWidth<=window.innerWidth+1};
      });
      expect(placement,JSON.stringify(placement)).toEqual({fits:true,pageFits:true});
    });
  }
}
