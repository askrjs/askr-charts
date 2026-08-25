import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import * as publicApi from "../src";

const ROOT = join(import.meta.dirname, "..");
const TOKEN_DELEGATION = {
  "--ak-chart-font-family": "--ak-font-family-body",
  "--ak-chart-font-family-mono": "--ak-font-family-mono",
  "--ak-chart-font-size": "--ak-font-size-sm",
  "--ak-chart-font-size-small": "--ak-font-size-xs",
  "--ak-chart-font-size-title": "--ak-font-size-md",
  "--ak-chart-radius": "--ak-radius-lg",
  "--ak-chart-radius-small": "--ak-radius-sm",
  "--ak-chart-gap": "--ak-space-4",
  "--ak-chart-gap-small": "--ak-space-2",
  "--ak-chart-padding": "--ak-space-5",
  "--ak-chart-transition-duration": "--ak-duration-fast",
  "--ak-chart-transition-easing": "--ak-ease-standard",
  "--ak-chart-bg": "--ak-color-bg",
  "--ak-chart-surface": "--ak-color-surface",
  "--ak-chart-surface-muted": "--ak-color-surface-muted",
  "--ak-chart-surface-elevated": "--ak-color-surface-raised",
  "--ak-chart-border": "--ak-color-border",
  "--ak-chart-text": "--ak-color-text",
  "--ak-chart-text-muted": "--ak-color-text-muted",
  "--ak-chart-focus-ring": "--ak-color-focus-ring",
  "--ak-chart-tooltip-bg": "--ak-color-popover",
  "--ak-chart-tooltip-fg": "--ak-color-text-inverse",
  "--ak-chart-shadow": "--ak-shadow-md",
} as const;

describe("cross-package contract audit", () => {
  it("should construct every standalone aggregate expression with its public kind", () => {
    expect(publicApi.group("series").kind).toBe("group");
    expect(publicApi.mean("value").kind).toBe("mean");
    expect(publicApi.movingWindow("value", { window: 3, operation: "sum" }).kind).toBe(
      "moving-window",
    );
    expect(publicApi.normalize("value").kind).toBe("normalize");
    expect(publicApi.regression("value", { x: "time" }).kind).toBe("regression");
  });

  it("should delegate shared chart tokens to the themes token vocabulary", () => {
    const css = readFileSync(join(ROOT, "src/styles.css"), "utf8");
    for (const [chartToken, themeToken] of Object.entries(TOKEN_DELEGATION)) {
      expect(css, chartToken).toMatch(
        new RegExp(
          `${chartToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*var\\(\\s*${themeToken}`,
        ),
      );
    }
    for (let index = 1; index <= 10; index += 1) {
      expect(css).toContain(`--ak-chart-series-${index}: var(--ak-color-chart-series-${index},`);
    }
  });

  for (const document of ["README.md", "AGENTS.md", "CHARTING.md"] as const) {
    it(`should keep every ${document} fence nonempty and on a checked language surface`, () => {
      const source = readFileSync(join(ROOT, document), "utf8");
      const fences = [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gmu)];
      if (document !== "AGENTS.md") expect(fences.length, document).toBeGreaterThan(0);
      for (const [index, fence] of fences.entries()) {
        expect(["bash", "css", "ts", "tsx"]).toContain(fence[1]!.trim());
        expect(fence[2]!.trim(), `${document} fence ${index + 1}`).not.toBe("");
      }
    });
  }
});
