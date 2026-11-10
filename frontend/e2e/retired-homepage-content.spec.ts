import {test,expect} from "@playwright/test";

/* The former homepage banner CMS was retired when the new hard-coded
   localized hero was introduced. Old bookmarks should reach admin safely. */
test("retired homepage-content editor redirects to admin",async({request})=>{
  const response=await request.get("/admin/content",{maxRedirects:0});
  expect([307,308]).toContain(response.status());
  expect(new URL(response.headers().location!,"http://127.0.0.1:3000").pathname).toBe("/admin");
});

test("homepage has the current branded hero without legacy landing request",async({page})=>{
  const staleRequests:string[]=[];
  page.on("request",req=>{
    if(req.url().includes("/demo/site/landing"))staleRequests.push(req.url());
  });
  await page.goto("/?lang=en&nostory",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#tt-night-title")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(staleRequests).toEqual([]);
  await expect(page.locator("#tt-night-title")).toContainText("YOUR TICKET");
});
