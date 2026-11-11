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
  for (const section of ["details", "connections", "security"]) {
    const tab = page.locator("#profile-tab-" + section);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(panels).toHaveCount(1);
    await expect(panels).toHaveAttribute("id", "profile-panel-" + section);
  }
  await page.getByRole("tab", {selected:true}).press("Home");
  await expect(panels).toHaveAttribute("id", "profile-panel-overview");
});
