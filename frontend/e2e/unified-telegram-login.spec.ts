import {expect,test} from "@playwright/test";

test("Telegram-first sign-in requests a separate browser PIN and opens bot approval",async({page})=>{
  const challenge="A".repeat(43);
  let approvals=0;
  await page.route("**/api/gateway/demo/auth/telegram/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:false})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/start",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      challenge,bot_link:"https://t.me/TicketTreatBot?start=login_"+challenge,
      pin:"123456",expires_in_seconds:600,
    })}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/complete",route=>{
    approvals++;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"pending"})});
  });
  await page.goto("/profile?lang=en");
  const button=page.getByRole("button",{name:"Continue with Telegram"});
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByText("123456",{exact:true})).toBeVisible();
  const link=page.getByRole("link",{name:"Approve in Telegram"});
  await expect(link).toHaveAttribute("href","https://t.me/TicketTreatBot?start=login_"+challenge);
  await expect(button).toBeDisabled();
  await expect.poll(()=>approvals).toBeGreaterThan(0);
});

test("pre-existing account linking remains available in profile",async({page})=>{
  await page.goto("/profile?lang=cs");
  // The site still exposes the email/password and Google login routes;
  // existing users are never forced into Telegram sign-in.
  await expect(page.locator("form input[type=email]").first()).toBeVisible();
  await expect(page.locator("form input[type=password]").first()).toBeVisible();
});

test("official Telegram OIDC failure offers existing-account bot login, not sign-up",async({page})=>{
  const challenge="B".repeat(43);
  await page.route("**/api/gateway/demo/auth/telegram/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/start",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      challenge,bot_link:"https://t.me/TicketTreatBot?start=login_"+challenge,
      pin:"654321",expires_in_seconds:600,
    })}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/complete",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"pending"})}));
  await page.goto("/profile?lang=en&telegram=failed");
  const fallback=page.getByRole("button",{name:"Sign in with the bot instead"});
  await expect(fallback).toBeVisible();
  await fallback.click();
  await expect(page.getByText("654321",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Approve in Telegram"}))
    .toHaveAttribute("href","https://t.me/TicketTreatBot?start=login_"+challenge);
  await expect(fallback).toHaveCount(0);
  await expect(page.locator("form input[type=email]").first()).toBeVisible();
});
