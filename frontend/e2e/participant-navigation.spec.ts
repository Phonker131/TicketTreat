import {expect,test} from "@playwright/test";

test("upcoming ticket opens with event details and cancelled tickets stay in history",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const guest={id:1,first_name:"Alex",visits:0,access_token:"fixture"};
  await page.route("**/auth/me",route=>route.fulfill({json:{guest,account:{first_name:"Alex",role:"participant"}}}));
  const activeTicket = {id:31,event_id:1,code:"TT-31",qr_token:"test-qr-token",ticket_status:"active",event:{id:1,title:"Future event",starts_at:"2099-02-12T20:00:00"}};
  await page.route("**/me/tickets/31",route=>route.fulfill({json:activeTicket}));
  await page.route("**/me/tickets",route=>route.fulfill({json:[
    activeTicket,
    {id:32,event_id:2,ticket_status:"cancelled",event:{id:2,title:"Cancelled event",starts_at:"2099-02-12T20:00:00"}}
  ]}));
  await page.goto("/tickets?lang=en");
  await page.getByRole("button",{name:"Essential only",exact:true}).click();
  const row = page.getByRole("link",{name:/Future event.*View ticket/i});
  await expect(row).toHaveAttribute("href","/tickets/31");
  await row.click();
  await expect(page.locator(".tt-ticket-front")).toBeVisible();
  await expect(page.locator(".tt-ticket-back")).toBeHidden();
  await page.getByRole("button",{name:"Show QR",exact:true}).click();
  await expect(page.locator(".tt-pass-qr img")).toBeVisible();
  await page.getByRole("button",{name:"Back to ticket"}).click();
  await expect(page.locator(".tt-ticket-front")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Cancelled event")).toHaveCount(0);
  await page.getByRole("button",{name:"History",exact:true}).click();
  await expect(page.getByRole("link",{name:/Cancelled event/i})).toHaveAttribute("href","/tickets/32");
});

test("recovery has its own page and offers a way back to sign in",async({page})=>{
  await page.goto("/login?lang=en");
  await page.getByRole("link",{name:"Forgot password?"}).click();
  await expect(page).toHaveURL(/\/password-recovery$/);
  await expect(page.getByRole("link",{name:"Log in",exact:true})).toHaveAttribute("href","/login");
});
