import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vite-plus/test";
import "../../src/styles.css";
import {
  bin,
  constant,
  count,
  createPlot,
  movingAverage,
  partition,
  type PlotApi,
} from "../../src";

interface CartesianRow {
  id: string;
  day: string;
  value: number;
  low: number;
  series: string;
}

const Cartesian = createPlot<CartesianRow>();
const cartesianRows: readonly CartesianRow[] = [
  { id: "a", day: "Mon", value: 12, low: 4, series: "api" },
  { id: "b", day: "Tue", value: 20, low: 7, series: "worker" },
  { id: "c", day: "Wed", value: 15, low: 6, series: "api" },
  { id: "d", day: "Thu", value: 27, low: 9, series: "worker" },
];
const currentCartesianRows: readonly CartesianRow[] = [cartesianRows[3]!];

function CartesianExample({
  onApiChange,
  tokenHeight = false,
}: {
  onApiChange?: (api: PlotApi<CartesianRow> | null) => void;
  tokenHeight?: boolean;
}) {
  return (
    <Cartesian.Root
      data={cartesianRows}
      rowKey="id"
      label="Operations trend"
      title="Operations trend"
      width={640}
      height={tokenHeight ? undefined : 320}
      onApiChange={onApiChange}
    >
      <Cartesian.Grid axis="y" />
      <Cartesian.Area x="day" y="value" y2="low" fill={constant("#bfdbfe")} />
      <Cartesian.Bar x="day" y="low" fill="series" opacity={0.7} />
      <Cartesian.Line x="day" y="value" stroke={constant("#1d4ed8")} curve="monotone" />
      <Cartesian.Point x="day" y="value" fill="series" />
      <Cartesian.Rule y={constant(18)} stroke={constant("#dc2626")} dash={[4, 3]} />
      <Cartesian.Text
        data={currentCartesianRows}
        x={constant("Thu")}
        y="value"
        text={constant("current")}
        align="right"
        baseline="top"
      />
      <Cartesian.Legend />
    </Cartesian.Root>
  );
}

