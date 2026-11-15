import {test,expect} from "@playwright/test";

const response={
  events:[{id:123,title:"Werewolf Night",organizer_name:"Amber Events",
   starts_at:"2026-11-20T18:00:00+00:00",owner_account_id:42}],
  campaigns:[],
};

for(const width of [390,320]){
 test("marketing campaign editor works at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:820});
  await page.route("**/api/gateway/api/v1/manage/promotions",route=>{
   if(route.request().method()==="GET")return route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(response)});
   return route.fulfill({status:201,contentType:"application/json",
    body:JSON.stringify({id:1,status:"draft"})});
  });
  await page.goto("/admin/promotions?lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Marketing campaigns"}).first()).toBeVisible();
  await page.getByRole("button",{name:"24-hour VIP signup"}).click();
  const starts=page.getByLabel("Starts");
  const ends=page.getByLabel("Ends", {exact:true});
  const start=new Date(await starts.inputValue()),end=new Date(await ends.inputValue());
  expect(end.getTime()-start.getTime()).toBe(86400000);
  await expect(page.getByLabel("Campaign title")).toHaveValue("Amber Events · VIP 24h");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button",{name:"Instagram follow promotion"}).click();
  await expect(page.getByLabel("Instagram profile URL")).toBeVisible();
  await expect(page.getByLabel("Registration event")).toHaveCount(0);
 });
}
