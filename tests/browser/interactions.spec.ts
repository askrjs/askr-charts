import { expect, test } from "./fixtures";

test.describe("plot interactions and live rows", () => {
  test("should inspect filter activate zoom brush and resume given pointer and keyboard input", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      let api!: {
        exportSvg: (options?: { includeOverlays?: boolean }) => string;
      };
      const views: unknown[] = [];
      const selections: { keys: string[] }[] = [];
      const activated: string[] = [];
      const container = harness.mount(
        () =>
          harness.components.InteractivePlot({
            onApiChange: (value) => value && (api = value as never),
            onView: (view) => views.push(view),
            onSelection: (selection) => selections.push(selection as never),
            onActivate: (_row, key) => activated.push(key as string),
          }),
        { width: "640px" },
      );
      await harness.flushPaint();

      const graphic = harness.required<HTMLElement>(container, '[data-slot="plot-graphic"]');
      const overlay = harness.required<HTMLCanvasElement>(
        container,
        '[data-slot="plot-canvas-overlay"]',
      );
      const tooltip = harness.required<HTMLElement>(container, '[data-slot="plot-tooltip"]');
      const point = harness.firstPoint(api.exportSvg());
      harness.dispatchPointer(overlay, "pointermove", point.x, point.y, { pointerId: 1 });
      await harness.flushPaint();
      const hover = {
        hidden: tooltip.hidden,
        text: tooltip.textContent,
        open: tooltip.dataset.open,
        ariaHidden: tooltip.getAttribute("aria-hidden"),
        plainSvg: api.exportSvg(),
        overlaySvg: api.exportSvg({ includeOverlays: true }),
      };

      graphic.focus();
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const tooltipHiddenAfterArrow = tooltip.hidden;
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const activatedAfterEnter = activated.length;
      graphic.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", shiftKey: true, bubbles: true }),
      );
      const selectionKeysAfterSpace = selections[selections.length - 1]?.keys;

      const viewsBeforeKeyboard = views.length;
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
      const viewsAfterZoomKey = views.length;
      graphic.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }),
      );
      const viewsAfterPanKey = views.length;
      const viewsBeforeReset = views.length;
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      const viewsAfterReset = views.length;

      const legend = harness.legendButton(container, "api");
      legend.click();
      const legendPressed = legend.getAttribute("aria-pressed");

      overlay.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: overlay.getBoundingClientRect().left + point.x,
          clientY: overlay.getBoundingClientRect().top + point.y,
          deltaY: -120,
          bubbles: true,
          cancelable: true,
        }),
      );
      await harness.flushPaint();
      const viewsAfterWheel = views.length;
      const pausedStatus = container.querySelector('[data-slot="plot-live-status"]')?.textContent;

      harness.dispatchPointer(overlay, "pointerdown", 70, 40, {
        pointerId: 2,
        shiftKey: true,
        buttons: 1,
      });
      harness.dispatchPointer(
        overlay,
        "pointermove",
        overlay.clientWidth - 30,
        overlay.clientHeight - 30,
        { pointerId: 2, shiftKey: true, buttons: 1 },
      );
      harness.dispatchPointer(
        overlay,
        "pointerup",
        overlay.clientWidth - 30,
        overlay.clientHeight - 30,
        { pointerId: 2, shiftKey: true },
      );
      const selectionsAfterBrush = selections.length;
      const brushSelectionKeyCount = selections[selections.length - 1]?.keys.length;
      const brushSvg = api.exportSvg();
      overlay.dispatchEvent(
        new MouseEvent("click", {
          clientX: overlay.getBoundingClientRect().left + overlay.clientWidth - 30,
          clientY: overlay.getBoundingClientRect().top + overlay.clientHeight - 30,
          bubbles: true,
        }),
      );
      const activatedAfterBrushClick = activated.length;

      const viewsBeforePan = views.length;
      harness.dispatchPointer(overlay, "pointerdown", 160, 120, { pointerId: 3, buttons: 1 });
      harness.dispatchPointer(overlay, "pointermove", 190, 120, { pointerId: 3, buttons: 1 });
      harness.dispatchPointer(overlay, "pointerup", 190, 120, { pointerId: 3 });
      const viewsAfterPan = views.length;

      const viewsBeforeReleasePan = views.length;
      harness.dispatchPointer(overlay, "pointerdown", 190, 120, { pointerId: 6, buttons: 1 });
      harness.dispatchPointer(overlay, "pointerup", 220, 120, { pointerId: 6 });
      const viewsAfterReleasePan = views.length;

      const viewsBeforePinch = views.length;
      harness.dispatchPointer(overlay, "pointerdown", 180, 100, { pointerId: 4, buttons: 1 });
      harness.dispatchPointer(overlay, "pointerdown", 300, 100, { pointerId: 5, buttons: 1 });
      harness.dispatchPointer(overlay, "pointermove", 330, 100, { pointerId: 5, buttons: 1 });
      harness.dispatchPointer(overlay, "pointerup", 330, 100, { pointerId: 5 });
      harness.dispatchPointer(overlay, "pointerup", 180, 100, { pointerId: 4 });
      const viewsAfterPinch = views.length;

      const resume = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === "Resume live",
      );
      resume?.click();
      await harness.flushPaint();
      const resumedStatus = container.querySelector('[data-slot="plot-live-status"]')?.textContent;

      const dataToggle = harness.required<HTMLButtonElement>(
        container,
        '[data-slot="plot-data-toggle"]',
      );
      dataToggle.click();
      await harness.flushPaint();
      const dataRowCount = container.querySelectorAll(
        '[data-slot="plot-data-table"] tbody tr',
      ).length;

      harness.cleanupApp(container);
      container.remove();
      return {
        hover,
        tooltipHiddenAfterArrow,
        activatedAfterEnter,
        selectionKeysAfterSpace,
        viewsBeforeKeyboard,
        viewsAfterZoomKey,
        viewsAfterPanKey,
        viewsBeforeReset,
        viewsAfterReset,
        legendPressed,
        viewsAfterWheel,
        pausedStatus,
        selectionsAfterBrush,
        brushSelectionKeyCount,
        brushSvg,
        activatedAfterBrushClick,
        viewsBeforePan,
        viewsAfterPan,
        viewsBeforeReleasePan,
        viewsAfterReleasePan,
        viewsBeforePinch,
        viewsAfterPinch,
        resumedStatus,
        dataRowCount,
      };
    });

    expect(result.hover.hidden).toBe(false);
    expect(result.hover.text).toContain("y: 4");
    expect(result.hover.open).toBe("true");
    expect(result.hover.ariaHidden).toBe("false");
    expect(result.hover.plainSvg).not.toContain("data-plot-overlays");
    expect(result.hover.overlaySvg).toContain('data-plot-overlays="true"');

    expect(result.tooltipHiddenAfterArrow).toBe(false);
    expect(result.activatedAfterEnter).toBe(1);
    expect(result.selectionKeysAfterSpace).toContain("a");

    expect(result.viewsAfterZoomKey).toBe(result.viewsBeforeKeyboard + 1);
    expect(result.viewsAfterPanKey).toBe(result.viewsBeforeKeyboard + 2);
    expect(result.viewsAfterReset).toBe(result.viewsBeforeReset + 1);

    expect(result.legendPressed).toBe("false");

    expect(result.viewsAfterWheel).toBeGreaterThan(0);
    expect(result.pausedStatus).toContain("paused");

    expect(result.selectionsAfterBrush).toBeGreaterThan(0);
    expect(result.brushSelectionKeyCount).toBeGreaterThan(0);
    expect(result.brushSvg).toContain('data-selected="true"');
    expect(result.activatedAfterBrushClick).toBe(1);

    expect(result.viewsAfterPan).toBeGreaterThan(result.viewsBeforePan);
    expect(result.viewsAfterReleasePan).toBeGreaterThan(result.viewsBeforeReleasePan);
    expect(result.viewsAfterPinch).toBeGreaterThan(result.viewsBeforePinch);

    expect(result.resumedStatus).toContain("Following");
    expect(result.dataRowCount).toBe(4);
  });

  test("should select before activation and expose the immutable target given pointer and keyboard gestures", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      const events: string[] = [];
      const targets: Record<string, unknown>[] = [];
      const makeProps = (
        onApiChange?: (api: unknown) => void,
      ): Parameters<typeof harness.components.InteractivePlot>[0] => ({
        select: "toggle",
        onApiChange: onApiChange as never,
        onSelection: (selection) =>
          events.push(`selection:${(selection as { keys: string[] }).keys.join(",")}`),
        onActivate: (_row, key, target) => {
          events.push(`activate:${key as string}`);
          targets.push(target as never);
        },
      });

      let container = harness.mount(() => harness.components.InteractivePlot(makeProps()), {
        width: "640px",
      });
      await harness.flushPaint();
      let api!: { exportSvg: () => string };
      harness.cleanupApp(container);
      container.remove();
      container = harness.mount(
        () =>
          harness.components.InteractivePlot(makeProps((value) => value && (api = value as never))),
        { width: "640px" },
      );
      await harness.flushPaint();

      const point = harness.firstPoint(api.exportSvg());
      const overlay = harness.required<HTMLCanvasElement>(
        container,
        '[data-slot="plot-canvas-overlay"]',
      );
      overlay.dispatchEvent(
        new MouseEvent("click", {
          clientX: overlay.getBoundingClientRect().left + point.x,
          clientY: overlay.getBoundingClientRect().top + point.y,
          bubbles: true,
        }),
      );

      const afterPointer = events.slice(-2);
      const firstTarget = {
        key: targets[0]?.key,
        sourceKeys: targets[0]?.sourceKeys,
        origin: targets[0]?.origin,
      };
      const firstTargetFrozen = Object.isFrozen(targets[0]);

      const graphic = harness.required<HTMLElement>(container, '[data-slot="plot-graphic"]');
      graphic.focus();
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const afterKeyboard = events.slice(-2);
      const secondTargetOrigin = targets[1]?.origin;

      graphic.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const afterEscape = events[events.length - 1];

      harness.cleanupApp(container);
      container.remove();
      return {
        afterPointer,
        firstTarget,
        firstTargetFrozen,
        afterKeyboard,
        secondTargetOrigin,
        afterEscape,
      };
    });

    expect(result.afterPointer).toEqual(["selection:a", "activate:a"]);
    expect(result.firstTarget).toMatchObject({ key: "a", sourceKeys: ["a"], origin: "pointer" });
    expect(result.firstTargetFrozen).toBe(true);
    expect(result.afterKeyboard).toEqual(["selection:", "activate:a"]);
    expect(result.secondTargetOrigin).toBe("keyboard");
    expect(result.afterEscape).toBe("selection:");
  });

  test("should retain stable keys and repaint given an appended live batch", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      let api!: {
        rows: readonly unknown[];
        exportSvg: () => string;
        exportData: (options: { format: "json" }) => string;
      };
      let append!: () => void;
      const container = harness.mount(
        () =>
          harness.components.LiveApp({
            onAppend: (value) => (append = value),
            onApiChange: (value) => (api = value as never),
          }),
        { width: "640px" },
      );
      await harness.flushPaint();
      const initialRowCount = api.rows.length;

      append();
      await harness.flushPaint();

      const outcome = {
        initialRowCount,
        appendedRowCount: api.rows.length,
        exportedJson: api.exportData({ format: "json" }),
        exportedSvg: api.exportSvg(),
      };
      harness.cleanupApp(container);
      container.remove();
      return outcome;
    });

    expect(result.initialRowCount).toBe(4);
    expect(result.appendedRowCount).toBe(5);
    expect(result.exportedJson).toContain('"id": "e"');
    expect(result.exportedSvg).toContain("14");
  });

  test("should freeze the inspected window and resume the latest rows given live updates while paused", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = window.charts;
      let api!: {
        exportData: (options: { rows?: "source"; view?: "full"; format: "json" }) => string;
        resumeLive: () => void;
      };
      let append!: () => void;
      const container = harness.mount(
        () =>
          harness.components.FollowApp({
            onAppend: (value) => (append = value),
            onApiChange: (value) => (api = value as never),
          }),
        { width: "640px" },
      );
      await harness.flushPaint();
      const overlay = harness.required<HTMLCanvasElement>(
        container,
        '[data-slot="plot-canvas-overlay"]',
      );
      overlay.dispatchEvent(
        new WheelEvent("wheel", {
          clientX: overlay.getBoundingClientRect().left + 200,
          clientY: overlay.getBoundingClientRect().top + 100,
          deltaY: -120,
          bubbles: true,
          cancelable: true,
        }),
      );
      append();
      await harness.flushPaint();

      const paused = JSON.parse(api.exportData({ rows: "source", format: "json" })) as {
        id: string;
      }[];
      const full = JSON.parse(api.exportData({ view: "full", rows: "source", format: "json" })) as {
        id: string;
      }[];

      api.resumeLive();
      await harness.flushPaint();
      const resumed = JSON.parse(api.exportData({ rows: "source", format: "json" })) as {
        id: string;
      }[];

      harness.cleanupApp(container);
      container.remove();
      return {
        paused: paused.map(({ id }) => id),
        full: full.map(({ id }) => id),
        resumed: resumed.map(({ id }) => id),
      };
    });

    expect(result.paused).toEqual(["c", "d"]);
    expect(result.full).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.resumed).toEqual(["d", "e"]);
  });
});
