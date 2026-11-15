import {test,expect} from "@playwright/test";

const sender={id:91,sender_kind:"participant",body:"Can I bring a friend?",client_nonce:"0e66c79d-9d1e-4f9e-bf5f-efc51bb80021",
 created_at:"2026-11-15T12:00:00Z"};
const owner={id:92,sender_kind:"organizer",body:"You can ask at the door: <img src=x onerror=alert(1)>",
 client_nonce:"0e66c79d-9d1e-4f9e-bf5f-efc51bb80022",created_at:"2026-11-15T12:01:00Z"};
const fixture={id:4,event_id:77,event_title:"Werewolf Night",organizer:"Amber Events",
 organizer_account_id:11,participant_name:"Guest Example",status:"open",
 created_at:"2026-11-15T12:00:00Z",updated_at:"2026-11-15T12:01:00Z",unread:true};

for(const width of [320,390,1280]){
 test("guest chat is usable at "+width+"px and treats messages as text",async({page})=>{
  await page.setViewportSize({width,height:720});
  let messages=[sender,owner];
  await page.route("**/api/gateway/api/v1/me/chats**",async route=>{
   const url=new URL(route.request().url()),path=url.pathname;
   if(path.endsWith("/me/chats"))return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({threads:[fixture]})});
   if(path.endsWith("/messages")&&route.request().method()==="POST"){
    const body=route.request().postDataJSON() as {body:string;client_nonce:string};
    const msg={id:100+messages.length,sender_kind:"participant",body:body.body,
      client_nonce:body.client_nonce,created_at:new Date().toISOString()};
    messages.push(msg);return route.fulfill({status:201,contentType:"application/json",
      body:JSON.stringify({message:msg,duplicate:false})});
   }
   if(path.endsWith("/read"))return route.fulfill({status:200,contentType:"application/json",body:'{"status":"read"}'});
   return route.fulfill({status:200,contentType:"application/json",
     body:JSON.stringify({thread:fixture,messages,has_more:false})});
  });
  await page.goto("/messages?lang=en",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:"Messages"})).toBeVisible();
  await expect(page.getByText("Werewolf Night").first()).toBeVisible();
  const log=page.getByRole("log",{name:"Messages"});
  await expect(log.getByText("Can I bring a friend?")).toBeVisible();
  await expect(log.getByText(/You can ask at the door:/)).toBeVisible();
  expect(await log.locator("img").count()).toBe(0);
  await page.getByPlaceholder("Write a message…").fill("Thanks for the details!");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(log.getByText("Thanks for the details!")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 });
}

test("organizer can reply and close a thread",async({page})=>{
 await page.setViewportSize({width:390,height:760});
 let status="open";let messages=[sender];
 await page.route("**/api/gateway/api/v1/manage/chats**",async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith("/manage/chats")){
   return route.fulfill({status:200,contentType:"application/json",
    body:JSON.stringify({threads:[{...fixture,status}],unread:1})});
  }
  if(path.endsWith("/messages")&&route.request().method()==="POST"){
   const payload=route.request().postDataJSON() as {body:string;client_nonce:string};
   const msg={id:120+messages.length,sender_kind:"organizer",body:payload.body,
    client_nonce:payload.client_nonce,created_at:new Date().toISOString()};
   messages.push(msg);
   return route.fulfill({status:201,contentType:"application/json",
    body:JSON.stringify({message:msg,duplicate:false})});
  }
  if(path.endsWith("/read"))return route.fulfill({status:200,contentType:"application/json",body:'{"status":"read"}'});
  if(path.endsWith("/status")){
   const payload=route.request().postDataJSON() as {closed:boolean};
   status=payload.closed?"closed":"open";
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status})});
  }
  return route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({thread:{...fixture,status},messages,has_more:false})});
 });
 await page.goto("/admin/messages?lang=en",{waitUntil:"domcontentloaded"});
 await expect(page.getByRole("heading",{name:"Organizer inbox"})).toBeVisible();
 await page.getByPlaceholder("Write a message…").fill("Yes, you can.");
 await page.getByRole("button",{name:"Send",exact:true}).click();
 await expect(page.getByText("Yes, you can.")).toBeVisible();
 await page.getByRole("button",{name:"Close conversation"}).click();
 await expect(page.getByText("This conversation is closed.")).toBeVisible();
 await page.getByRole("button",{name:"Reopen"}).click();
 await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test("failed message POST keeps draft and composer instead of replacing chat with a retry card",async({page})=>{
  await page.setViewportSize({width:390,height:730});
  const thread={id:4,event_id:77,event_title:"Werewolf Night",organizer:"Amber Events",
    organizer_account_id:11,participant_name:"Guest Example",status:"open",
    created_at:"2026-11-15T12:00:00Z",updated_at:"2026-11-15T12:01:00Z",unread:false};
  await page.route("**/api/gateway/api/v1/me/chats**",async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/me/chats"))return route.fulfill({
      status:200,contentType:"application/json",body:JSON.stringify({threads:[thread]})
    });
    if(path.endsWith("/messages")&&route.request().method()==="POST")
      return route.fulfill({status:500,contentType:"application/json",
        body:JSON.stringify({detail:"internal_server_error"})});
    if(path.endsWith("/read"))return route.fulfill({
      status:200,contentType:"application/json",body:'{"status":"read"}'
    });
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({thread,messages:[],has_more:false})});
  });
  await page.goto("/messages?lang=en",{waitUntil:"domcontentloaded"});
  await page.getByPlaceholder("Write a message…").fill("Question about ticket?");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(page.getByPlaceholder("Write a message…")).toHaveValue("Question about ticket?");
  await expect(page.getByRole("log",{name:"Messages"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Try again"})).toHaveCount(0);
  await expect(page.locator(".tt-chat-error")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
