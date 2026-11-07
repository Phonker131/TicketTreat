import {test,expect} from "@playwright/test";

test("organizer draft form offers free events only",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  await page.route("**/api/gateway/api/v1/manage/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({account_id:2,email:"pilot@example.invalid",role:"organizer"})});
    if(path.endsWith("/manage/events"))return route.fulfill({status:200,contentType:"application/json",body:"[]"});
    return route.fulfill({status:404,contentType:"application/json",body:'{"detail":"fixture_not_found"}'});
  });
  await page.goto("/admin?lang=en",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:/Create event/}).click();
  const form=page.locator("form").filter({has:page.getByRole("heading",{name:"New event"})});
  // Price, currency and payment-confirmation fields cannot enter new drafts.
  const draft=await page.locator("form.panel.form-stack").first();
  await expect(draft).toBeVisible();
  await expect(draft.locator('[name="price"]')).toHaveCount(0);
  await expect(draft.locator('[name="payment_instructions"]')).toHaveCount(0);
  await expect(draft.locator('[name="currency"]')).toHaveCount(0);
});

test("paid checkout is read-only and offers no 24-hour reservation",async({page})=>{
  await page.route("**/api/gateway/events/995001",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({
      id:995001,title:"Historical paid event",organizer:"TicketTreat",
      location:"Prague",description:"Historical entry",
      max_participants:30,registered_count:0,spots_left:30,
      price:"200",currency:"CZK",languages:["en"],image_url:null,
      starts_at:"2026-12-15T19:00:00",is_cancelled:false,
    }),
  }));
  await page.route("**/api/gateway/demo/config",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({demo_payment_mode:false,verified_accounts_required:true}),
  }));
  await page.goto("/checkout/995001?lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Paid events paused"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Reserve a place for 24 hours/i})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Confirm payment/i})).toHaveCount(0);
});
