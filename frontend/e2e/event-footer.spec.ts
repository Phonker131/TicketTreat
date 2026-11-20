import {createServer, type Server} from "node:http";
import {test, expect} from "@playwright/test";

const event = {
  id: 9372, title: "Footer test", organizer: "Organizer", location: "Prague",
  description: "Test event", max_participants: 30, registered_count: 2,
  spots_left: 28, price: "250", currency: "CZK", languages: ["en"],
  image_url: null, starts_at: "2027-12-10T18:00:00+01:00", is_cancelled: false
};
// Next renders event pages on the server before browser route mocks can run.
let api: Server;
test.beforeAll(async () => {
  api = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(req.url === "/events/9372" ? event : []));
  });
  await new Promise<void>(resolve => api.listen(8000, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>(resolve => api.close(() => resolve()));
});

for (const width of [390, 768, 999, 1200]) {
  test(`event footer links clear the booking bar at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 844});
    await page.route("**/api/gateway/events/9372", route => route.fulfill({json: event}));
    await page.goto("/events/9372?lang=en");
    const bar = page.locator(".ev2-bar");
    await expect(bar).toHaveCount(1);
    const consent = page.getByRole("button", {name: "Essential only", exact: true});
    if (await consent.isVisible()) await consent.click();
    const footer = page.locator(".tt-legal-footer");
    const telegram = footer.getByRole("link", {name: "Official TicketTreat Telegram bot"});
    if (width < 1000) {
      await expect(bar).toBeVisible();
      // Also exercise changes to the bar height after the initial render.
      await bar.evaluate(el => {el.style.minHeight = "140px";});
      await expect.poll(() => page.evaluate(() =>
        parseFloat(getComputedStyle(document.body).paddingBottom)
      )).toBeGreaterThan(150);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(async () => {
        const linkBox = await telegram.boundingBox();
        const barBox = await bar.boundingBox();
        return !!linkBox && !!barBox && linkBox.y + linkBox.height < barBox.y;
      }).toBe(true);
    } else {
      await expect(bar).toBeHidden();
    }
    for (const link of await footer.locator("a, button").all()) {
      await link.click({trial: true});
    }
    await footer.locator('a[href="/support"]').click();
    await expect(page).toHaveURL(/\/support/);
    await expect(bar).toHaveCount(0);
    await expect.poll(() => page.evaluate(() =>
      document.body.style.getPropertyValue("--event-booking-bar-height")
    )).toBe("");
  });
}
