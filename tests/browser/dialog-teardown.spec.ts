import { expect, test } from "./fixtures";

test.describe("nested container teardown", () => {
  test("should destroy a chart cleanly when its Dialog portal closes", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const container = harness.mount(() => harness.components.ChartDialog());
      await harness.flushPaint();

      const content = document.querySelector('[data-slot="dialog-content"]');
      const chart = content?.querySelector('[data-slot="plot-root"]');
      const close = content?.querySelector<HTMLButtonElement>('[data-testid="close-chart-dialog"]');
      const canvases = [...(chart?.querySelectorAll("canvas") ?? [])];

      const chartFound = chart != null;
      const closeFound = close != null;
      close!.click();
      await harness.flushPaint();

      const outcome = {
        chartFound,
        closeFound,
        contentAfterClose: document.querySelector('[data-slot="dialog-content"]'),
        chartConnected: chart?.isConnected,
        canvasesZeroed: canvases.every(({ width, height }) => width === 0 && height === 0),
      };
      harness.cleanupApp(container);
      container.remove();
      return { ...outcome, contentAfterClose: outcome.contentAfterClose === null };
    });

    expect(result.chartFound).toBe(true);
    expect(result.closeFound).toBe(true);
    expect(result.contentAfterClose).toBe(true);
    expect(result.chartConnected).toBe(false);
    expect(result.canvasesZeroed).toBe(true);
  });

  test("should tolerate root cleanup racing a Dialog portal close", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const container = harness.mount(() => harness.components.ChartDialog());
      await harness.flushPaint();

      const close = document.querySelector<HTMLButtonElement>('[data-testid="close-chart-dialog"]');
      const canvases = [
        ...document.querySelectorAll<HTMLCanvasElement>('[data-slot^="plot-canvas-"]'),
      ];

      const closeFound = close != null;
      close!.click();
      let cleanupThrew = false;
      try {
        harness.cleanupApp(container);
      } catch {
        cleanupThrew = true;
      }
      container.remove();
      await harness.flushPaint();

      return {
        closeFound,
        cleanupThrew,
        contentAfterClose: document.querySelector('[data-slot="dialog-content"]') === null,
        canvasesZeroed: canvases.every(({ width, height }) => width === 0 && height === 0),
      };
    });

    expect(result.closeFound).toBe(true);
    expect(result.cleanupThrew).toBe(false);
    expect(result.contentAfterClose).toBe(true);
    expect(result.canvasesZeroed).toBe(true);
  });
});
