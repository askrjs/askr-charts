import { expect, test } from "./fixtures";

test.describe("mounted canvas transitions", () => {
  test("should animate keyed updates and cancel deterministically given reduced motion and cleanup", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;

      // The old test used `vi.spyOn(window, "matchMedia")`; without vitest the
      // same override is installed and restored by hand.
      let reducedMotion = false;
      const nativeMatchMedia = window.matchMedia.bind(window);
      const motionMediaQuery = (query: string, reduced: () => boolean): MediaQueryList =>
        ({
          get matches() {
            return reduced();
          },
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent: () => true,
        }) as unknown as MediaQueryList;
      window.matchMedia = (query: string) =>
        query === "(prefers-reduced-motion: reduce)"
          ? motionMediaQuery(query, () => reducedMotion)
          : nativeMatchMedia(query);

      try {
        let liveRows!: {
          (): readonly { id: string; day: string; value: number; series: string }[];
          set: (
            rows: readonly { id: string; day: string; value: number; series: string }[],
          ) => void;
        };
        let plotApi!: {
          rows: readonly unknown[];
          exportSvg: (options?: { includeOverlays?: boolean }) => string;
          exportData: (options: { rows: "source"; scope: "selected"; format: "json" }) => string;
        };

        const container = document.createElement("div");
        container.style.setProperty("--ak-chart-transition-duration", "120ms");
        document.body.append(container);
        harness.createIsland({
          root: container,
          component: () =>
            harness.components.TransitionExample({
              onRows: (rows) => (liveRows = rows as never),
              onApiChange: (api) => (plotApi = api as never),
            }),
        });
        await harness.flushFrames();
        await harness.delay(140);

        let frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
        let canvas = harness.required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
        const settled = {
          animationMode: frame.dataset.animationMode,
          running: frame.hasAttribute("data-animation-running"),
        };
        harness.legendButton(container, "api").click();
        frame.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        const overlaySvgBeforeUpdate = plotApi.exportSvg({ includeOverlays: true });

        container.style.setProperty("--ak-chart-transition-duration", "500ms");
        liveRows.set([
          { id: "b", day: "Tue", value: 1, series: "worker" },
          { id: "a", day: "Mon", value: 8, series: "api" },
          { id: "c", day: "Wed", value: 5, series: "api" },
        ]);
        const liveRowCount = liveRows().length;
        await harness.flushFrames();
        const apiRowCount = plotApi.rows.length;

        frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
        canvas = harness.required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
        await harness.waitFor(() => frame.dataset.animationMode === "keyed");
        const animating = {
          animationMode: frame.dataset.animationMode,
          dataset: JSON.stringify({ ...frame.dataset }),
          running: frame.getAttribute("data-animation-running"),
          legendPressed: harness.legendButton(container, "api").getAttribute("aria-pressed"),
        };
        const selected = (
          JSON.parse(plotApi.exportData({ rows: "source", scope: "selected", format: "json" })) as {
            id: string;
          }[]
        ).map(({ id }) => id);
        const overlaySvgWhileAnimating = plotApi.exportSvg({ includeOverlays: true });

        // WebKit can deliver animation frames later than the nominal duration on
        // hosted runners. Wait for the observable completion state instead of
        // assuming one fixed wall-clock delay.
        await harness.waitFor(() => !frame.hasAttribute("data-animation-running"), 2_000);
        const completedRunning = frame.hasAttribute("data-animation-running");

        reducedMotion = true;
        liveRows.set([
          { id: "a", day: "Mon", value: 3, series: "api" },
          { id: "c", day: "Wed", value: 9, series: "api" },
        ]);
        await harness.flushFrames();
        frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
        canvas = harness.required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
        const reduced = {
          animationMode: frame.dataset.animationMode,
          running: frame.hasAttribute("data-animation-running"),
        };

        reducedMotion = false;
        liveRows.set([
          { id: "a", day: "Mon", value: 9, series: "api" },
          { id: "c", day: "Wed", value: 2, series: "worker" },
        ]);
        await harness.flushFrames();
        frame = harness.required<HTMLElement>(container, '[data-slot="plot-frame"]');
        canvas = harness.required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
        const restored = { running: frame.getAttribute("data-animation-running") };

        harness.cleanupApp(container);
        const torndown = {
          running: frame.hasAttribute("data-animation-running"),
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        };
        container.remove();

        return {
          settled,
          overlaySvgBeforeUpdate,
          liveRowCount,
          apiRowCount,
          animating,
          selected,
          overlaySvgWhileAnimating,
          completedRunning,
          reduced,
          restored,
          torndown,
        };
      } finally {
        window.matchMedia = nativeMatchMedia;
      }
    });

    expect(result.settled.animationMode).toBe("none");
    expect(result.settled.running).toBe(false);
    expect(result.overlaySvgBeforeUpdate).toMatch(/data-plot-overlays="true"[\s\S]*<circle/);

    expect(result.liveRowCount).toBe(3);
    expect(result.apiRowCount).toBe(3);

    expect(result.animating.animationMode, result.animating.dataset).toBe("keyed");
    expect(result.animating.running).toBe("true");
    expect(result.animating.legendPressed).toBe("false");
    expect(result.selected).toEqual(["a"]);
    expect(result.overlaySvgWhileAnimating).toMatch(/data-plot-overlays="true"[\s\S]*<circle/);
    expect(result.completedRunning).toBe(false);

    expect(result.reduced.animationMode).toBe("none");
    expect(result.reduced.running).toBe(false);

    expect(result.restored.running).toBe("true");

    expect(result.torndown.running).toBe(false);
    expect(result.torndown.canvasWidth).toBe(0);
    expect(result.torndown.canvasHeight).toBe(0);
  });
});
