import {test,expect} from "@playwright/test";

test("Telegram login fallback opens bot approval, not a second sign-up",async({page})=>{
  await page.route("**/api/gateway/demo/auth/telegram/status",route=>
    route.fulfill({contentType:"application/json",body:JSON.stringify({enabled:false})}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/status",route=>
    route.fulfill({contentType:"application/json",body:JSON.stringify({enabled:true})}));
  const challenge="A".repeat(43);
  await page.route("**/api/gateway/demo/auth/telegram/browser/start",route=>
    route.fulfill({contentType:"application/json",body:JSON.stringify({
      challenge,bot_link:"https://t.me/TicketTreatBot?start=login_"+challenge,
      expires_in_seconds:600
    })}));
  await page.route("**/api/gateway/demo/auth/telegram/browser/complete",route=>
    route.fulfill({contentType:"application/json",body:JSON.stringify({status:"pending"})}));
  await page.goto("/profile?lang=en");
  const tg=page.getByRole("button",{name:"Continue with Telegram"});
  await expect(tg).toBeVisible();
  await tg.click();
  await expect(page.getByRole("link",{name:"Approve in Telegram"})).toHaveAttribute(
    "href","https://t.me/TicketTreatBot?start=login_"+challenge);
  await expect(page.getByText("Open @TicketTreatBot and approve the login.")).toBeVisible();
});

test("Telegram callback without matching browser verifier cannot log in",async({request})=>{
  const response=await request.get(
    "/api/auth/telegram/callback?code=synthetic-code&state=synthetic-state",
    {maxRedirects:0});
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toContain("telegram=failed");
  expect(response.headers()["set-cookie"]||"").not.toMatch(/tt_web_session=[^;]/);
});
