import {test,expect} from "@playwright/test";

const eventId=991808;
const sampleEvent={
  id:eventId,title:"Translation check",organizer:"TicketTreat",location:"Prague",
  country_code:"CZ",city:"",description:"Test event",max_participants:20,
  registered_count:0,price:"0",currency:"CZK",languages:["en","cs"],
  image_url:null,starts_at:"2026-12-12T18:00:00",
  is_cancelled:false,cancellation_reason:null,
  publication:{status:"draft",publish_at:null,visible:false},
  visibility:"public",owner_account_id:1,
};

for(const [locale,label] of [["en","Save changes"],["cs","Uložit změny"]] as const){
  test(`event save button follows ${locale} UI language, not the event language`,async({page})=>{
    await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
    await page.route("**/api/gateway/api/v1/manage/**",route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith("/manage/me"))return route.fulfill({
        status:200,contentType:"application/json",
        body:JSON.stringify({account_id:1,email:"organizer@example.invalid",role:"organizer"})
      });
      if(url.pathname.endsWith(`/manage/events/${eventId}/participants`))return route.fulfill({
        status:200,contentType:"application/json",
        body:JSON.stringify({event:sampleEvent,tickets:[],waitlist:[]})
      });
      if(url.pathname.endsWith(`/manage/events/${eventId}`))return route.fulfill({
        status:200,contentType:"application/json",body:JSON.stringify(sampleEvent)
      });
      return route.fulfill({
        status:404,contentType:"application/json",
        body:JSON.stringify({detail:"fixture_not_available"})
      });
    });
    await page.goto(`/admin/events/${eventId}?lang=${locale}#details`,{waitUntil:"domcontentloaded"});
    const form=page.locator(".tp-tabpanel form").first();
    await expect(form.getByRole("button",{name:label,exact:true})).toBeVisible();
    await expect(form.getByRole("button",{name:"Сохранить изменения",exact:true})).toHaveCount(0);
  });
}

test("admin accounts show active accounts by default and optional archived merge records",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const active=[
    {account_id:13,name:"Main profile",email:"main@example.invalid",role:"participant",merged_into_account_id:null},
    {account_id:10,name:"Independent spare",email:"spare@example.invalid",role:"participant",merged_into_account_id:null},
    {account_id:3,name:"Unmerged account",email:"independent@example.invalid",role:"participant",merged_into_account_id:null},
  ];
  let observedArchivedRequests=0;
  await page.route("**/api/gateway/api/v1/manage/**",route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith("/manage/accounts")){
      const show=url.searchParams.get("include_merged")==="true";
      if(show)observedArchivedRequests++;
      const data=show?[...active,{
        account_id:21,name:"Merged shadow",email:null,role:"participant",merged_into_account_id:13
      }]:active;
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    }
    if(url.pathname.endsWith("/manage/global-admins"))return route.fulfill({
      status:200,contentType:"application/json",body:"[]"
    });
    return route.fulfill({status:404,contentType:"application/json",body:"{}"});
  });
  await page.goto("/admin/accounts?lang=en");
  await expect(page.getByText("Account #13")).toBeVisible();
  await expect(page.getByText("Account #21")).toHaveCount(0);
  await expect(page.getByText("Account #10")).toBeVisible();
  await expect(page.getByText("Account #3")).toBeVisible();
  await page.getByRole("checkbox",{name:"Show merged accounts (audit)"}).check();
  await expect.poll(()=>observedArchivedRequests).toBeGreaterThan(0);
  await expect(page.getByText("Account #21")).toBeVisible();
  await expect(page.getByText("Merged into account #13")).toBeVisible();
  const shadow=page.locator(".account-management-row").filter({hasText:"Merged shadow"});
  await expect(shadow.getByRole("button")).toHaveCount(0);
});
