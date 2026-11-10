import {calendarICS} from "../lib/event-actions";
import type {TicketTreatEvent} from "../lib/types";
import {test,expect} from "@playwright/test";

test("catalogue renders upcoming events through the live FastAPI gateway",async({page})=>{
  await page.goto("/");
  await expect(page.getByText("CI browser free event").first()).toBeVisible();
  await expect(page.locator("header .wordmark")).toHaveAttribute("aria-label","TicketTreat");
  await expect(page.locator(".tt-night-kicker").first()).toContainText("TICKETTREAT");
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

test("login uses HttpOnly cookie, not browser-stored bearer credentials",async({page})=>{
  await page.goto("/profile");
  await page.locator(".auth-tabs button").last().click();
  await page.locator('form input[type="email"]').first().fill("browser-e2e@example.invalid");
  await page.locator('form input[type="password"]').first().fill("Browser-only-testing-passphrase-2026");
  await page.locator('form button[type="submit"]').first().click();

  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem("tickettreat_web_auth"))).toBe("browser-session");
  // A user with the pre-rename browser marker retains the HttpOnly session.
  await page.evaluate(()=>{
    localStorage.setItem("crowdly_demo_web_auth","browser-session");
    localStorage.removeItem("tickettreat_web_auth");
  });
  await page.reload();
  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem("tickettreat_web_auth"))).toBe("browser-session");
  expect(await page.evaluate(()=>localStorage.getItem("crowdly_demo_web_auth"))).toBeNull();
  const cookies=await page.context().cookies();
  const session=cookies.find(c=>c.name==="tt_web_session");
  expect(session).toBeTruthy();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  expect(session?.value).not.toBe("browser-session");
  const result=await page.evaluate(async()=>{
    const response=await fetch("/api/gateway/demo/auth/me",{
      headers:{Authorization:"Bearer browser-session"},
    });
    return response.status;
  });
  expect(result).toBe(200);
  // Exercise a complete free-event browser flow via the same-origin BFF.
  const eventId=await page.evaluate(async()=>{
    const result=await fetch("/api/gateway/events");
    if(!result.ok)throw new Error("Event catalogue unavailable");
    const events=await result.json() as {id:number;title:string}[];
    const event=events.find(x=>x.title==="CI browser free event");
    if(!event)throw new Error("Missing test event");
    return event.id;
  });
  await page.goto(`/checkout/${eventId}`);
  await expect(page.locator(".checkout-summary")).toContainText("CI browser free event");
  await page.locator(".panel button.button-primary.button-wide").click();
  await page.waitForURL(/\/tickets\/\d+/);
  // Brandbook v1.1 shows the printed ticket first; its QR lives on the
  // separate, upright back. Check it before triggering a cancellation.
  await expect(page.locator(".tt-ticket-front")).toBeVisible();
  await page.getByRole("button",{name:/Показать QR|Show QR|Zobrazit QR|Показати QR/}).click();
  await expect(page.locator(".tt-ticket-front")).toBeHidden();
  await expect(page.locator(".tt-ticket-back .tt-pass-qr img")).toBeVisible();
  await expect(page.locator(".tt-ticket-back")).toHaveCSS("transform","none");
  // Telegram's specific-ticket shortcut must land on the QR side directly.
  await page.goto(page.url().split("?")[0]+"?show=qr");
  await expect(page.locator(".tt-ticket-front")).toBeHidden();
  await expect(page.locator(".tt-ticket-back .tt-pass-qr img")).toBeVisible();
  await page.getByRole("button",{name:/Назад к билету|Back to ticket|Zpět ke vstupence|Назад до квитка/}).click();
  await expect(page.locator(".tt-ticket-front")).toBeVisible();
  page.once("dialog",d=>d.accept());
  await page.locator("button.button-outline.button-wide").click();
  await expect(page.locator(".tt-pass-qr img")).toHaveCount(0);
});

test("mutating API requires a genuine browser Origin and app header",async({request})=>{
  const login=await request.post("/api/gateway/demo/auth/login",{
    data:{email:"browser-e2e@example.invalid",password:"Browser-only-testing-passphrase-2026"},
  });
  expect(login.status()).toBe(403);
  const catalogue=await request.get("/api/gateway/demo/config");
  expect(catalogue.status()).toBe(200);
});


test("TicketTreat PWA icon and manifest expose the active brand",async({request})=>{
  const icon=await request.get("/brand/icon/192");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
  const manifest=await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const data=await manifest.json();
  expect(data.name).toBe("TicketTreat");
  expect(data.icons.some((entry:{src:string})=>entry.src==="/brand/icon/192")).toBe(true);
});

test("calendar ICS DTSTART uses a valid venue-local DATE-TIME",()=>{
  const event={
    id:42,
    title:"Prague, Music; Night",
    description:"Bring friends",
    starts_at:"2026-11-09T19:30:00",
    location:"Example Hall",
    city:"Prague",
    country_code:"CZ",
  } as TicketTreatEvent;
  const ics=calendarICS(event,"https://tickettreat.eu/events/42");
  expect(ics).toContain("DTSTART:20261109T193000\r\n");
  expect(ics).toContain("SUMMARY:Prague\\, Music\\; Night");
  expect(ics).toContain("URL:https://tickettreat.eu/events/42");
  expect(ics).toContain("END:VCALENDAR");
});

