import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export const sharedVitestConfig = defineConfig({
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    globals: true,
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});
