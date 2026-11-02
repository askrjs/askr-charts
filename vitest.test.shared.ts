import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export const sharedVitestConfig = defineConfig({
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    globals: true,
    // Vitest v4 compatibility: preserve mock history across tests.
    // Remove after confirming no assertions depend on setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Vitest v4 compatibility: initialize plugins and config hooks per project.
    // Remove after checking that tests do not depend on repeated setup.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    sharedViteServer: false,
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});
