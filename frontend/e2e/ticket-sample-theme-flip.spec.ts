import {test,expect} from "@playwright/test";

/**
 * Sample tickets use a masked surface inside a drop-shadow container.
 * Rotating both faces in 3D causes iOS Safari to flatten the stack and
 * mirror the printed QR side, especially after changing the color theme.
 * Check the upright, mutually exclusive faces at phone and desktop sizes.
 */
for(const viewport of [
  {name:"iPhone",width:390,height:844},
  {name:"desktop",width:1440,height:900},
]){
  test(`sample ticket stays upright on theme changes (${viewport.name})`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto("/tickets",{waitUntil:"domcontentloaded"});

    const stage=viewport.width<900
      ? page.locator(".tp-wallet-mobile")
      : page.locator(".tp-wallet");
    await expect(stage).toBeVisible();
    if(viewport.width<900){
      await stage.locator(".tp-dots button").last().click();
      await expect(stage.locator(".tp-dots button").last()).toHaveAttribute("aria-selected","true");
    }

    const sample=viewport.width<900
      ? stage.locator(".tp-embla-slide").last().locator(".tp-sample")
      : stage.locator(".tp-wallet-item").last().locator(".tp-sample");
    const control=sample.locator(".tp-flip");
    const front=sample.locator(".tp-face-front");
    const back=sample.locator(".tp-face-back");
    await expect(front).toBeVisible();
    await expect(back).toBeHidden();

    await control.click();
    await expect(control).toHaveAttribute("aria-pressed","true");
    await expect(front).toBeHidden();
    await expect(back).toBeVisible();
    await expect(back.getByText("Night Pass")).toBeVisible();

    for(let n=0;n<2;n++){
      const previousTheme=await page.evaluate(()=>document.documentElement.dataset.theme);
      const expectedTheme=previousTheme==="light"?"dark":"light";
      await page.locator(".tt-theme-toggle").click();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe(expectedTheme);
      await expect(back).toBeVisible();
      await expect(front).toBeHidden();
      const orientation=await sample.evaluate(el=>{
        const face=el.querySelector(".tp-face-back")!;
        const surface=el.querySelector(".tp-flip")!;
        return {
          backTransform:getComputedStyle(face).transform,
          surfaceTransform:getComputedStyle(surface).transform,
          frontDisplay:getComputedStyle(el.querySelector(".tp-face-front")!).display,
          backDisplay:getComputedStyle(face).display,
        };
      });
      expect(orientation.backTransform).toBe("none");
      expect(orientation.surfaceTransform).toBe("none");
      expect(orientation.frontDisplay).toBe("none");
      expect(orientation.backDisplay).not.toBe("none");
    }

    await control.press("Enter");
    await expect(control).toHaveAttribute("aria-pressed","false");
    await expect(front).toBeVisible();
    await expect(back).toBeHidden();
  });
}

test("mobile ticket guide is visible before the examples and details follow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tickets",{waitUntil:"domcontentloaded"});
  const section=page.locator(".tp-tickets-empty");
  await expect(section).toBeVisible();
  const summary=section.locator(".tp-te-summary");
  const stage=section.locator(".tp-te-stage");
  const details=section.locator(".tp-te-details");
  await expect(summary.getByRole("heading",{level:2})).toBeVisible();
  await expect(summary.locator(".tp-te-intro")).toBeVisible();
  await expect(stage.locator(".tp-wallet-mobile")).toBeVisible();
  await expect(details.locator(".tp-te-points li")).toHaveCount(3);

  // The formerly obscured explanation should precede the tall mobile carousel.
  await expect.poll(async()=>{
    const [a,b,c]=await Promise.all([summary.boundingBox(),stage.boundingBox(),details.boundingBox()]);
    return Boolean(a&&b&&c&&a.bottom<=b.y+2&&b.y+b.height<=c.y+2);
  }).toBe(true);

  await details.locator(".tp-te-actions a").scrollIntoViewIfNeeded();
  await expect(details.locator(".tp-te-actions a")).toBeInViewport();
});
