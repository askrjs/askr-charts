import { defineConfig } from "vite-plus";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
    exclude: ["tests/**/*.browser.test.tsx"],
  },
  resolve: {
    preserveSymlinks: true,
  },
});
