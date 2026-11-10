import {expect,test} from "@playwright/test";

for(const language of ["en","cs"] as const){
  test(`compact provider icons and email copy fit narrow screens (${language})`,async({page})=>{
    await page.setViewportSize({width:320,height:740});
    await page.route("**/api/gateway/demo/auth/google/status",route=>
      route.fulfill({contentType:"application/json",body:JSON.stringify({enabled:true})}));
    await page.route("**/api/gateway/demo/auth/telegram/status",route=>
      route.fulfill({contentType:"application/json",body:JSON.stringify({enabled:false})}));
    await page.route("**/api/gateway/demo/auth/telegram/browser/status",route=>
      route.fulfill({contentType:"application/json",body:JSON.stringify({enabled:true})}));
    await page.goto(`/profile?lang=${language}`);
    const row=page.locator(".tt-auth-social-row");
    await expect(row).toBeVisible();
    const icons=row.locator("button.tt-auth-provider-button");
    await expect(icons).toHaveCount(2);
    await expect(icons.nth(0)).toHaveAttribute("aria-label",
      language==="en"?"Continue with Google":"Pokračovat přes Google");
    await expect(icons.nth(1)).toHaveAttribute("aria-label",
      language==="en"?"Continue with Telegram":"Pokračovat přes Telegram");
    expect(await icons.allTextContents()).toEqual(["",""]);
    await expect(row.locator("svg")).toHaveCount(2);
    await expect(page.locator(".tt-auth-method-divider")).toHaveText(
      language==="en"?"or with email":"nebo e-mailem");
    const form=page.locator("form.panel.form-stack").first();
    await expect(form.locator("input[type=email]")).toBeVisible();
    await expect(form.locator("input[type=password]")).toBeVisible();
    await expect(form.locator("h2")).toHaveText(language==="en"?"Sign in":"Přihlášení");
    for(const width of [320,375,390,768]){
      await page.setViewportSize({width,height:820});
      const measured=await icons.evaluateAll(buttons=>buttons.map(button=>{
        const b=button.getBoundingClientRect();
        return {left:b.left,right:b.right,width:b.width,height:b.height};
      }));
      expect(measured.every(b=>b.left>=0&&b.right<=width&&b.width>=50&&Math.abs(b.width-b.height)<=1))
        .toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    }
    await page.locator(".auth-tabs button").first().click();
    await expect(form.locator("h2")).toHaveText(language==="en"?"Create an account with email":"Registrace e-mailem");
    await expect(row.locator("button.tt-auth-provider-button")).toHaveCount(2);
    await expect(form.locator('input[type=email]')).toHaveCount(1);
  });
}
