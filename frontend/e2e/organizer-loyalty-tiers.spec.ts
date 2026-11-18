import {test,expect} from "@playwright/test";

test("loyalty rewards are configured per organizer and tier, never per event",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const defaults=(name:string)=>[
    {tier:"newcomer",required_visits:0,key:"basic_access",label_en:"Tickets and reminders",label_cs:"Vstupenky a připomínky",operational:true,enabled:true,editable_enabled:false},
    {tier:"regular",required_visits:3,key:"priority_waitlist",label_en:"Priority on the waitlist",label_cs:"Přednost na čekací listině",operational:true,enabled:true,editable_enabled:true},
    {tier:"insider",required_visits:6,key:"early_access",label_en:"Early registration",label_cs:"Dřívější registrace",operational:false,enabled:false,editable_enabled:false},
    {tier:"vip",required_visits:12,key:"vip_companion",label_en:`${name} VIP companion`,label_cs:"VIP doprovod",operational:false,enabled:false,editable_enabled:false},
  ];
  const dashboard={organizers:[
    {owner_account_id:2,name:"Amber Events",tiers:defaults("Amber")},
    {owner_account_id:3,name:"Another organizer",tiers:defaults("Another")},
  ]};
  let saved:{owner:number;tier:string;body:Record<string,unknown>}|null=null;
  await page.route("**/api/gateway/api/v1/manage/loyalty/tiers**",async route=>{
    const method=route.request().method(),path=new URL(route.request().url()).pathname;
    if(method==="GET")return route.fulfill({json:dashboard});
    if(method==="PUT"){
      const matched=path.match(/\/tiers\/(\d+)\/([a-z]+)$/);
      if(!matched)return route.fulfill({status:404});
      const owner=Number(matched[1]),tier=matched[2],body=route.request().postDataJSON();
      saved={owner,tier,body};
      const benefit=dashboard.organizers.find(o=>o.owner_account_id===owner)!.tiers.find(b=>b.tier===tier)!;
      Object.assign(benefit,{label_en:body.label_en,label_cs:body.label_cs,description_en:body.description_en,description_cs:body.description_cs,
        enabled:tier==="regular"?body.priority_enabled:benefit.enabled});
      return route.fulfill({json:benefit});
    }
    return route.fulfill({status:405});
  });
  await page.route("**/api/gateway/api/v1/manage/loyalty/thresholds/*",async route=>{
    const owner=Number(new URL(route.request().url()).pathname.split("/").pop());
    const settings=route.request().postDataJSON();
    const org=dashboard.organizers.find(o=>o.owner_account_id===owner)!;
    for(const tier of org.tiers){if(tier.tier!=="newcomer")tier.required_visits=settings[tier.tier];}
    return route.fulfill({json:{tiers:org.tiers}});
  });
  await page.goto("/admin/rewards?lang=en");
  await expect(page.getByRole("heading",{name:"Organizer loyalty rewards"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"VIP",exact:true})).toBeVisible();
  await expect(page.locator(".tt-reward-admin-grid > section")).toHaveCount(4);
  const regular=page.locator(".tt-reward-admin-grid > section").filter({has:page.getByRole("heading",{name:"Regular"})});
  await regular.getByRole("button",{name:"Edit reward"}).click();
  await regular.getByLabel("Reward (English)").fill("VIP queue priority");
  await regular.getByLabel("Reward (Czech)").fill("VIP pořadník");
  await regular.getByLabel("Details (English)").fill("For repeat visitors");
  await regular.getByLabel("Details (Czech)").fill("Pro pravidelné hosty");
  await regular.getByLabel("Enable waitlist priority").uncheck();
  await regular.getByRole("button",{name:"Save changes"}).click();
  await expect(regular.getByText("VIP queue priority")).toBeVisible();
  await expect(regular.getByText("Paused")).toBeVisible();
  expect(saved).toMatchObject({owner:2,tier:"regular",body:{label_en:"VIP queue priority",label_cs:"VIP pořadník",description_en:"For repeat visitors",description_cs:"Pro pravidelné hosty",priority_enabled:false}});
  await page.reload();
  await expect(regular.getByText("VIP queue priority")).toBeVisible();
  await page.getByLabel("Organizer",{exact:true}).selectOption("3");
  await expect(regular.getByText("Priority on the waitlist")).toBeVisible();
  await expect(regular.getByText("Active")).toBeVisible();
  await page.getByLabel("Regular",{exact:true}).fill("2");
  await page.getByLabel("Insider",{exact:true}).fill("2");
  await expect(page.getByRole("button",{name:"Save visit thresholds"})).toBeDisabled();
  await page.getByLabel("Insider",{exact:true}).fill("5");
  await page.getByLabel("VIP",{exact:true}).fill("9");
  await page.getByRole("button",{name:"Save visit thresholds"}).click();
  await expect(page.getByRole("status").filter({hasText:"Visit thresholds saved."})).toBeVisible();
  await expect(regular.getByText("2 verified visits per quarter")).toBeVisible();
  await page.reload();
  await page.getByLabel("Organizer",{exact:true}).selectOption("3");
  await expect(page.getByLabel("VIP",{exact:true})).toHaveValue("9");
  await page.getByLabel("Organizer",{exact:true}).selectOption("2");
  await expect(page.getByLabel("VIP",{exact:true})).toHaveValue("12");
  // The dashboard no longer asks users to choose an individual event/guest.
  await expect(page.getByRole("button",{name:"Award guest"})).toHaveCount(0);
});
