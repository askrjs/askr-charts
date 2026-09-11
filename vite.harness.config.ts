import { askr } from "@askrjs/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

/**
 * Minimal dev server used only to serve `tests/browser/harness.html` for the
 * native Playwright browser suite. The library build lives in `vite.config.ts`
 * (`vp pack`); nothing here is part of the published package.
 *
 * `server.host` is pinned to `127.0.0.1` on purpose: Vite otherwise binds
 * `localhost`, which CI runners can resolve to `::1` while Playwright's
 * `webServer` readiness probe polls the literal `127.0.0.1` address, producing
 * a silent 60s startup timeout that passes locally.
 */
export default defineConfig({
  plugins: [askr()],
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  // Scan only the harness entry; the default scan walks `examples/` too, which
  // contains React-flavoured samples that are not resolvable here.
  optimizeDeps: {
    entries: ["tests/browser/harness.tsx"],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  server: {
    host: "127.0.0.1",
    port: 4320,
    strictPort: true,
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@askrjs/askr",
    },
    jsxInject: "import { jsx, jsxs, Fragment } from '@askrjs/askr/jsx-runtime';",
  },
});
