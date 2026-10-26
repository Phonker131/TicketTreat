import {defineConfig} from "@playwright/test";

// Use a separate production process and loopback API; never reuse a dev server.
process.env.TICKETTREAT_SEO_FIXTURE = "1";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "seo-crawlability.spec.ts",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure"},
  webServer: [
    {command: "node e2e/fixtures/seo-api.mjs", url: "http://127.0.0.1:8100/health", reuseExistingServer: false},
    {
      command: "npm run start -- --hostname 127.0.0.1", url: "http://127.0.0.1:3100", reuseExistingServer: false,
      env: {PORT: "3100", BACKEND_API_URL: "http://127.0.0.1:8100"}, timeout: 120_000,
    },
  ],
});
