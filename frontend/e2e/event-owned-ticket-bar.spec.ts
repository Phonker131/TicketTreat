import {createServer, type Server} from "node:http";
import {test, expect} from "@playwright/test";

const event={
  id:9383,title:"Already booked",organizer:"Amber Events",location:"Prague",
  description:"Existing booking",max_participants:30,registered_count:10,
  spots_left:20,price:"120",currency:"CZK",languages:["en","cs"],
  image_url:null,starts_at:"2027-11-26T19:20:00+01:00",is_cancelled:false,
};
let api:Server;
test.beforeAll(async()=>{
  api=createServer((req,res)=>{
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(req.url==="/events/9383"?event:[]));
  });
  await new Promise<void>(resolve=>api.listen(8000,"127.0.0.1",resolve));
});
test.afterAll(async()=>{
  api.closeAllConnections();
  await new Promise<void>(resolve=>api.close(()=>resolve()));
});

test("mobile event bar waits for identity before showing the existing ticket",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  let finishTickets!:()=>void;
  const ticketsReady=new Promise<void>(resolve=>{finishTickets=resolve;});
  await page.route("**/api/gateway/api/v1/auth/me",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({guest:{id:45,access_token:"verified-guest",first_name:"Guest",last_name:""}}),
  }));
  await page.route("**/api/gateway/api/v1/me/tickets",async route=>{
    await ticketsReady;
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify([{
      id:91,event_id:9383,ticket_status:"active",payment_status:"not_required",
    }])});
  });
  await page.goto("/events/9383?lang=en",{waitUntil:"domcontentloaded"});
  const bar=page.locator(".ev2-bar");
  await expect(bar).toContainText("Checking your registration");
  await expect(page.getByRole("link",{name:/Reserve|Book|Join/i})).toHaveCount(0);
  finishTickets();
  await expect(bar.getByRole("link",{name:"Open my ticket"})).toHaveAttribute("href","/tickets/91?show=qr");
  await expect(bar.getByRole("link",{name:"Open my ticket"})).not.toHaveClass(/tt-island/);
  await expect(page.locator("main.ev2").getByRole("link",{name:"Open my ticket"})).toHaveCount(2);
  await expect(page.getByRole("link",{name:/Reserve|Book|Join/i})).toHaveCount(0);
});

test("ticket lookup failure never offers a second booking",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem("tickettreat_web_auth","browser-session"));
  await page.route("**/api/gateway/api/v1/auth/me",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({guest:{id:45,access_token:"verified-guest",first_name:"Guest",last_name:""}}),
  }));
  await page.route("**/api/gateway/api/v1/me/tickets",route=>route.fulfill({
    status:503,contentType:"application/json",body:JSON.stringify({detail:"unavailable"}),
  }));
  await page.goto("/events/9383?lang=cs",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".ev2-bar").getByRole("button",{name:"Zkusit znovu"})).toBeVisible();
  await expect(page.locator("main.ev2").getByRole("link",{name:"Rezervovat místo"})).toHaveCount(0);
});
