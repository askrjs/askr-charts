import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import { state } from "@askrjs/askr";
import { renderToStringSync } from "@askrjs/askr/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { constant, createPlot, type PlotApi, type RootProps } from "../src";

interface Row {
  id: string;
  label: string;
  value: number;
  series: string;
}

const Plot = createPlot<Row>();
const DuplicatePlot = createPlot<Row>();
const rows: readonly Row[] = [
  { id: "a", label: "Mon", value: 4, series: "api" },
  { id: "b", label: "Tue", value: 7, series: "worker" },
];

function Example({ onApiChange }: { onApiChange?: (api: PlotApi<Row> | null) => void } = {}) {
  return (
    <Plot.Root
      data={rows}
      rowKey="id"
      label="Requests"
      title="Request volume"
      description="Daily request totals"
      onApiChange={onApiChange}
    >
      <Plot.Line x="label" y="value" stroke={constant("#2563eb")} />
      <Plot.Point x="label" y="value" fill="series" />
      <Plot.Legend interactive />
      <Plot.Zoom axes="x" />
      <Plot.Brush axis="x" modifier="shift" />
    </Plot.Root>
  );
}

function DuplicateLabels() {
  return (
    <div>
      <Plot.Root data={rows} rowKey="id" label="Requests" title="Request volume">
        <Plot.Point x="label" y="value" fill="series" />
      </Plot.Root>
      <DuplicatePlot.Root data={rows} rowKey="id" label="Requests" title="Request volume">
        <DuplicatePlot.Point x="label" y="value" fill="series" />
      </DuplicatePlot.Root>
    </div>
  );
}

function PositionedLegends() {
  return (
    <Plot.Root data={rows} rowKey="id" label="Positioned legends">
      <Plot.Point x="label" y="value" fill="series" />
      <Plot.Legend label="Top" position="top" />
      <Plot.Legend label="Left" position="left" />
      <Plot.Legend label="Right" position="right" />
      <Plot.Legend label="Bottom" position="bottom" />
    </Plot.Root>
  );
}

