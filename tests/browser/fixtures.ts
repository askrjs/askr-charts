import { test as base, expect } from "@playwright/test";
import type { ChartsHarness } from "./harness";

declare global {
  interface Window {
    charts: ChartsHarness;
    /** Console output recorded by the guard installed in `consoleGuard`. */
    unexpectedConsoleOutput: string[];
  }
}

const HARNESS_URL = "/tests/browser/harness.html";

/**
 * Replaces the old `tests/browser/setup.ts` vitest setup file:
 *
 * - `consoleGuard` patches `console.warn`/`console.error` in the page and fails
 *   the test if either was called, exactly as the previous `afterEach` trap did.
 *   Patching in-page rather than listening to Playwright's `console` event is
 *   deliberate: the event also reports browser-internal advisories (such as
 *   Chromium's `getImageData` readback hint) that the vitest trap never saw.
 * - `harness` opens the static harness page and waits for `window.charts`.
 */
export const test = base.extend<{ consoleGuard: void; harness: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        window.unexpectedConsoleOutput = [];
        const warn = console.warn.bind(console);
        const error = console.error.bind(console);
        console.warn = (...values: unknown[]) => {
          warn(...values);
          window.unexpectedConsoleOutput.push(`warning: ${values.map(String).join(" ")}`);
        };
        console.error = (...values: unknown[]) => {
          error(...values);
          window.unexpectedConsoleOutput.push(`error: ${values.map(String).join(" ")}`);
        };
      });

      await use();

      if (page.isClosed()) return;
      const unexpected = await page
        .evaluate(() => window.unexpectedConsoleOutput ?? [])
        .catch(() => []);
      if (unexpected.length > 0)
        throw new Error(`Unexpected browser console output:\n${unexpected.join("\n")}`);
    },
    { auto: true },
  ],
  harness: [
    async ({ page, consoleGuard }, use) => {
      void consoleGuard;
      await page.goto(HARNESS_URL);
      await page.waitForFunction(() => Boolean(window.charts));
      await use();
    },
    { auto: true },
  ],
});

export { expect };
