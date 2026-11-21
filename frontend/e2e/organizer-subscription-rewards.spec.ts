import {test,expect} from "@playwright/test";

const starter={tier:"starter",min_events:0,discount_pct:0};
const bronze={tier:"bronze",min_events:3,discount_pct:10};
const silver={tier:"silver",min_events:6,discount_pct:20};
const gold={tier:"gold",min_events:11,discount_pct:30};
const platinum={tier:"platinum",min_events:20,discount_pct:40};

test("organizer rewards show a three-month billing-free preview",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
 await page.route("**/api/gateway/**",route=>{
  if(new URL(route.request().url()).pathname.endsWith("/demo/manage/organizer-subscription-rewards"))
   return route.fulfill({json:{period_months:3,period_start:"2026-08-18T00:00:00+02:00",
    period_end:"2026-11-18T00:00:00+01:00",billing_active:false,discount_applied:false,
    preview_only:true,editable:false,levels:[starter,bronze,silver,gold,platinum],
    organizers:[{owner_account_id:2,name:"Amber Events",qualified_events:5,tier:"bronze",
     discount_pct:10,next_tier:"silver",next_threshold:6,events_to_next:1}]}});
  return route.fulfill({json:{}});
 });
 await page.goto("/admin/organizer-rewards?lang=en");
 await expect(page.getByRole("heading",{name:"Organizer Rewards"})).toBeVisible();
 await expect(page.getByText(/No money is charged/)).toBeVisible();
 await expect(page.getByRole("heading",{name:"Amber Events · Bronze"})).toBeVisible();
 await expect(page.getByText("1 / 6 · Silver",{exact:false})).toBeVisible();
 await expect(page.getByRole("button",{name:"Save discount levels"})).toHaveCount(0);
});

test("global admin may configure preview discounts, starter remains fixed",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
 let saved:unknown=null;
 await page.route("**/api/gateway/**",route=>{
  const url=new URL(route.request().url()).pathname;
  if(url.endsWith("/demo/manage/organizer-subscription-rewards/levels")&&route.request().method()==="PUT"){
   saved=route.request().postDataJSON();return route.fulfill({json:{levels:[starter,bronze,silver,gold,platinum],preview_only:true}});
  }
  if(url.endsWith("/demo/manage/organizer-subscription-rewards"))return route.fulfill({json:{
   period_months:3,period_start:"2026-08-18T00:00:00+02:00",period_end:"2026-11-18T00:00:00+01:00",
   billing_active:false,discount_applied:false,preview_only:true,editable:true,
   levels:[starter,bronze,silver,gold,platinum],organizers:[]}});
  return route.fulfill({json:{}});
 });
 await page.goto("/admin/organizer-rewards?lang=en");
 await expect(page.getByRole("button",{name:"Save discount levels"})).toBeVisible();
 await expect(page.getByLabel("Starter · Events needed")).toBeDisabled();
 await page.getByLabel("Bronze · Events needed").fill("5");
 await page.getByLabel("Bronze · Potential discount (%)").fill("15");
 await page.getByRole("button",{name:"Save discount levels"}).click();
 await expect.poll(()=>saved).not.toBeNull();
 expect(saved).toMatchObject({levels:[starter,{tier:"bronze",min_events:5,discount_pct:15}]});
});
