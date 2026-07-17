import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import { state } from "@askrjs/askr";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { afterEach, describe, expect, it } from "vite-plus/test";
import "../../src/styles.css";
import {
  appendPlotRows,
  createPlot,
  type PlotApi,
  type PlotKey,
  type PlotSelection,
  type PlotView,
} from "../../src";

interface Row {
  id: string;
  time: number;
  value: number;
  service: string;
}

const Plot = createPlot<Row>();
const initialRows: readonly Row[] = [
  { id: "a", time: 0, value: 4, service: "api" },
  { id: "b", time: 1, value: 8, service: "worker" },
  { id: "c", time: 2, value: 6, service: "api" },
  { id: "d", time: 3, value: 11, service: "worker" },
];

describe("plot interactions and live rows", () => {
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (container) {
      cleanupApp(container);
      container.remove();
      container = undefined;
    }
  });

  it("should inspect filter activate zoom brush and resume given pointer and keyboard input", async () => {
    let api!: PlotApi<Row>;
    const views: PlotView[] = [];
    const selections: PlotSelection[] = [];
    const activated: PlotKey[] = [];
    container = mount(
      <InteractivePlot
        apiRef={(value) => value && (api = value)}
        onView={(view) => views.push(view)}
        onSelection={(selection) => selections.push(selection)}
        onActivate={(_row, key) => activated.push(key)}
      />,
    );
    await flushPaint();

    const frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    const overlay = required<HTMLCanvasElement>(container, '[data-slot="plot-canvas-overlay"]');
    const tooltip = required<HTMLElement>(container, '[data-slot="plot-tooltip"]');
    const point = firstPoint(api.exportSvg());
    dispatchPointer(overlay, "pointermove", point.x, point.y, { pointerId: 1 });
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toContain("y: 4");
    expect(tooltip.dataset.open).toBe("true");
    expect(tooltip.getAttribute("aria-hidden")).toBe("false");
    expect(api.exportSvg()).not.toContain("data-plot-overlays");
    expect(api.exportSvg({ includeOverlays: true })).toContain('data-plot-overlays="true"');

    frame.focus();
    frame.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(tooltip.hidden).toBe(false);
    frame.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(activated).toHaveLength(1);

    const legend = required<HTMLButtonElement>(container, '[data-plot-series="api"]');
    legend.click();
    expect(legend.getAttribute("aria-pressed")).toBe("false");

    overlay.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: overlay.getBoundingClientRect().left + point.x,
        clientY: overlay.getBoundingClientRect().top + point.y,
        deltaY: -120,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPaint();
    expect(views.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-slot="plot-live-status"]')?.textContent).toContain(
      "paused",
    );

    dispatchPointer(overlay, "pointerdown", 70, 40, {
      pointerId: 2,
      shiftKey: true,
      buttons: 1,
    });
    dispatchPointer(overlay, "pointermove", overlay.clientWidth - 30, overlay.clientHeight - 30, {
      pointerId: 2,
      shiftKey: true,
      buttons: 1,
    });
    dispatchPointer(overlay, "pointerup", overlay.clientWidth - 30, overlay.clientHeight - 30, {
      pointerId: 2,
      shiftKey: true,
    });
    expect(selections.length).toBeGreaterThan(0);
    expect(selections[selections.length - 1]?.keys.length).toBeGreaterThan(0);
    expect(api.exportSvg()).toContain('data-selected="true"');
    overlay.dispatchEvent(
      new MouseEvent("click", {
        clientX: overlay.getBoundingClientRect().left + overlay.clientWidth - 30,
        clientY: overlay.getBoundingClientRect().top + overlay.clientHeight - 30,
        bubbles: true,
      }),
    );
    expect(activated).toHaveLength(1);

    const viewsBeforePan = views.length;
    dispatchPointer(overlay, "pointerdown", 160, 120, { pointerId: 3, buttons: 1 });
    dispatchPointer(overlay, "pointermove", 190, 120, { pointerId: 3, buttons: 1 });
    dispatchPointer(overlay, "pointerup", 190, 120, { pointerId: 3 });
    expect(views.length).toBeGreaterThan(viewsBeforePan);

    const viewsBeforePinch = views.length;
    dispatchPointer(overlay, "pointerdown", 180, 100, { pointerId: 4, buttons: 1 });
    dispatchPointer(overlay, "pointerdown", 300, 100, { pointerId: 5, buttons: 1 });
    dispatchPointer(overlay, "pointermove", 330, 100, { pointerId: 5, buttons: 1 });
    dispatchPointer(overlay, "pointerup", 330, 100, { pointerId: 5 });
    dispatchPointer(overlay, "pointerup", 180, 100, { pointerId: 4 });
    expect(views.length).toBeGreaterThan(viewsBeforePinch);

    const resume = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Resume live",
    );
    resume?.click();
    await flushPaint();
    expect(container.querySelector('[data-slot="plot-live-status"]')?.textContent).toContain(
      "Following",
    );

    const dataToggle = required<HTMLButtonElement>(container, '[data-slot="plot-data-toggle"]');
    dataToggle.click();
    await flushPaint();
    expect(container.querySelectorAll('[data-slot="plot-data-table"] tbody tr').length).toBe(4);
  });

  it("should retain stable keys and repaint given an appended live batch", async () => {
    let api!: PlotApi<Row>;
    let append!: () => void;
    function LiveApp() {
      const rows = state<readonly Row[]>(initialRows);
      append = () =>
        rows.set((current) =>
          appendPlotRows(current, { id: "e", time: 4, value: 14, service: "api" }),
        );
      return <InteractivePlot data={rows} apiRef={(value) => value && (api = value)} />;
    }
    container = mount(<LiveApp />);
    await flushPaint();
    expect(api.rows).toHaveLength(4);

    append();
    await flushPaint();

    expect(api.rows).toHaveLength(5);
    expect(api.exportData({ format: "json" })).toContain('"id": "e"');
    expect(api.exportSvg()).toContain("14");
  });

  it("should freeze the inspected window and resume the latest rows given live updates while paused", async () => {
    let api!: PlotApi<Row>;
    let append!: () => void;
    function FollowApp() {
      const rows = state<readonly Row[]>(initialRows);
      append = () =>
        rows.set((current) =>
          appendPlotRows(current, { id: "e", time: 4, value: 14, service: "api" }),
        );
      return (
        <InteractivePlot
          data={rows}
          followLatest={{ rows: 2 }}
          apiRef={(value) => value && (api = value)}
        />
      );
    }
    container = mount(<FollowApp />);
    await flushPaint();
    const overlay = required<HTMLCanvasElement>(container, '[data-slot="plot-canvas-overlay"]');
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
    await flushPaint();

    const paused = JSON.parse(api.exportData({ rows: "source", format: "json" })) as Row[];
    expect(paused.map(({ id }) => id)).toEqual(["c", "d"]);
    const full = JSON.parse(
      api.exportData({ view: "full", rows: "source", format: "json" }),
    ) as Row[];
    expect(full.map(({ id }) => id)).toEqual(["a", "b", "c", "d", "e"]);

    api.resumeLive();
    await flushPaint();
    const resumed = JSON.parse(api.exportData({ rows: "source", format: "json" })) as Row[];
    expect(resumed.map(({ id }) => id)).toEqual(["d", "e"]);
  });
});

