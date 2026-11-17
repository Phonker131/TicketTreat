import {test,expect} from "@playwright/test";

test("media upload and removal preserve unsaved organizer text",async({page})=>{
  const profile={slug:"test-organizer",display_name:"Saved name",bio:"Saved description for the organizer.",city:"Prague",website_url:"",instagram:"",published:false,logo_url:null,cover_url:null};
  await page.route("**/api/gateway/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/organizer-profile"))return route.fulfill({json:profile});
    if(path.endsWith("/manage/organizer-profile/media/logo"))return route.fulfill({json:{...profile,logo_url:route.request().method()==="DELETE"?null:"/test-logo.png"}});
    return route.fulfill({json:{}});
  });
  await page.goto("/admin/organizer-profile?lang=en");
  await expect(page.getByLabel("Organizer name",{exact:true})).toHaveValue("Saved name");
  await page.getByLabel("Organizer name",{exact:true}).fill("Unsaved new name");
  await page.locator('input[type="file"]').first().setInputFiles({name:"logo.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=","base64")});
  await expect(page.getByRole("status").filter({hasText:"Image uploaded"}).first()).toBeVisible();
  await expect(page.getByLabel("Organizer name",{exact:true})).toHaveValue("Unsaved new name");
  await page.getByRole("button",{name:"Remove",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Image removed"}).first()).toBeVisible();
  await expect(page.getByLabel("Organizer name",{exact:true})).toHaveValue("Unsaved new name");
});
