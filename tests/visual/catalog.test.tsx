import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { VisualCatalog } from "../../examples/catalog";
import "../../src/styles.css";
import "../../visual/visual.css";

const VISUAL_BASELINE_PALETTES = {
  light: [
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#be185d",
    "#ea580c",
    "#0f766e",
    "#4f46e5",
  ],
  dark: [
    "#2563eb",
    "#7c3aed",
    "#059669",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#f472b6",
    "#ea580c",
    "#0f766e",
    "#818cf8",
  ],
} as const;

describe("visual catalog baselines", () => {
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (!container) return;
    cleanupApp(container);
    container.remove();
    container = undefined;
  });

  for (const theme of ["light", "dark"] as const) {
    for (const width of [360, 520, 720] as const) {
      it(`should match every recipe given ${theme} theme at ${width}px`, async () => {
        await page.viewport(width + 32, 900);
        container = document.createElement("div");
        container.dataset.theme = theme;
        container.style.width = `${width}px`;
        container.style.setProperty("--ak-chart-transition-duration", "0ms");
        VISUAL_BASELINE_PALETTES[theme].forEach((color, index) => {
          container!.style.setProperty(`--ak-chart-series-${index + 1}`, color);
        });
        document.body.append(container);
        createIsland({ root: container, component: VisualCatalog });
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );

        const roots = [...container.querySelectorAll<HTMLElement>('[data-slot="plot-root"]')];
        expect(container.querySelectorAll("[data-visual-case]")).toHaveLength(4);
        expect(roots).toHaveLength(14);
        expect(
          roots.every(
            (root) =>
              Number(
                root.querySelector<HTMLElement>('[data-slot="plot-frame"]')?.dataset.markCount,
              ) > 0,
          ),
        ).toBe(true);

        for (const root of roots) {
          const label = root
            .querySelector('[data-slot="plot-graphic"]')
            ?.getAttribute("aria-label");
          if (!label) throw new Error("Visual recipe is missing its accessible label.");
          const locator = page.elementLocator(root);
          root.scrollIntoView({ block: "start" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await expect
            .element(locator)
            .toMatchScreenshot(
              `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${theme}-${width}`,
              {
                comparatorOptions: {
                  allowedMismatchedPixelRatio: 0.01,
                  threshold: 0.3,
                },
              },
            );
        }
      });
    }
  }
});
