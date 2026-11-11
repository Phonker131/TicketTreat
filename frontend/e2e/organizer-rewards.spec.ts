import {test,expect} from "@playwright/test";

test("organizer reward panel creates badge and awards only a checked-in attendee",async({page})=>{
  await page.addInitScript(()=>{
    window.localStorage.setItem("tickettreat_web_auth","browser-session");
  });
  let created=0,granted=0;
  const dashboard={
    events:[{id:91,title:"Test creator event",owner_account_id:42}],
    rewards:[] as Array<{id:number;owner_account_id:number;title:string;description:string;kind:string;active:boolean;created_at:string}>,
    attendees:[{ticket_id:77,guest_id:101,guest_name:"Guest With Check-in",
      event_id:91,event_title:"Test creator event",owner_account_id:42,
      checked_in_at:"2026-11-11T11:00:00Z"}],
    grants:[] as Array<{id:number;reward_id:number;title:string;description:string;kind:string;
      ticket_id:number;event_id:number;event_title:string;guest_name:string;
      note:string;granted_at:string;revoked_at:string|null}>,
  };
  await page.route("**/api/gateway/api/v1/manage/rewards",async(route)=>{
    if(route.request().method()==="POST"){
      created++;
      const payload=route.request().postDataJSON();
      const reward={id:5,owner_account_id:42,title:payload.title,
        description:payload.description,kind:payload.kind,active:true,
        created_at:"2026-11-11T11:10:00Z"};
      dashboard.rewards.push(reward);
      return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify(reward)});
    }
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(dashboard)});
  });
  await page.route("**/api/gateway/api/v1/manage/rewards/5/grants",async(route)=>{
    granted++;
    const payload=route.request().postDataJSON();
    const result={id:9,reward_id:5,title:"Visitor Star",description:"",
      kind:"badge",ticket_id:payload.ticket_id,event_id:91,
      event_title:"Test creator event",guest_name:"Guest With Check-in",
      note:payload.note,granted_at:"2026-11-11T11:20:00Z",revoked_at:null};
    dashboard.grants.push(result);
    return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify(result)});
  });
  await page.goto("/admin/rewards");
  await expect(page.getByRole("heading",{name:"Attendance rewards"})).toBeVisible();
  await page.getByLabel("Reward name").fill("Visitor Star");
  await page.getByRole("button",{name:"Save reward"}).click();
  await expect.poll(()=>created).toBe(1);
  const awardForm=page.locator("form").filter({has:page.getByRole("button",{name:"Award guest"})});
  await awardForm.getByLabel("Checked-in attendee").selectOption("77");
  await awardForm.getByLabel("Choose a reward").selectOption("5");
  await awardForm.getByRole("button",{name:"Award guest"}).click();
  await expect.poll(()=>granted).toBe(1);
  await expect(page.getByText("Reward issued.")).toBeVisible();
  await expect(awardForm.getByRole("button",{name:"Award guest"})).toBeDisabled();
  await expect(page.getByText("Visitor Star").first()).toBeVisible();
});
