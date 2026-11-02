import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Browser tests live in `playwright.config.ts` (`npm run test:browser`) and
    // are deliberately absent here: they no longer run under vitest.
    projects: ["./vitest.unit.config.ts", "./vitest.jsdom.config.ts"],
  },
});
