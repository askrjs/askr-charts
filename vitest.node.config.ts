import { defineConfig } from "vite-plus";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@askrjs/askr",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    preserveSymlinks: true,
  },
});
