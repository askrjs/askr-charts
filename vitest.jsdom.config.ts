import { defineConfig } from "vite-plus";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@askrjs/askr",
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
