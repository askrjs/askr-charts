import { defineConfig } from "vite-plus";

export default defineConfig({
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
