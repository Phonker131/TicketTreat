import {test,expect} from "@playwright/test";

test("organizer can edit and pause a previously created reward",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const reward={id:12,owner_account_id:2,title:"Early supporter",description:"Thanks!",
    kind:"badge",active:true,created_at:"2026-11-17T09:00:00Z"};
  const dashboard={events:[{id:15,title:"Music meetup",starts_at:"2026-11-20T18:00:00",owner_account_id:2}],
    rewards:[reward],attendees:[],grants:[]};
  let edited:Record<string,unknown>|null=null;
  await page.route("**/api/gateway/api/v1/manage/rewards**",route=>{
    if(route.request().method()==="GET")return route.fulfill({json:dashboard});
    if(route.request().method()==="PATCH"){
      edited=route.request().postDataJSON() as Record<string,unknown>;
      Object.assign(reward,edited);
      return route.fulfill({json:reward});
    }
    return route.fulfill({status:404,json:{detail:"fixture_not_found"}});
  });
  await page.goto("/admin/rewards/legacy?lang=en");
  await page.getByRole("button",{name:"Edit",exact:true}).click();
  const form=page.locator("form.tt-reward-edit-form");
  await form.getByLabel("Reward name").fill("VIP supporter");
  await form.getByLabel("Description (optional)").fill("Updated recognition");
  await form.getByLabel("Available for new awards").uncheck();
  await form.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByRole("status",{name:""}).filter({hasText:"Reward updated."})).toBeVisible();
  await expect(page.getByText("VIP supporter")).toBeVisible();
  await expect(page.getByText("Paused",{exact:true})).toBeVisible();
  expect(edited).toMatchObject({title:"VIP supporter",description:"Updated recognition",kind:"badge",active:false});
  // Reload from the API fixture: changes must not exist only in React state.
  await page.reload();
  await expect(page.getByText("VIP supporter")).toBeVisible();
  await expect(page.getByText("Paused",{exact:true})).toBeVisible();
  // Paused catalog items must no longer be available for new awards.
  await expect(page.getByText("Create a reward for this event's organizer first.")).toBeVisible();
});
