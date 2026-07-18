import { defineConfig } from "vite-plus";

export const sharedVitestConfig = defineConfig({
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
