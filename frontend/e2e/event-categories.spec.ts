import {test,expect} from "@playwright/test";

const categories=[
 {key:"meet",en:"Meet people",cs:"Seznámit se",active:true},
 {key:"friends",en:"With friends",cs:"S přáteli",active:false},
 {key:"cat_0123456789abcdef0123456789abcdef",en:"Board games",cs:"Deskové hry",active:true},
];
const event={
 id:995063,title:"Friday board games",organizer:"Amber Events",organizer_profile:null,
 location:"Prague",country_code:"CZ",city:"Praha",description:"A friendly evening",
 max_participants:30,registered_count:1,spots_left:29,price:"0",currency:"CZK",
 languages:["en"],image_url:null,starts_at:"2026-11-28T19:00:00",
 is_cancelled:false,tags:["cat_0123456789abcdef0123456789abcdef"],
};

for(const locale of ["en","cs"] as const){
 test(`custom event category is translated and filterable in ${locale}`,async({page})=>{
  await page.route("**/api/gateway/events",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify([event])}));
  await page.route("**/api/gateway/api/v1/event-categories",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(categories)}));
  await page.goto(`/?lang=${locale}&nostory`);
  const filters=page.locator(".tt-night-events .tp-moods");
  await expect(filters.getByRole("button",{name:locale==="cs"?"Deskové hry":"Board games"})).toBeVisible();
  await expect(filters.getByRole("button",{name:/With friends|S přáteli/})).toHaveCount(0);
  await filters.getByRole("button",{name:locale==="cs"?"Deskové hry":"Board games"}).click();
  await expect(page.locator(`.tt-night-events a[href^="/events/${event.id}"]`).first()).toBeVisible();
 });
}

test("global admin creates, renames and archives event categories",async({page})=>{
 let rows=[...categories];
 await page.route("**/api/gateway/api/v1/manage/me",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({role:"global_admin",account_id:1})}));
 await page.route("**/api/gateway/api/v1/event-categories",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows)}));
 await page.route("**/api/gateway/api/v1/manage/event-categories",route=>{
  const names=route.request().postDataJSON();
  rows=[...rows,{key:"cat_fedcba9876543210fedcba9876543210",en:names.en,cs:names.cs,active:true}];
  return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify(rows)});
 });
 await page.route("**/api/gateway/api/v1/manage/event-categories/*",route=>{
  const key=route.request().url().split("/").pop();
  const body=route.request().postDataJSON();
  rows=rows.map(row=>row.key===key?{...row,...body}:row);
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows)});
 });
 await page.goto("/admin/categories?lang=en");
 await expect(page.getByRole("heading",{name:"Event categories"})).toBeVisible();
 await page.getByRole("textbox",{name:"English name"}).first().fill("Chess events");
 await page.getByRole("textbox",{name:"Czech name"}).first().fill("Šachové akce");
 await page.getByRole("button",{name:"Add category"}).click();
 const cat=page.getByText("Chess events",{exact:true});
 await expect(cat).toBeVisible();
 await cat.locator("xpath=../..").getByRole("button",{name:"Edit"}).click();
 const edit=page.locator("form").filter({has:page.getByRole("button",{name:"Save names"})});
 await edit.getByRole("textbox",{name:"English name"}).fill("Board games");
 await edit.getByRole("button",{name:"Save names"}).click();
 // The existing fixture already has a "Board games" category. Select the
 // newly renamed row rather than relying on an ambiguous page-wide match.
 const updated=page.getByText("Board games",{exact:true}).last();
 await expect(updated).toBeVisible();
 await updated.locator("xpath=../..").getByRole("button",{name:"Archive"}).click();
 await expect(page.locator("section.panel").last()).toContainText("Board games");
 await expect(page.locator("section.panel").last().getByRole("button",{name:"Restore"})).toBeVisible();
});