describe("plot root", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    if (container.isConnected) {
      try {
        cleanupApp(container);
      } catch {
        // A test may clean the root explicitly to assert ref cleanup.
      }
      container.remove();
    }
    vi.restoreAllMocks();
  });

  it("should reserve semantic plot content without graphical SVG given server rendering", () => {
    const html = renderToStringSync(Example);

    expect(html).toContain('data-slot="plot-frame"');
    expect(html).toContain('data-slot="plot-canvas-chrome"');
    expect(html).toContain('data-slot="plot-canvas-marks"');
    expect(html).toContain("Request volume");
    expect(html).toContain("Requests contains 2 visible data points");
    expect(html).toContain("Use the arrow keys to inspect marks");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain('data-slot="plot-data-table"');
  });

  it("should generate unique repeatable semantic ids given same-label plots on the server", () => {
    const first = renderToStringSync(DuplicateLabels);
    const second = renderToStringSync(DuplicateLabels);
    const firstDocument = new DOMParser().parseFromString(first, "text/html");
    const secondDocument = new DOMParser().parseFromString(second, "text/html");
    const firstIds = [...firstDocument.querySelectorAll<HTMLElement>("[id]")].map(({ id }) => id);
    const secondIds = [...secondDocument.querySelectorAll<HTMLElement>("[id]")].map(({ id }) => id);

    expect(firstIds).toEqual(secondIds);
    expect(new Set(firstIds).size).toBe(firstIds.length);
    expect(firstIds.filter((id) => id.endsWith("-tooltip"))).toHaveLength(2);
    for (const graphic of firstDocument.querySelectorAll<HTMLElement>(
      '[data-slot="plot-graphic"]',
    )) {
      const describedIds = graphic.getAttribute("aria-describedby")?.split(" ") ?? [];
      expect(describedIds.some((id) => id.endsWith("-tooltip"))).toBe(true);
      expect(describedIds.every((id) => firstDocument.getElementById(id) !== null)).toBe(true);
    }
  });

  it("should materialize canvases and expose an api given a mounted root", () => {
    let api!: PlotApi<Row>;
    createIsland({
      root: container,
      component: () => <Example onApiChange={(value) => value && (api = value)} />,
    });

    expect(container.querySelectorAll("canvas")).toHaveLength(3);
    expect(container.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("Requests");
    const frame = container.querySelector<HTMLElement>('[data-slot="plot-frame"]');
    const graphic = container.querySelector<HTMLElement>('[data-slot="plot-graphic"]');
    const tooltip = container.querySelector<HTMLElement>('[data-slot="plot-tooltip"]');
    expect(tooltip?.id).toMatch(/^plot-requests-\d+-tooltip$/);
    expect(tooltip?.getAttribute("aria-live")).toBe("polite");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("true");
    expect(graphic?.getAttribute("aria-describedby")?.split(" ")).toContain(tooltip?.id);
    expect(graphic?.contains(tooltip ?? null)).toBe(false);
    expect(frame?.contains(tooltip ?? null)).toBe(true);
    expect(api).toBeDefined();
    expect(api.rows).toEqual(rows);
    expect(api.exportSvg()).toContain('data-mark="line"');
    expect(api.exportData({ format: "json" })).toContain('"id": "a"');
  });

  it("should place legend regions around the frame given explicit positions", () => {
    createIsland({ root: container, component: PositionedLegends });
    const body = container.querySelector<HTMLElement>('[data-slot="plot-body"]');
    const order = [...(body?.children ?? [])].map(
      (element) =>
        element.getAttribute("data-plot-legend-position") ?? element.getAttribute("data-slot"),
    );

    expect(order).toEqual(["top", "left", "plot-frame", "right", "bottom"]);
    expect(
      [...container.querySelectorAll('[data-slot="plot-legends"]')].map((element) =>
        element.getAttribute("data-plot-legend-position"),
      ),
    ).toEqual(["top", "left", "right", "bottom"]);
  });

  it("should create the full transformed table only after view data is activated", async () => {
    createIsland({ root: container, component: () => <Example /> });
    expect(container.querySelector('[data-slot="plot-data-table"]')).toBeNull();

    const button = container.querySelector<HTMLButtonElement>('[data-slot="plot-data-toggle"]');
    button?.click();
    await flushUpdates();

    const table = container.querySelector('[data-slot="plot-data-table"]');
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain("Mon");
    expect(table?.textContent).toContain("7");
  });

  it("should clear the api callback and canvas buffers given deterministic root cleanup", () => {
    const values: Array<PlotApi<Row> | null> = [];
    createIsland({
      root: container,
      component: () => <Example onApiChange={(api) => values.push(api)} />,
    });
    expect(values[values.length - 1]).not.toBeNull();

    cleanupApp(container);

    expect(values[values.length - 1]).toBeNull();
    expect(
      [...container.querySelectorAll("canvas")].every(
        (canvas) => canvas.width === 0 && canvas.height === 0,
      ),
    ).toBe(true);
  });

  it("should expose bounded meter values given explicit meter semantics", () => {
    const MeterPlot = createPlot<Row>();
    createIsland({
      root: container,
      component: () => (
        <MeterPlot.Root
          data={rows.slice(0, 1)}
          rowKey="id"
          label="SLO progress"
          meter={{ role: "meter", min: 0, max: 10, value: 4, valueText: "40%" }}
        >
          <MeterPlot.Bar x="label" y="value" min={0} max={10} />
        </MeterPlot.Root>
      ),
    });

    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute("aria-valuemin")).toBe("0");
    expect(meter?.getAttribute("aria-valuemax")).toBe("10");
    expect(meter?.getAttribute("aria-valuenow")).toBe("4");
    expect(meter?.getAttribute("aria-valuetext")).toBe("40%");
    expect(meter?.querySelector('[data-slot="plot-tooltip"]')).toBeNull();
  });

  it("should preserve cleanup given an api callback failure when unmounting", () => {
    createIsland({
      root: container,
      component: () => (
        <Example
          onApiChange={(api) => {
            if (api === null) throw new Error("callback cleanup failed");
          }}
        />
      ),
    });
    const canvases = [...container.querySelectorAll("canvas")];

    expect(() => cleanupApp(container)).not.toThrow();
    expect(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });

  it("should settle an inline api callback given reactive api storage when rerendering", async () => {
    const notifications: Array<PlotApi<Row> | null> = [];
    let renders = 0;
    function ReactiveApiOwner() {
      renders += 1;
      const api = state<PlotApi<Row> | null>(null);
      void api();
      return (
        <Example
          onApiChange={(next) => {
            notifications.push(next);
            api.set(next);
          }}
        />
      );
    }

    createIsland({ root: container, component: ReactiveApiOwner });
    await flushUpdates();

    expect(renders).toBe(2);
    expect(notifications).toHaveLength(2);
    expect(notifications.every((api) => api !== null)).toBe(true);

    cleanupApp(container);
    expect(notifications.filter((api) => api === null)).toHaveLength(1);
  });

  it("should render the configured heading level given a titled plot", () => {
    const html = renderToStringSync(() => (
      <Plot.Root data={rows} rowKey="id" label="Requests" title="Request volume" headingLevel={4}>
        <Plot.Point x="label" y="value" />
      </Plot.Root>
    ));

    expect(html).toContain('<h4 id="plot-requests-1-title"');
  });

  it("should preserve page touch scrolling given a shift-only brush", () => {
    const html = renderToStringSync(() => (
      <Plot.Root data={rows} rowKey="id" label="Requests">
        <Plot.Point x="label" y="value" />
        <Plot.Brush axis="x" modifier="shift" />
      </Plot.Root>
    ));

    expect(html).toContain('data-interactive="false"');
  });

  it("should omit keyboard inspection instructions given an empty non-focusable scene", () => {
    const html = renderToStringSync(() => (
      <Plot.Root data={[]} rowKey="id" label="Empty requests">
        <Plot.Point x="label" y="value" />
      </Plot.Root>
    ));

    expect(html).not.toContain("arrow keys to inspect marks");
    expect(html).toContain("View data control for a table");
    expect(html).not.toContain('tabindex="0"');
  });

  it("should reject invalid semantic root values given server rendering", () => {
    const render = (props: Partial<RootProps<Row>>) =>
      renderToStringSync(() => (
        <Plot.Root data={rows} rowKey="id" label="Requests" {...props}>
          <Plot.Point x="label" y="value" />
        </Plot.Root>
      ));

    expect(() => render({ label: " " })).toThrow("label must be a non-blank string");
    expect(() => render({ id: " " })).toThrow("id must be non-blank");
    expect(() => render({ id: "bad id" })).toThrow("id must be non-blank");
    expect(() => render({ id: 42 as unknown as string })).toThrow("id must be non-blank");
    expect(() => render({ headingLevel: 0 as 1 })).toThrow(
      "headingLevel must be an integer from 1 through 6",
    );
    expect(() => render({ headingLevel: 2.5 as 2 })).toThrow(
      "headingLevel must be an integer from 1 through 6",
    );
    expect(() => render({ width: Number.NaN })).toThrow("width must be a finite positive number");
    expect(() => render({ meter: { role: "meter", min: 10, max: 0, value: 4 } })).toThrow(
      "meter max must be greater than min",
    );
  });
});

async function flushUpdates(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
