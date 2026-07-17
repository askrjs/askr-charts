import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import { renderToStringSync } from "@askrjs/askr/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { constant, createPlot, type PlotApi } from "../src";

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

function Example({ apiRef }: { apiRef?: (api: PlotApi<Row> | null) => void } = {}) {
  return (
    <Plot.Root
      data={rows}
      rowKey="id"
      label="Requests"
      title="Request volume"
      description="Daily request totals"
      apiRef={apiRef}
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
    expect(html).toContain('data-slot="plot-canvas-base"');
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
    for (const frame of firstDocument.querySelectorAll<HTMLElement>('[data-slot="plot-frame"]')) {
      const describedIds = frame.getAttribute("aria-describedby")?.split(" ") ?? [];
      expect(describedIds.some((id) => id.endsWith("-tooltip"))).toBe(true);
      expect(describedIds.every((id) => firstDocument.getElementById(id) !== null)).toBe(true);
    }
  });

  it("should materialize canvases and expose an api given a mounted root", () => {
    let api!: PlotApi<Row>;
    createIsland({
      root: container,
      component: () => <Example apiRef={(value) => value && (api = value)} />,
    });

    expect(container.querySelectorAll("canvas")).toHaveLength(2);
    expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Requests");
    const frame = container.querySelector<HTMLElement>('[data-slot="plot-frame"]');
    const tooltip = container.querySelector<HTMLElement>('[data-slot="plot-tooltip"]');
    expect(tooltip?.id).toMatch(/^plot-requests-\d+-tooltip$/);
    expect(tooltip?.getAttribute("aria-live")).toBe("polite");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("true");
    expect(frame?.getAttribute("aria-describedby")?.split(" ")).toContain(tooltip?.id);
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

  it("should clear the api ref and canvas buffers given deterministic root cleanup", () => {
    const values: Array<PlotApi<Row> | null> = [];
    createIsland({
      root: container,
      component: () => <Example apiRef={(api) => values.push(api)} />,
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
  });
});

async function flushUpdates(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
