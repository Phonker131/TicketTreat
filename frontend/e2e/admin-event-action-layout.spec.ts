import {test,expect} from "@playwright/test";

const eventId=991807;
const cancelledEvent={
  id:eventId,title:"WEREWOLF",organizer:"Test organizer",location:"Prague",
  country_code:"CZ",city:"Prague",description:"Test event",max_participants:20,
  registered_count:0,price:"0",currency:"CZK",languages:["en"],
  image_url:null,starts_at:"2026-11-30T18:00:00",
  is_cancelled:true,cancellation_reason:"Event cancelled",
  publication:{status:"published",publish_at:null,visible:true},
  visibility:"public",owner_account_id:1,
};

test("cancelled event controls stay aligned on iPhone and deletion requires ID",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    localStorage.setItem("tickettreat_web_auth","browser-session");
    localStorage.setItem("tt4-theme","dark");
  });
  let deleteCalls=0;
  await page.route("**/api/gateway/api/v1/manage/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({
      status:200,contentType:"application/json",body:JSON.stringify({
        account_id:1,email:"organizer@example.invalid",role:"organizer"
      })
    });
    if(path.endsWith(`/manage/events/${eventId}/participants`))return route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify({event:cancelledEvent,tickets:[],waitlist:[]})
    });
    if(path.endsWith(`/manage/events/${eventId}`)){
      if(route.request().method()==="DELETE"){
        deleteCalls++;
        return route.fulfill({status:200,contentType:"application/json",
          body:JSON.stringify({status:"deleted",event_id:eventId})});
      }
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify(cancelledEvent)});
    }
    if(path.endsWith("/manage/events"))return route.fulfill({
      status:200,contentType:"application/json",body:"[]"
    });
    return route.fulfill({status:404,contentType:"application/json",
      body:JSON.stringify({detail:"not_available_in_fixture"})});
  });
  await page.goto(`/admin/events/${eventId}`,{waitUntil:"domcontentloaded"});
  const controls=page.locator(".tt-admin-event-toolbar");
  await expect(controls).toBeVisible();
  await expect(controls.getByRole("button",{name:"Delete event"})).toBeVisible();
  await expect(controls.getByRole("button",{name:"Export CSV"})).toBeVisible();
  await expect(controls.getByRole("link",{name:"Scan QR"})).toBeVisible();
  await expect(controls.getByRole("link",{name:"Preview"})).toBeVisible();
  await expect(controls.getByRole("button",{name:"Duplicate event"})).toBeVisible();

  for(const theme of ["dark","light"]){
    await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
    },theme);
    const bounds=await controls.locator(".button").evaluateAll(elements=>
      elements.map(e=>{const r=e.getBoundingClientRect();
        return {left:r.left,right:r.right,width:r.width,height:r.height};}));
    for(const b of bounds){
      expect(b.left).toBeGreaterThanOrEqual(-1);
      expect(b.right).toBeLessThanOrEqual(391);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  }

  // A declined ID prompt must not delete the record.
  let promptCount=0;
  page.on("dialog",async dialog=>{
    if(dialog.type()==="confirm"){await dialog.accept();return;}
    promptCount++;
    if(promptCount===1)await dialog.dismiss();
    else await dialog.accept(String(eventId));
  });
  await controls.getByRole("button",{name:"Delete event"}).click();
  expect(deleteCalls).toBe(0);

  // Confirm then type the event ID: remove once and return to the admin list.
  await controls.getByRole("button",{name:"Delete event"}).click();
  await expect.poll(()=>page.evaluate(()=>location.pathname)).toBe("/admin");
  expect(deleteCalls).toBe(1);
});
