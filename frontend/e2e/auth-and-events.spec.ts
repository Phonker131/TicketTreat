import {calendarICS} from "../lib/event-actions";
import type {TicketTreatEvent} from "../lib/types";
import {test,expect} from "@playwright/test";

test("catalogue renders upcoming events through the live FastAPI gateway",async({page})=>{
  await page.goto("/");
  await expect(page.getByText("CI browser free event").first()).toBeVisible();
  await expect(page.locator("header .wordmark")).toContainText("TicketTreat");
  await expect(page.locator(".hero .eyebrow")).toHaveText("TICKETTREAT");
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
  await expect(page.locator(".qr-wrap img")).toBeVisible();
  page.once("dialog",d=>d.accept());
  await page.locator("button.button-outline.button-wide").click();
  await expect(page.locator(".qr-wrap img")).toHaveCount(0);
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
