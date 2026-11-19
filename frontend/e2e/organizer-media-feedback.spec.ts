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

test("removing a linked gallery photo keeps unsaved event edits",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const photo="https://example.invalid/old.jpg";
  let urls=[photo];
  await page.route("**/api/gateway/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({json:{account_id:2,role:"organizer"}});
    if(path.endsWith("/gallery/remove-link")){
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({url:photo});
      urls=[];
      return route.fulfill({json:{status:"deleted"}});
    }
    if(path.endsWith("/manage/events/42"))return route.fulfill({json:{
      id:42,title:"Photo test",starts_at:"2030-10-10T10:00:00",languages:["en"],tags:[],
      external_gallery_urls:urls,gallery_urls:urls,uploaded_gallery:[],publication:{status:"draft",visible:false}
    }});
    if(path.endsWith("/participants"))return route.fulfill({json:{tickets:[],waitlist:[]}});
    return route.fulfill({json:[]});
  });
  await page.goto("/admin/events/42?lang=en#details");
  const title=page.locator("form.panel").getByRole("textbox").first();
  await title.fill("Unsaved title");
  const remove=page.getByRole("button",{name:"Remove photo",exact:true});
  page.once("dialog",dialog=>dialog.dismiss());
  await remove.click();
  await expect(remove).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(title).toHaveValue("Unsaved title");
  await expect(page.getByText("Photos in gallery: 0 / 8")).toBeVisible();
});
