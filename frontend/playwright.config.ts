import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  timeout:30_000,
  expect:{timeout:15_000},
  retries:0,
  workers:1,
  reporter:"list",
  use:{
    baseURL:"http://127.0.0.1:3000",
    trace:"retain-on-failure",
  },
  webServer:{command:"npm run start",url:"http://127.0.0.1:3000",reuseExistingServer:!process.env.CI,timeout:120_000},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
});
