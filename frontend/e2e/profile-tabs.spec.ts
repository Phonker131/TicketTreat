import {expect, test} from "@playwright/test";

test("participants see one profile section at a time", async ({page}) => {
  await page.route("**/auth/me", route => route.fulfill({json: {
    account: {id: 12, first_name: "Alex", last_name: "Test", email: "alex@example.test", role: "participant"},
    guest: {first_name: "Alex", visits: 2}, email_verified: true
  }}));
  await page.goto("/profile?lang=en");
  const panels = page.getByRole("tabpanel");
  await expect(panels).toHaveCount(1);
  await expect(panels).toHaveAttribute("id", "profile-panel-overview");
  for (const section of ["achievements", "details", "connections", "security"]) {
    const tab = page.locator("#profile-tab-" + section);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(panels).toHaveCount(1);
    await expect(panels).toHaveAttribute("id", "profile-panel-" + section);
  }
  await page.getByRole("tab", {selected:true}).press("Home");
  await expect(panels).toHaveAttribute("id", "profile-panel-overview");
});


test("profile achievements show awards and campaign benefits without leaving profile", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.route("**/auth/me", route => route.fulfill({json: {
    account: {id:12,first_name:"Alex",last_name:"Test",email:"alex@example.test",role:"participant"},
    guest:{first_name:"Alex",visits:2},email_verified:true
  }}));
  await page.route("**/api/v1/me/loyalty", route => route.fulfill({json:{
    season:"2026-Q4",scope:"per_organizer",total_lifetime_visits:2,studios:[],
    awards:[{id:1,title:"Community Star",kind:"badge",event_title:"Autumn meetup",description:"Helped new guests",note:"Thank you!"}],
    campaign_perks:[{id:2,reward_title:"Welcome bonus",organizer_name:"Test organizer",reward_details:"A special welcome"}]
  }}));
  await page.goto("/profile?lang=en");
  await expect(page.getByText("Community Star")).not.toBeVisible();
  await page.getByRole("tab",{name:"Achievements",exact:true}).click();
  await expect(page.getByText("Community Star",{exact:true})).toBeVisible();
  await expect(page.getByText("Welcome bonus",{exact:true})).toBeVisible();
  await expect(page.getByText("Autumn meetup",{exact:true})).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page).toHaveURL(/\/profile/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
