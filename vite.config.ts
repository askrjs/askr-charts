import { defineConfig } from "vite-plus";

const externalPackagePattern = /^@askrjs\/askr(?:\/.*)?$/;

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@askrjs/askr",
  },
  pack: {
    entry: {
      "components/index": "src/components/index.ts",
      "core/index": "src/core/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    platform: "neutral",
    tsconfig: "tsconfig.pack.json",
    dts: true,
    sourcemap: true,
    unbundle: true,
    deps: {
      neverBundle: [/^@askrjs\/askr(?:\/.*)?$/],
    },
  },
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        "components/index": "src/components/index.ts",
        "core/index": "src/core/index.ts",
      },
    },
    rollupOptions: {
      external: (id) => externalPackagePattern.test(id),
      output: [
        {
          dir: "dist",
          entryFileNames: "[name].js",
          exports: "named",
          format: "es",
          preserveModules: true,
          preserveModulesRoot: "src",
        },
      ],
    },
  },
});
