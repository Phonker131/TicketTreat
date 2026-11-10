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

test("successful Telegram callback validates the new cookie and opens My tickets",async({page})=>{
  // A real email login is used only to seed the same HttpOnly session cookie
  // shape that the Telegram callback issues. Its bearer never enters JS.
  await page.goto("/profile?lang=en");
  await page.locator('form input[type="email"]').first().fill("browser-e2e@example.invalid");
  await page.locator('form input[type="password"]').first().fill("Browser-only-testing-passphrase-2026");
  await page.locator('form button[type="submit"]').first().click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("tickettreat_web_auth"))).toBe("browser-session");
  const cookie=(await page.context().cookies()).find(x=>x.name==="tt_web_session");
  expect(cookie?.httpOnly).toBe(true);
  // Telegram OIDC provides the cookie before this browser marker exists.
  await page.evaluate(()=>localStorage.removeItem("tickettreat_web_auth"));
  await page.goto("/profile?lang=en&telegram=success");
  await expect(page).toHaveURL(/\/tickets(?:\?.*)?$/);
  expect(new URL(page.url()).searchParams.has("telegram")).toBe(false);
  await expect(page.getByText("Telegram sign-in failed or expired. Please try again.")).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem("tickettreat_web_auth"))).toBe("browser-session");
});

test("failed Telegram OIDC message is one-time and does not split provider icons",async({page})=>{
  await page.route("**/api/gateway/demo/auth/telegram/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/status",route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.goto("/profile?lang=en&telegram=failed");
  await expect(page.getByText("Telegram sign-in failed or expired. Please try again.")).toBeVisible();
  await expect.poll(()=>new URL(page.url()).searchParams.has("telegram")).toBe(false);
  const buttons=page.locator(".tt-auth-social-row button.tt-auth-provider-button");
  await expect(buttons).toHaveCount(2);
  const coords=await buttons.evaluateAll(elements=>elements.map(el=>{
    const r=el.getBoundingClientRect();
    return {top:r.top,left:r.left,right:r.right};
  }));
  expect(Math.abs(coords[0].top-coords[1].top)).toBeLessThan(2);
  expect(coords[0].right).toBeLessThan(coords[1].left);
  await page.reload();
  await expect(page.getByText("Telegram sign-in failed or expired. Please try again.")).toHaveCount(0);
});

test("Telegram success marker without verified session is not reported as successful",async({page})=>{
  await page.goto("/profile?lang=en&telegram=success");
  await expect(page.getByText("We couldn't load your profile.",{exact:false})).toBeVisible();
  await expect(page.getByText("Telegram sign-in is complete.",{exact:true})).toHaveCount(0);
  await expect.poll(()=>new URL(page.url()).searchParams.has("telegram")).toBe(false);
});