describe("canvas rendering and export", () => {
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (container) {
      cleanupApp(container);
      container.remove();
      container = undefined;
    }
  });

  it("should scale the backing canvas and repaint given dpr resize and theme changes", async () => {
    container = mount(<CartesianExample />);
    await flushPaint();
    const frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    const canvas = required<HTMLCanvasElement>(container, '[data-slot="plot-canvas-chrome"]');

    expect(canvas.width).toBe(Math.round(frame.clientWidth * devicePixelRatio));
    expect(canvas.height).toBe(Math.round(frame.clientHeight * devicePixelRatio));
    const before = canvas.getContext("2d")?.getImageData(2, 2, 1, 1).data;
    expect(before?.[3]).toBe(255);

    container.style.width = "420px";
    await flushPaint();
    expect(canvas.width).toBe(Math.round(frame.clientWidth * devicePixelRatio));

    container.style.setProperty("--ak-chart-surface", "rgb(1 2 3)");
    await flushPaint();
    const after = canvas.getContext("2d")?.getImageData(2, 2, 1, 1).data;
    expect([...after!].slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("should resize the scene given a custom structural height token when no height prop is set", async () => {
    container = document.createElement("div");
    container.style.setProperty("--ak-chart-height", "196px");
    document.body.append(container);
    createIsland({ root: container, component: () => <CartesianExample tokenHeight /> });
    await flushPaint();

    const frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    const canvas = required<HTMLCanvasElement>(container, '[data-slot="plot-canvas-chrome"]');
    expect(frame.clientHeight).toBe(196);
    expect(canvas.height).toBe(Math.round(196 * devicePixelRatio));

    container.style.setProperty("--ak-chart-height", "240px");
    await flushPaint();
    expect(frame.clientHeight).toBe(240);
    expect(canvas.height).toBe(Math.round(240 * devicePixelRatio));
  });

  it("should export scene-parity svg and png given a mounted plot", async () => {
    let api: PlotApi<CartesianRow> | null = null;
    container = mount(<CartesianExample onApiChange={(value) => (api = value)} />);
    await flushPaint();

    const svg = api!.exportSvg();
    expect(svg).toContain('data-mark="bar"');
    expect(svg).toContain('data-mark="area"');
    expect(svg).toContain('data-mark="line"');
    expect(svg).toContain('data-mark="point"');
    expect(svg).toContain('data-mark="rule"');
    expect(svg).toContain('data-mark="text"');
    expect(svg).not.toContain("plot-tooltip");

    const png = await api!.exportPng({ pixelRatio: 2 });
    expect(png.type).toBe("image/png");
    const bitmap = await createImageBitmap(png);
    const frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    expect(bitmap.width).toBe(frame.clientWidth * 2);
    expect(bitmap.height).toBe(frame.clientHeight * 2);
    bitmap.close();
  });

  it("should paint every mark family and mixed reference given the full theme and width matrix", async () => {
    container = mount(<VisualMatrix />);
    await flushPaint();

    const canvases = container.querySelectorAll<HTMLCanvasElement>(
      '[data-slot="plot-canvas-marks"]',
    );
    expect(canvases).toHaveLength(6);
    const frames = [...container.querySelectorAll<HTMLElement>('[data-slot="plot-frame"]')];
    expect(frames.map((frame) => Math.round(frame.getBoundingClientRect().height))).toEqual([
      320, 320, 240, 220, 220, 180,
    ]);
    const expectedMarks = new Map<string, number>([
      ["Operations trend", 6],
      ["Latency distribution and P95 trend", 6],
      ["Subsystem share", 3],
      ["Traffic heatmap", 4],
      ["Request flame graph", 3],
      ["SLO gauge", 1],
    ]);
    for (const frame of frames) {
      const label =
        required<HTMLElement>(frame, '[data-slot="plot-graphic"]').getAttribute("aria-label") ?? "";
      const expected = expectedMarks.get(label);
      expect(expected, `missing mark expectation for ${label}`).toBeDefined();
      expect(Number(frame.dataset.markCount), `${label} scene mark count`).toBeGreaterThanOrEqual(
        expected!,
      );
      const canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
      expect(countPaintedPixels(canvas), `${label} painted pixels`).toBeGreaterThan(50);
    }
    const expectedLegendPositions = new Map([
      ["Operations trend", "bottom"],
      ["Latency distribution and P95 trend", "top"],
      ["Subsystem share", "right"],
      ["Traffic heatmap", "left"],
    ]);
    for (const [label, position] of expectedLegendPositions) {
      const frame = frames.find(
        (candidate) =>
          candidate.querySelector('[data-slot="plot-graphic"]')?.getAttribute("aria-label") ===
          label,
      );
      const region = frame
        ?.closest('[data-slot="plot-root"]')
        ?.querySelector('[data-slot="plot-legends"]');
      expect(region?.getAttribute("data-plot-legend-position"), `${label} legend position`).toBe(
        position,
      );
    }

    const matrix = required<HTMLElement>(container, '[data-testid="visual-matrix"]');
    for (const theme of ["light", "dark"] as const) {
      for (const viewport of ["desktop", "narrow"] as const) {
        await page.viewport(viewport === "desktop" ? 800 : 440, 700);
        matrix.setAttribute("data-theme", theme);
        matrix.style.width = viewport === "desktop" ? "720px" : "360px";
        await flushPaint();
        for (const frame of frames) {
          const label =
            required<HTMLElement>(frame, '[data-slot="plot-graphic"]').getAttribute("aria-label") ??
            "";
          const root = frame.closest<HTMLElement>('[data-slot="plot-root"]');
          expect(root, `missing ${theme} ${viewport} root for ${label}`).not.toBeNull();
          const canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
          expect(
            countPaintedPixels(canvas),
            `${label} ${theme} ${viewport} painted pixels`,
          ).toBeGreaterThan(100);
        }
      }
    }
  });
});

interface ShareRow {
  id: string;
  name: string;
  value: number;
}
interface HeatRow {
  id: string;
  x: string;
  y: string;
  value: number;
}
interface FrameRow {
  id: string;
  parent: string | null;
  name: string;
  value: number;
}

const Share = createPlot<ShareRow>();
const Heat = createPlot<HeatRow>();
const Frame = createPlot<FrameRow>();

interface LatencyRow {
  id: string;
  timestamp: Date;
  latencyMs: number | null;
  p95: number;
  outcome: "ok" | "error";
}

const Latency = createPlot<LatencyRow>();
const latencyRows: readonly LatencyRow[] = Array.from({ length: 18 }, (_, index) => ({
  id: `request-${index}`,
  timestamp: new Date(Date.UTC(2026, 6, 17, 12, index)),
  latencyMs: index === 7 ? null : 70 + ((index * 53) % 390),
  p95: 170 + ((index * 19) % 90),
  outcome: index % 5 === 0 ? "error" : "ok",
}));

function MixedHistogramTrend() {
  return (
    <Latency.Root
      data={latencyRows}
      rowKey="id"
      label="Latency distribution and P95 trend"
      title="Request latency"
      height={320}
    >
      <Latency.Scale name="latency-x" channel="x" type="linear" nice />
      <Latency.Scale name="time-x" channel="x" type="utc" nice />
      <Latency.Scale name="count-y" channel="y" type="linear" nice />
      <Latency.Scale name="p95-y" channel="y" type="symlog" constant={10} nice />
      <Latency.Scale
        name="outcome-color"
        channel="color"
        type="ordinal-color"
        domain={["ok", "error"]}
      />
      <Latency.Bar
        x={bin("latencyMs", { thresholds: 8 })}
        y={count()}
        fill="outcome"
        stack="outcome"
        xScale="latency-x"
        yScale="count-y"
        colorScale="outcome-color"
      />
      <Latency.Line
        x="timestamp"
        y={movingAverage("p95", { window: 3 })}
        xScale="time-x"
        yScale="p95-y"
        stroke={constant("#7c3aed")}
        curve="monotone"
      />
      <Latency.Point
        x="timestamp"
        y="p95"
        xScale="time-x"
        yScale="p95-y"
        fill={constant("#7c3aed")}
      />
      <Latency.Axis scale="latency-x" orient="bottom" label="Latency" />
      <Latency.Axis scale="time-x" orient="top" label="UTC time" />
      <Latency.Axis scale="count-y" orient="left" label="Requests" />
      <Latency.Axis scale="p95-y" orient="right" label="P95" />
      <Latency.Legend scale="outcome-color" label="Outcome" position="top" />
    </Latency.Root>
  );
}

function VisualMatrix() {
  const shares: readonly ShareRow[] = [
    { id: "api", name: "API", value: 58 },
    { id: "worker", name: "Worker", value: 27 },
    { id: "cache", name: "Cache", value: 15 },
  ];
  const heat: readonly HeatRow[] = [
    { id: "a", x: "Mon", y: "AM", value: 2 },
    { id: "b", x: "Tue", y: "AM", value: 8 },
    { id: "c", x: "Mon", y: "PM", value: 5 },
    { id: "d", x: "Tue", y: "PM", value: 10 },
  ];
  const frames: readonly FrameRow[] = [
    { id: "root", parent: null, name: "request", value: 100 },
    { id: "route", parent: "root", name: "route", value: 62 },
    { id: "data", parent: "root", name: "data", value: 38 },
  ];
  return (
    <div
      data-testid="visual-matrix"
      data-theme="light"
      style={{
        width: "720px",
        padding: "16px",
        background: "var(--ak-chart-bg)",
        "--ak-chart-transition-duration": "0ms",
      }}
    >
      <CartesianExample />
      <MixedHistogramTrend />
      <Share.Root data={shares} rowKey="id" label="Subsystem share" height={240}>
        <Share.Arc
          value="value"
          category="name"
          innerRadius={0.55}
          padAngle={0.04}
          cornerRadius={6}
        />
        <Share.Legend position="right" />
      </Share.Root>
      <Heat.Root data={heat} rowKey="id" label="Traffic heatmap" height={220}>
        <Heat.Cell x="x" y="y" value="value" />
        <Heat.Legend label="Volume" position="left" />
      </Heat.Root>
      <Frame.Root data={frames} rowKey="id" label="Request flame graph" height={220}>
        <Frame.Rect
          transform={partition<FrameRow>({
            id: "id",
            parentId: "parent",
            value: "value",
          })}
          fill="name"
        />
      </Frame.Root>
      <Share.Root
        data={shares.slice(0, 1)}
        rowKey="id"
        label="SLO gauge"
        height={180}
        meter={{ role: "meter", min: 0, max: 100, value: 58 }}
      >
        <Share.Arc
          value="value"
          min={0}
          max={100}
          innerRadius={0.72}
          endAngle={Math.PI}
          cornerRadius={8}
        />
      </Share.Root>
    </div>
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
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function countPaintedPixels(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d");
  if (!context) return 0;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const baseline = [pixels[0], pixels[1], pixels[2], pixels[3]];
  let count = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (
      pixels[index] !== baseline[0] ||
      pixels[index + 1] !== baseline[1] ||
      pixels[index + 2] !== baseline[2] ||
      pixels[index + 3] !== baseline[3]
    ) {
      count += 1;
    }
  }
  return count;
}
