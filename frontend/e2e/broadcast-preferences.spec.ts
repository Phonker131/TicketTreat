import {expect,test} from "@playwright/test";

test("Telegram settings link opens broadcasts and saves just the new-event opt-out",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  await page.route("**/auth/me",route=>route.fulfill({json:{
    account:{id:12,first_name:"Alex",last_name:"Test",email:"alex@example.test",role:"participant"},
    guest:{first_name:"Alex",visits:2},email_verified:true
  }}));
  let prefs={email_enabled:true,telegram_enabled:true,new_events_enabled:true};
  await page.route("**/auth/broadcast-preferences",route=>{
    if(route.request().method()==="PUT")prefs=route.request().postDataJSON();
    return route.fulfill({json:prefs});
  });
  await page.goto("/profile?lang=en&tab=broadcasts");
  const alerts=page.getByRole("checkbox",{name:"New public events on Telegram"});
  const telegram=page.getByRole("checkbox",{name:"Telegram broadcasts"});
  await expect(alerts).toBeChecked();
  await alerts.uncheck();
  await page.getByRole("button",{name:"Save preferences"}).click();
  await expect(page.getByRole("status").filter({hasText:"Your preferences have been saved."})).toBeVisible();
  expect(prefs).toEqual({email_enabled:true,telegram_enabled:true,new_events_enabled:false});
  await page.reload();
  await expect(alerts).not.toBeChecked();
  await expect(telegram).toBeChecked();
  await telegram.uncheck();
  await expect(alerts).toBeDisabled();
});
