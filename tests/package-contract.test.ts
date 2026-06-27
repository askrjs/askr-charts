import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("package contract", () => {
  it("should exposes the root stylesheet entry and components barrel", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };

    expect(pkg.exports["."]).toBe("./src/index.css");
    expect(pkg.exports["./default/area-chart.css"]).toBe(
      "./src/charts/default/styles/display/area-chart.css",
    );
    expect(pkg.exports["./components"]).toMatchObject({
      types: "./dist/components/index.d.ts",
      import: "./dist/components/index.js",
    });
    expect(pkg.exports["./default/line-chart.css"]).toBe(
      "./src/charts/default/styles/display/line-chart.css",
    );
    expect(pkg.exports["./default/pie-chart.css"]).toBe(
      "./src/charts/default/styles/display/pie-chart.css",
    );
    expect(pkg.exports["./default/radial-gauge.css"]).toBe(
      "./src/charts/default/styles/display/radial-gauge.css",
    );
    expect(pkg.exports["./core"]).toMatchObject({
      types: "./dist/core/index.d.ts",
      import: "./dist/core/index.js",
    });
  });

  it("should keeps the template export map available", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };

    expect(pkg.exports["./templates/*"]).toBe("./templates/*");
  });

  it("should documents themes as optional rather than required", () => {
    const root = join(__dirname, "..");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const usage = readFileSync(join(root, "docs", "usage.md"), "utf8");

    expect(readme).toContain("npm install @askrjs/charts");
    expect(readme).not.toContain("npm install @askrjs/charts @askrjs/themes");
    expect(readme).toContain("`@askrjs/themes` is optional");
    expect(usage).toContain("It does not depend on `@askrjs/themes`");
  });
});