function InteractivePlot({
  data = initialRows,
  apiRef,
  onView,
  onSelection,
  onActivate,
  followLatest = { rows: 10 },
}: {
  data?: readonly Row[] | (() => readonly Row[]);
  apiRef?: (api: PlotApi<Row> | null) => void;
  onView?: (view: PlotView) => void;
  onSelection?: (selection: PlotSelection) => void;
  onActivate?: (row: Row, key: PlotKey) => void;
  followLatest?: { rows: number };
}) {
  return (
    <Plot.Root
      data={data}
      rowKey="id"
      label="Live requests"
      title="Live requests"
      height={280}
      followLatest={followLatest}
      apiRef={apiRef}
      onViewChange={onView}
      onSelectionChange={onSelection}
      onActivate={onActivate}
    >
      <Plot.Scale name="time-scale" channel="x" type="linear" />
      <Plot.Scale name="value-scale" channel="y" type="linear" />
      <Plot.Line
        x="time"
        y="value"
        xScale="time-scale"
        yScale="value-scale"
        stroke="service"
      />
      <Plot.Point
        x="time"
        y="value"
        xScale="time-scale"
        yScale="value-scale"
        fill="service"
      />
      <Plot.Legend interactive />
      <Plot.Tooltip />
      <Plot.Crosshair axes="xy" />
      <Plot.Zoom axes="xy" wheel pinch pan />
      <Plot.Brush axis="xy" modifier="shift" />
    </Plot.Root>
  );
}

function firstPoint(svg: string): { x: number; y: number } {
  const match = /<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/.exec(svg);
  if (!match) throw new Error("Expected an exported point circle.");
  return { x: Number(match[1]), y: Number(match[2]) };
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit,
): void {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent(type, {
      ...init,
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function mount(element: JSXElement): HTMLDivElement {
  const root = document.createElement("div");
  root.style.width = "640px";
  document.body.append(root);
  createIsland({ root, component: () => element });
  return root;
}

function required<ElementType extends Element>(root: ParentNode, selector: string): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

async function flushPaint(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
