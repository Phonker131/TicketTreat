import {expect,test} from "@playwright/test";

test("an admin adds, hides and restores a category in the event form",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const rows:{key:string;en:string;cs:string;active:boolean}[]=[];
  await page.route("**/api/gateway/api/v1/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({json:{account_id:1,role:"global_admin",email:"admin@example.invalid"}});
    if(path.endsWith("/manage/events"))return route.fulfill({json:[]});
    if(path.endsWith("/event-categories")){
      if(route.request().method()==="POST")rows.push({...route.request().postDataJSON(),key:"cat_demo",active:true});
      return route.fulfill({json:rows});
    }
    if(path.endsWith("/event-categories/cat_demo")){
      rows[0].active=route.request().postDataJSON().active;
      return route.fulfill({json:rows});
    }
    return route.fulfill({json:{}});
  });
  await page.goto("/admin?lang=en");
  await page.getByText("Event categories",{exact:true}).click();
  await page.getByLabel("English name").fill("Pottery");
  await page.getByLabel("Czech name").fill("Keramika");
  await page.getByRole("button",{name:"Add category"}).click();
  await page.getByRole("button",{name:/Create event/}).click();
  const choice=page.getByRole("checkbox",{name:"Pottery"});
  await expect(choice).toBeVisible();
  await page.getByRole("button",{name:"Hide",exact:true}).click();
  await expect(choice).toHaveCount(0);
  await page.getByRole("button",{name:"Restore",exact:true}).click();
  await expect(choice).toBeVisible();
});
