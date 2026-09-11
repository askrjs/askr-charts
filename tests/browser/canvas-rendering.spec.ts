import { expect, test } from "./fixtures";

test.describe("canvas rendering and export", () => {
  test("should scale the backing canvas and repaint given dpr resize and theme changes", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const container = harness.mount(() => harness.components.CartesianExample(), {
        width: "640px",
      });
      await harness.flushPaint();
      const frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
      const canvas = harness.required<HTMLCanvasElement>(
        container,
        '[data-slot="plot-canvas-chrome"]',
      );

      const initial = {
        width: canvas.width,
        expectedWidth: Math.round(frame.clientWidth * devicePixelRatio),
        height: canvas.height,
        expectedHeight: Math.round(frame.clientHeight * devicePixelRatio),
      };
      const before = canvas.getContext("2d")?.getImageData(2, 2, 1, 1).data;
      const beforeAlpha = before?.[3];

      container.style.width = "420px";
      await harness.flushPaint();
      const resized = {
        width: canvas.width,
        expectedWidth: Math.round(frame.clientWidth * devicePixelRatio),
      };

      container.style.setProperty("--ak-chart-surface", "rgb(1 2 3)");
      await harness.flushPaint();
      const after = canvas.getContext("2d")?.getImageData(2, 2, 1, 1).data;
      const afterRgb = [...after!].slice(0, 3);

      harness.cleanupApp(container);
      container.remove();
      return { initial, beforeAlpha, resized, afterRgb };
    });

    expect(result.initial.width).toBe(result.initial.expectedWidth);
    expect(result.initial.height).toBe(result.initial.expectedHeight);
    expect(result.beforeAlpha).toBe(255);
    expect(result.resized.width).toBe(result.resized.expectedWidth);
    expect(result.afterRgb).toEqual([1, 2, 3]);
  });

  test("should resize the scene given a custom structural height token when no height prop is set", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const container = document.createElement("div");
      container.style.setProperty("--ak-chart-height", "196px");
      document.body.append(container);
      harness.createIsland({
        root: container,
        component: () => harness.components.CartesianExample({ tokenHeight: true }),
      });
      await harness.flushPaint();

      const frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
      const canvas = harness.required<HTMLCanvasElement>(
        container,
        '[data-slot="plot-canvas-chrome"]',
      );
      const initial = {
        frameHeight: frame.clientHeight,
        canvasHeight: canvas.height,
        expectedCanvasHeight: Math.round(196 * devicePixelRatio),
      };

      container.style.setProperty("--ak-chart-height", "240px");
      await harness.flushPaint();
      const updated = {
        frameHeight: frame.clientHeight,
        canvasHeight: canvas.height,
        expectedCanvasHeight: Math.round(240 * devicePixelRatio),
      };

      harness.cleanupApp(container);
      container.remove();
      return { initial, updated };
    });

    expect(result.initial.frameHeight).toBe(196);
    expect(result.initial.canvasHeight).toBe(result.initial.expectedCanvasHeight);
    expect(result.updated.frameHeight).toBe(240);
    expect(result.updated.canvasHeight).toBe(result.updated.expectedCanvasHeight);
  });

  test("should export scene-parity svg and png given a mounted plot", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      let api: import("../../src").PlotApi<never> | null = null;
      const container = harness.mount(
        () =>
          harness.components.CartesianExample({
            onApiChange: (value) => (api = value as never),
          }),
        { width: "640px" },
      );
      await harness.flushPaint();

      const plotApi = api as unknown as {
        exportSvg: () => string;
        exportPng: (options: { pixelRatio: number }) => Promise<Blob>;
      };
      const svg = plotApi.exportSvg();
      const png = await plotApi.exportPng({ pixelRatio: 2 });
      const bitmap = await createImageBitmap(png);
      const frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
      const bitmapSize = {
        width: bitmap.width,
        height: bitmap.height,
        expectedWidth: frame.clientWidth * 2,
        expectedHeight: frame.clientHeight * 2,
      };
      bitmap.close();

      harness.cleanupApp(container);
      container.remove();
      return { svg, pngType: png.type, bitmapSize };
    });

    expect(result.svg).toContain('data-mark="bar"');
    expect(result.svg).toContain('data-mark="area"');
    expect(result.svg).toContain('data-mark="line"');
    expect(result.svg).toContain('data-mark="point"');
    expect(result.svg).toContain('data-mark="rule"');
    expect(result.svg).toContain('data-mark="text"');
    expect(result.svg).not.toContain("plot-tooltip");

    expect(result.pngType).toBe("image/png");
    expect(result.bitmapSize.width).toBe(result.bitmapSize.expectedWidth);
    expect(result.bitmapSize.height).toBe(result.bitmapSize.expectedHeight);
  });

  test("should isolate concurrent resize and export work across independent chart instances", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const first = document.createElement("div");
      const second = document.createElement("div");
      first.style.width = "280px";
      second.style.width = "520px";
      document.body.append(first, second);
      interface ExportApi {
        exportSvg: () => string;
        exportPng: (options: { pixelRatio: number }) => Promise<Blob>;
      }
      let firstApi!: ExportApi;
      let secondApi!: ExportApi;

      try {
        harness.createIsland({
          root: first,
          component: () =>
            harness.components.CartesianExample({
              label: "First isolated plot",
              onApiChange: (api) => (firstApi = api as never),
            }),
        });
        harness.createIsland({
          root: second,
          component: () =>
            harness.components.CartesianExample({
              label: "Second isolated plot",
              onApiChange: (api) => (secondApi = api as never),
            }),
        });
        await harness.flushPaint();

        const firstFrame = harness.required<HTMLElement>(first, '[data-slot="plot-frame"]');
        const secondFrame = harness.required<HTMLElement>(second, '[data-slot="plot-frame"]');
        const firstWidth = firstFrame.clientWidth;
        const secondWidth = secondFrame.clientWidth;
        first.style.width = "360px";
        const [firstPng, secondPng, firstSvg, secondSvg] = await Promise.all([
          firstApi.exportPng({ pixelRatio: 1 }),
          secondApi.exportPng({ pixelRatio: 2 }),
          Promise.resolve(firstApi.exportSvg()),
          Promise.resolve(secondApi.exportSvg()),
        ]);
        await harness.flushPaint();

        const firstBitmap = await createImageBitmap(firstPng);
        const secondBitmap = await createImageBitmap(secondPng);
        const outcome = {
          firstFrameWidth: firstFrame.clientWidth,
          secondFrameWidth: secondFrame.clientWidth,
          expectedSecondFrameWidth: secondWidth,
          firstBitmapWidth: firstBitmap.width,
          expectedFirstBitmapWidth: firstWidth,
          secondBitmapWidth: secondBitmap.width,
          expectedSecondBitmapWidth: secondFrame.clientWidth * 2,
          firstSvg,
          secondSvg,
        };
        firstBitmap.close();
        secondBitmap.close();
        return outcome;
      } finally {
        harness.cleanupApp(first);
        harness.cleanupApp(second);
        first.remove();
        second.remove();
      }
    });

    expect(result.firstFrameWidth).toBe(360);
    expect(result.secondFrameWidth).toBe(result.expectedSecondFrameWidth);
    expect(result.firstBitmapWidth).toBe(result.expectedFirstBitmapWidth);
    expect(result.secondBitmapWidth).toBe(result.expectedSecondBitmapWidth);
    expect(result.firstSvg).toContain("<title>First isolated plot");
    expect(result.firstSvg).not.toContain("Second isolated plot");
    expect(result.secondSvg).toContain("<title>Second isolated plot");
    expect(result.secondSvg).not.toContain("First isolated plot");
  });

  test("should paint every mark family and mixed reference given the full theme and width matrix", async ({
    page,
  }) => {
    const expectedMarks: ReadonlyArray<readonly [string, number]> = [
      ["Operations trend", 6],
      ["Latency distribution and P95 trend", 6],
      ["Subsystem share", 3],
      ["Traffic heatmap", 4],
      ["Request flame graph", 3],
      ["SLO gauge", 1],
    ];
    const expectedLegendPositions: ReadonlyArray<readonly [string, string]> = [
      ["Operations trend", "bottom"],
      ["Latency distribution and P95 trend", "top"],
      ["Subsystem share", "right"],
      ["Traffic heatmap", "left"],
    ];

    const initial = await page.evaluate(
      async (legendLabels: readonly string[]) => {
        const harness = window.charts;
        const container = harness.mount(() => harness.components.VisualMatrix(), {
          width: "640px",
        });
        await harness.flushPaint();
        // Retained for the viewport sweep, which has to interleave Playwright
        // viewport changes with in-page measurement.
        (window as unknown as { matrixContainer: HTMLElement }).matrixContainer = container;

        const canvasCount = container.querySelectorAll('[data-slot="plot-canvas-marks"]').length;
        const frames = [...container.querySelectorAll<HTMLElement>('[data-slot="plot-frame"]')];
        const frameHeights = frames.map((frame) =>
          Math.round(frame.getBoundingClientRect().height),
        );
        const perFrame = frames.map((frame) => {
          const label =
            harness
              .required<HTMLElement>(frame, '[data-slot="plot-graphic"]')
              .getAttribute("aria-label") ?? "";
          const canvas = harness.required<HTMLCanvasElement>(
            frame,
            '[data-slot="plot-canvas-marks"]',
          );
          return {
            label,
            markCount: Number(frame.dataset.markCount),
            paintedPixels: harness.countPaintedPixels(canvas),
          };
        });
        const legendPositions = legendLabels.map((label) => {
          const frame = frames.find(
            (candidate) =>
              candidate.querySelector('[data-slot="plot-graphic"]')?.getAttribute("aria-label") ===
              label,
          );
          const region = frame
            ?.closest('[data-slot="plot-root"]')
            ?.querySelector('[data-slot="plot-legends"]');
          return region?.getAttribute("data-plot-legend-position") ?? null;
        });

        return { canvasCount, frameHeights, perFrame, legendPositions };
      },
      expectedLegendPositions.map(([label]) => label),
    );

    expect(initial.canvasCount).toBe(6);
    expect(initial.frameHeights).toEqual([320, 320, 240, 220, 220, 180]);
    const expected = new Map(expectedMarks);
    for (const frame of initial.perFrame) {
      const marks = expected.get(frame.label);
      expect(marks, `missing mark expectation for ${frame.label}`).toBeDefined();
      expect(frame.markCount, `${frame.label} scene mark count`).toBeGreaterThanOrEqual(marks!);
      expect(frame.paintedPixels, `${frame.label} painted pixels`).toBeGreaterThan(50);
    }
    for (const [index, [label, position]] of expectedLegendPositions.entries()) {
      expect(initial.legendPositions[index], `${label} legend position`).toBe(position);
    }

    for (const theme of ["light", "dark"] as const) {
      for (const viewport of ["desktop", "narrow"] as const) {
        await page.setViewportSize({ width: viewport === "desktop" ? 800 : 440, height: 700 });
        const sweep = await page.evaluate(
          async ({ theme, viewport }) => {
            const harness = window.charts;
            const container = (window as unknown as { matrixContainer: HTMLElement })
              .matrixContainer;
            const matrix = harness.required<HTMLElement>(
              container,
              '[data-testid="visual-matrix"]',
            );
            matrix.setAttribute("data-theme", theme);
            matrix.style.width = viewport === "desktop" ? "720px" : "360px";
            await harness.flushPaint();

            return [...container.querySelectorAll<HTMLElement>('[data-slot="plot-frame"]')].map(
              (frame) => {
                const label =
                  harness
                    .required<HTMLElement>(frame, '[data-slot="plot-graphic"]')
                    .getAttribute("aria-label") ?? "";
                const root = frame.closest<HTMLElement>('[data-slot="plot-root"]');
                const canvas = harness.required<HTMLCanvasElement>(
                  frame,
                  '[data-slot="plot-canvas-marks"]',
                );
                return {
                  label,
                  hasRoot: root !== null,
                  paintedPixels: harness.countPaintedPixels(canvas),
                };
              },
            );
          },
          { theme, viewport },
        );

        for (const frame of sweep) {
          expect(frame.hasRoot, `missing ${theme} ${viewport} root for ${frame.label}`).toBe(true);
          expect(
            frame.paintedPixels,
            `${frame.label} ${theme} ${viewport} painted pixels`,
          ).toBeGreaterThan(100);
        }
      }
    }

    await page.evaluate(() => {
      const harness = window.charts;
      const container = (window as unknown as { matrixContainer: HTMLElement }).matrixContainer;
      harness.cleanupApp(container);
      container.remove();
    });
  });
});
