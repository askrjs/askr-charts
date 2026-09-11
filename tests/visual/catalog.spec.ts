import { expect, test } from "../browser/fixtures";

const cases = [
  { theme: "light", width: 360, palette: "default" },
  { theme: "light", width: 520, palette: "default" },
  { theme: "light", width: 720, palette: "default" },
  { theme: "dark", width: 360, palette: "dark" },
  { theme: "dark", width: 520, palette: "dark" },
  { theme: "dark", width: 720, palette: "dark" },
] as const;

test.describe("visual catalog", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector('[data-slot="visual-catalog"]')?.parentElement?.remove();
    });
  });

  for (const { theme, width, palette } of cases) {
    test(`${theme} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width: width + 32, height: 900 });
      await page.evaluate(({ theme, width, palette }) => {
        const root = document.createElement("div");
        root.dataset.visualCatalogRoot = `${theme}-${width}`;
        root.style.width = `${width}px`;
        root.style.margin = "0 auto";
        root.dataset.theme = theme;
        root.dataset.palette = palette;
        document.body.append(root);
        window.charts.createIsland({
          root,
          component: () => window.charts.components.VisualCatalog(),
        });
      }, { theme, width, palette });

      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });

      await expect(page.locator("[data-visual-case]")).toHaveCount(4);
      await expect(page.locator('[data-slot="plot-root"]')).toHaveCount(14);
      const markCounts = await page.locator('[data-slot="plot-root"]').evaluateAll((roots) =>
        roots.map((root) => root.querySelectorAll('[data-slot="mark"]').length),
      );
      expect(markCounts.every((count) => count > 0)).toBe(true);

      const roots = page.locator('[data-slot="plot-root"]');
      for (let index = 0; index < await roots.count(); index += 1) {
        const root = roots.nth(index);
        await root.scrollIntoViewIfNeeded();
        const label = await root.getAttribute("aria-label");
        const name = (label ?? `plot-${index}`).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        await expect(root).toHaveScreenshot(`${name}-${theme}-${width}.png`, {
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
          threshold: 0.3,
        });
      }
    });
  }
});
