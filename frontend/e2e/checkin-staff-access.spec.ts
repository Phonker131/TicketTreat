import {expect,test} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
});

test("event staff only scan the assigned event and see a clear scanner workflow",async({page})=>{
  let selectedEvent:number|null=null;
  await page.route("**/api/gateway/**/pilot/check-in-access",route=>route.fulfill({
    json:{can_scan_all:false,events:[{id:42,title:"Werewolf Night",starts_at:"2099-10-31T20:00:00",location:"Prague"}]}
  }));
  await page.route("**/api/gateway/**/pilot/check-in",async route=>{
    const request=route.request().postDataJSON() as {event_id:number|null;qr_token:string};
    selectedEvent=request.event_id;
    await route.fulfill({json:{status:"checked_in",ticket:{
      id:91,code:"CRD-000091",guest:{first_name:"Alex",last_name:"Staff"},
      event:{id:42,title:"Werewolf Night"}
    }}});
  });
  await page.goto("/admin/check-in?event=42&lang=en");
  await expect(page.getByText("Scanning event")).toBeVisible();
  await expect(page.locator("select")).toHaveValue("42");
  await expect(page.getByText("Werewolf Night",{exact:true})).toHaveCount(1);
  await page.locator("#tickettreat-manual-token").fill("CRD000091");
  await page.locator(".tt-checkin-buttons .button-primary").click();
  await expect(page.locator(".checkin-result")).toContainText("Alex Staff");
  expect(selectedEvent).toBe(42);
});

test("accounts without check-in assignments cannot access scanner controls",async({page})=>{
  await page.route("**/api/gateway/**/pilot/check-in-access",route=>route.fulfill({
    json:{can_scan_all:false,events:[]}
  }));
  await page.goto("/admin/check-in?lang=en");
  await expect(page.getByText(/No active check-in assignments/)).toBeVisible();
  await expect(page.locator("#tickettreat-manual-token")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Go to profile"})).toHaveAttribute("href","/profile");
});
