import { defineConfig, devices } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = 4320;
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    // `vp dev` rather than a bare `vite`: vite-plus aliases the `vite` package
    // to `@voidzero-dev/vite-plus-core`, so a top-level `vite` binary is not
    // something this repo can rely on.
    command: `npx vp dev --config vite.harness.config.ts --mode production --strictPort --host ${HOST} --port ${PORT}`,
    url: `${BASE_URL}/tests/browser/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
