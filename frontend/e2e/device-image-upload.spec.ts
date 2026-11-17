import {test,expect} from "@playwright/test";

const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=","base64");

test("organizer can select posters and gallery photos without entering image URLs",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  await page.route("**/api/gateway/api/v1/manage/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/me"))return route.fulfill({json:{account_id:2,email:"pilot@example.invalid",role:"organizer"}});
    if(path.endsWith("/manage/events"))return route.fulfill({json:[]});
    return route.fulfill({status:404,json:{detail:"fixture_not_found"}});
  });
  await page.goto("/admin?lang=en",{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:/Create event/}).click();
  const form=page.locator("form.panel.form-stack").first();
  await expect(form.locator('input[name="poster"][type="file"]')).toHaveAttribute("accept","image/*");
  await expect(form.locator('input[name="gallery_files"][type="file"]')).toHaveAttribute("multiple","");
  await expect(form.locator('[name="gallery_urls"]')).toHaveCount(0);
  await form.locator('input[name="poster"]').setInputFiles({name:"phone.png",mimeType:"image/png",buffer:PNG});
  await expect(form.locator(".event-poster-preview")).toBeVisible();
});

test("organizer logo upload converts the selected device photo before sending",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  const profile={slug:"organizer-test",display_name:"Organizer test",bio:"Test description",city:"Prague",website_url:"",instagram:"",published:false,logo_url:null,cover_url:null};
  let uploaded="";
  await page.route("**/api/gateway/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/manage/organizer-profile")){
      return route.fulfill({json:profile});
    }
    if(path.endsWith("/manage/organizer-profile/media/logo")&&route.request().method()==="PUT"){
      uploaded=(route.request().postDataJSON() as {data_url:string}).data_url;
      return route.fulfill({json:{...profile,logo_url:"/api/gateway/demo/public/organizers/organizer-test/media/logo"}});
    }
    if(path.endsWith("/manage/organizer-profile/media/logo")){
      return route.fulfill({status:200,contentType:"image/png",body:PNG});
    }
    return route.fulfill({json:{}});
  });
  await page.goto("/admin/organizer-profile?lang=en");
  await page.locator('input[type="file"]').first().setInputFiles({name:"phone.png",mimeType:"image/png",buffer:PNG});
  await expect(page.getByRole("status").filter({hasText:"Image uploaded"}).first()).toBeVisible();
  await expect.poll(()=>uploaded).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.locator(".organizer-edit-logo")).toBeVisible();
});
