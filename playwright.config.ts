import { defineConfig, devices } from "@playwright/test";

import { HARNESS_HOST, resolveHarnessServer } from "./tests/browser/harness-server";

// Local runs take a free port so parallel checkouts never share a harness;
// CI keeps the fixed port. Reuse is opt-in with `PW_REUSE_SERVER=1`, and the
// global setup refuses a reused harness that serves another checkout. See
// `tests/browser/harness-server.ts`.
const { port: PORT, baseURL: BASE_URL, reuseExistingServer } = await resolveHarnessServer();
const HOST = HARNESS_HOST;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./tests/browser/global-setup.ts",
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
    reuseExistingServer,
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
