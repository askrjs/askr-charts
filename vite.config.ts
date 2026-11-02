import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  resolve: {
    alias: { "@askrjs/charts": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  pack: {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    tsconfig: "tsconfig.pack.json",
    dts: true,
    sourcemap: "hidden",
    clean: true,
    unbundle: true,
    copy: [
      {
        from: "src/styles.css",
        to: "dist",
        rename: "styles.css",
      },
      {
        from: "src/styles.d.ts",
        to: "dist",
        rename: "styles.d.ts",
      },
    ],
    deps: {
      neverBundle: [/^@askrjs\/askr(?:\/.*)?$/],
    },
  },
});
