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
    test(`should render ${theme} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width: width + 32, height: 900 });
      await page.evaluate(
        ({ theme, width, palette }) => {
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
        },
        { theme, width, palette },
      );

      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });

      await expect(page.locator("[data-visual-case]")).toHaveCount(4);
      await expect(page.locator('[data-slot="plot-root"]')).toHaveCount(14);
      const roots = page.locator('[data-slot="plot-root"]');
      for (let index = 0; index < (await roots.count()); index += 1) {
        const root = roots.nth(index);
        await root.scrollIntoViewIfNeeded();
        const rendered = await root.evaluate((element) => {
          const frame = element.querySelector('[data-slot="plot-frame"]');
          const canvas = frame?.querySelector<HTMLCanvasElement>('[data-slot="plot-canvas-marks"]');
          return {
            marks: Number(frame?.getAttribute("data-mark-count") ?? 0),
            paintedPixels: canvas ? window.charts.countPaintedPixels(canvas) : 0,
            theme: element.closest<HTMLElement>("[data-theme]")?.dataset.theme,
            textColor: getComputedStyle(element).getPropertyValue("--ak-chart-text").trim(),
            graphicLabel:
              element.querySelector('[data-slot="plot-graphic"]')?.getAttribute("aria-label") ?? "",
          };
        });
        expect(rendered.marks).toBeGreaterThan(0);
        expect(rendered.paintedPixels).toBeGreaterThan(0);
        expect(rendered.theme).toBe(theme);
        expect(rendered.textColor).not.toBe("");
        expect(rendered.textColor).toContain(theme === "dark" ? "#fafafa" : "#18181b");
        expect(rendered.graphicLabel.length).toBeGreaterThan(4);
        const screenshot = await root.screenshot({ animations: "disabled" });
        expect(screenshot.length).toBeGreaterThan(0);
      }
    });
  }
});
