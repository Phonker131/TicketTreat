import {expect,test} from "@playwright/test";

test("upcoming ticket opens its QR side and cancelled tickets stay in history",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const guest={id:1,first_name:"Alex",visits:0,access_token:"fixture"};
  await page.route("**/auth/me",route=>route.fulfill({json:{guest,account:{first_name:"Alex",role:"participant"}}}));
  await page.route("**/me/tickets",route=>route.fulfill({json:[
    {id:31,event_id:1,ticket_status:"active",event:{id:1,title:"Future event",starts_at:"2099-02-12T20:00:00"}},
    {id:32,event_id:2,ticket_status:"cancelled",event:{id:2,title:"Cancelled event",starts_at:"2099-02-12T20:00:00"}}
  ]}));
  await page.goto("/tickets?lang=en");
  await expect(page.getByRole("link",{name:/Future event/i})).toHaveAttribute("href","/tickets/31?show=qr");
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