test("existing Google-email accounts return to login, not registration",async({page})=>{
  await page.goto("/profile?google=link_required");
  await expect(page.locator(".auth-tabs button").last()).toHaveClass(/active/);
  await expect(page.getByText(/Войди по паролю и привяжи Google|Sign in with your password/i).first()).toBeVisible();
});

test("Google linking explains missing TicketTreat password instead of silently disabling its button",async({page})=>{
  // CI intentionally has no live Google credentials. Stub only capability status;
  // actual OAuth and account mutations still use the disposable CI backend.
  await page.route("**/api/gateway/demo/auth/google/status",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true})}));
  await page.goto("/profile");
  await page.locator(".auth-tabs button").last().click();
  await page.locator('form input[type="email"]').first().fill("browser-e2e@example.invalid");
  await page.locator('form input[type="password"]').first().fill("Browser-only-testing-passphrase-2026");
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator(".profile-overview")).toBeVisible();
  const button=page.getByRole("button",{name:/Link Google account|Привязать Google|Propojit účet Google|Прив’язати Google/});
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText(/Enter your TicketTreat account password first|Сначала введи пароль от аккаунта TicketTreat|Nejdříve zadej heslo TicketTreat|Спочатку введи пароль TicketTreat/)).toBeVisible();
});

test("public event can be shared with a canonical URL without needing external apps",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"share",{configurable:true,value:undefined});
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{
      writeText:async(value:string)=>{(window as unknown as {__ttSharedLink?:string}).__ttSharedLink=value;},
    }});
  });
  await page.goto("/?nostory&lang=en");
  const eventId=await page.evaluate(async()=>{
    const response=await fetch("/api/gateway/events");
    if(!response.ok)throw new Error("Test events unavailable");
    const events=await response.json() as {id:number;title:string}[];
    const event=events.find(item=>item.title==="CI browser free event");
    if(!event)throw new Error("Missing browser fixture event");
    return event.id;
  });
  await page.goto(`/events/${eventId}?lang=en`);
  const share=page.getByRole("button",{name:"Share event",exact:true});
  await expect(share).toBeVisible();
  await share.click();
  await expect(page.getByRole("status")).toContainText("Event link copied.");
  expect(await page.evaluate(()=>(window as unknown as {__ttSharedLink?:string}).__ttSharedLink))
    .toBe(`https://tickettreat.eu/events/${eventId}`);
  await expect(page.getByRole("link",{name:"Share event: Telegram"}))
    .toHaveAttribute("href",new RegExp("^https://t\\.me/share/url\\?"));
  await expect(page.getByRole("link",{name:"Share event: WhatsApp"}))
    .toHaveAttribute("href",new RegExp("^https://wa\\.me/\\?"));
});

test("manual check-in still works after four tickets with camera unavailable",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    localStorage.setItem("tickettreat_web_auth","browser-session");
    // The cookie overlay must not obscure the scanner's mobile check-in button.
    const now=Date.now();
    localStorage.setItem("tt_cookie_choice_v1",JSON.stringify({
      version:"2026-10-23/maps-v1",savedAt:new Date(now).toISOString(),
      expiresAt:new Date(now+86400000).toISOString(),
      necessary:true,externalMedia:false
    }));
    // Simulate an iOS permission-denied camera: manual admission must still work.
    Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{
      getUserMedia:async()=>{throw new DOMException("Permission denied","NotAllowedError");},
      enumerateDevices:async()=>[],
    }});
  });
  test.setTimeout(60_000);
  const scans:string[]=[];
  await page.route("**/api/gateway/api/v1/pilot/check-in",route=>{
    const payload=route.request().postDataJSON() as {qr_token:string};
    scans.push(payload.qr_token);
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({status:"checked_in",ticket:{
        id:scans.length,code:"CRD-000001",ticket_status:"active",
        guest:{first_name:"CI",last_name:"Attendee"},
        event:{title:"CI browser free event"}
      }})});
  });
  const jsErrors:string[]=[];
  page.on("pageerror",error=>jsErrors.push(error.message));
  await page.goto("/admin/check-in?lang=en",{waitUntil:"domcontentloaded"});
  const manual=page.locator("#tickettreat-manual-token");
  await expect(manual).toBeVisible();
  for(const code of ["CRD000011","CRD-000012","CRD000013","CRD000014"]){
    await manual.fill(code);
    await page.locator(".tt-checkin-buttons .button-primary").click();
    await expect(page.locator(".success-banner")).toContainText("Check-in successful");
    await expect(manual).toHaveValue("");
  }
  expect(scans).toEqual(["CRD000011","CRD-000012","CRD000013","CRD000014"]);
  expect(jsErrors).toEqual([]);
});
