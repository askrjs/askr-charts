/**
 * Browser test harness for the native Playwright suite.
 *
 * Playwright specs cannot author JSX inside `page.evaluate()`, so every chart
 * component the browser tests mount is declared here and published on
 * `window.charts`. Specs then drive the real DOM through `page.evaluate()`
 * exactly as the previous vitest browser tests did in-page.
 */
import { state, type State } from "@askrjs/askr";
import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import type { JSXElement } from "@askrjs/askr/jsx-runtime";
import { Dialog, DialogClose, DialogContent, DialogPortal, DialogTitle } from "@askrjs/ui/dialog";
import "../../src/styles.css";
import {
  appendPlotRows,
  bin,
  constant,
  count,
  createPlot,
  movingAverage,
  partition,
  type PlotApi,
  type PlotInteractionTarget,
  type PlotKey,
  type PlotSelection,
  type PlotView,
} from "../../src";

/* ------------------------------------------------------------------ */
/* canvas-rendering                                                     */
/* ------------------------------------------------------------------ */

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
  label = "Operations trend",
}: {
  onApiChange?: (api: PlotApi<CartesianRow> | null) => void;
  tokenHeight?: boolean;
  label?: string;
} = {}) {
  return (
    <Cartesian.Root
      data={cartesianRows}
      rowKey="id"
      label={label}
      title={label}
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

/* ------------------------------------------------------------------ */
/* dialog-teardown                                                      */
/* ------------------------------------------------------------------ */

const DialogPlot = createPlot<{ id: string; x: number; y: number }>();
const dialogRows = Object.freeze([
  { id: "a", x: 1, y: 2 },
  { id: "b", x: 2, y: 4 },
]);

function ChartDialog() {
  return (
    <Dialog defaultOpen>
      <DialogPortal>
        <DialogContent>
          <DialogTitle>Chart details</DialogTitle>
          <DialogPlot.Root
            data={dialogRows}
            rowKey="id"
            label="Dialog chart"
            width={320}
            height={180}
          >
            <DialogPlot.Line x="x" y="y" />
          </DialogPlot.Root>
          <DialogClose data-testid="close-chart-dialog">Close</DialogClose>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* interactions                                                         */
/* ------------------------------------------------------------------ */

interface InteractionRow {
  id: string;
  time: number;
  value: number;
  service: string;
}

const Interactive = createPlot<InteractionRow>();
const interactionRows: readonly InteractionRow[] = [
  { id: "a", time: 0, value: 4, service: "api" },
  { id: "b", time: 1, value: 8, service: "worker" },
  { id: "c", time: 2, value: 6, service: "api" },
  { id: "d", time: 3, value: 11, service: "worker" },
];

interface InteractivePlotProps {
  data?: readonly InteractionRow[] | (() => readonly InteractionRow[]);
  onApiChange?: (api: PlotApi<InteractionRow> | null) => void;
  onView?: (view: PlotView) => void;
  onSelection?: (selection: PlotSelection) => void;
  onActivate?: (
    row: InteractionRow,
    key: PlotKey,
    target: PlotInteractionTarget<InteractionRow>,
  ) => void;
  select?: "single" | "toggle";
  followLatest?: { rows: number };
}

function InteractivePlot({
  data = interactionRows,
  onApiChange,
  onView,
  onSelection,
  onActivate,
  select,
  followLatest = { rows: 10 },
}: InteractivePlotProps = {}) {
  return (
    <Interactive.Root
      data={data}
      rowKey="id"
      label="Live requests"
      title="Live requests"
      height={280}
      followLatest={followLatest}
      onApiChange={onApiChange}
      onViewChange={onView}
      onSelectionChange={onSelection}
      onActivate={onActivate}
    >
      <Interactive.Scale name="time-scale" channel="x" type="linear" />
      <Interactive.Scale name="value-scale" channel="y" type="linear" />
      <Interactive.Line
        x="time"
        y="value"
        xScale="time-scale"
        yScale="value-scale"
        stroke="service"
      />
      <Interactive.Point
        x="time"
        y="value"
        xScale="time-scale"
        yScale="value-scale"
        fill="service"
      />
      <Interactive.Legend interactive />
      <Interactive.Tooltip />
      <Interactive.Crosshair axes="xy" />
      {select ? <Interactive.Select mode={select} /> : null}
      <Interactive.Zoom axes="xy" wheel pinch pan />
      <Interactive.Brush axis="xy" modifier="shift" />
    </Interactive.Root>
  );
}

/** Mirrors the inline `LiveApp` component of the old interactions test. */
function LiveApp({
  onAppend,
  onApiChange,
}: {
  onAppend: (append: () => void) => void;
  onApiChange: (api: PlotApi<InteractionRow>) => void;
}) {
  const rows = state<readonly InteractionRow[]>(interactionRows);
  onAppend(() =>
    rows.set((current) => appendPlotRows(current, { id: "e", time: 4, value: 14, service: "api" })),
  );
  return <InteractivePlot data={rows} onApiChange={(value) => value && onApiChange(value)} />;
}

/** Mirrors the inline `FollowApp` component of the old interactions test. */
function FollowApp({
  onAppend,
  onApiChange,
}: {
  onAppend: (append: () => void) => void;
  onApiChange: (api: PlotApi<InteractionRow>) => void;
}) {
  const rows = state<readonly InteractionRow[]>(interactionRows);
  onAppend(() =>
    rows.set((current) => appendPlotRows(current, { id: "e", time: 4, value: 14, service: "api" })),
  );
  return (
    <InteractivePlot
      data={rows}
      followLatest={{ rows: 2 }}
      onApiChange={(value) => value && onApiChange(value)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* transitions                                                          */
/* ------------------------------------------------------------------ */

interface TransitionRow {
  id: string;
  day: string;
  value: number;
  series: string;
}

const Transition = createPlot<TransitionRow>();
const transitionRows: readonly TransitionRow[] = [
  { id: "a", day: "Mon", value: 2, series: "api" },
  { id: "b", day: "Tue", value: 4, series: "worker" },
];

function TransitionPlot({
  data,
  onApiChange,
}: {
  data: readonly TransitionRow[] | (() => readonly TransitionRow[]);
  onApiChange: (api: PlotApi<TransitionRow> | null) => void;
}) {
  return (
    <Transition.Root
      data={data}
      rowKey="id"
      label="Transition evidence"
      width={420}
      height={220}
      defaultSelection={{ keys: ["a"] }}
      onApiChange={onApiChange}
    >
      <Transition.Line x="day" y="value" stroke="series" />
      <Transition.Point x="day" y="value" fill="series" />
      <Transition.Legend interactive />
    </Transition.Root>
  );
}

function TransitionExample({
  onRows,
  onApiChange,
}: {
  onRows: (rows: State<readonly TransitionRow[]>) => void;
  onApiChange: (api: PlotApi<TransitionRow> | null) => void;
}) {
  const liveRows = state<readonly TransitionRow[]>(transitionRows);
  onRows(liveRows);
  return <TransitionPlot data={liveRows} onApiChange={onApiChange} />;
}

/* ------------------------------------------------------------------ */
/* published surface                                                    */
/* ------------------------------------------------------------------ */

/** Awaits a microtask plus two animation frames, as the old tests did. */
async function flushPaint(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** Awaits a microtask plus `count` sequential animation frames. */
async function flushFrames(count = 5): Promise<void> {
  await Promise.resolve();
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(condition: () => boolean, timeoutMilliseconds = 1_000): Promise<void> {
  const deadline = performance.now() + timeoutMilliseconds;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error("Timed out waiting for browser state.");
    await delay(10);
  }
}

function required<ElementType extends Element>(root: ParentNode, selector: string): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

function legendButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-slot="plot-legend-item"]'),
  ].find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Missing legend item ${label}`);
  return button;
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

function countPaintedPixels(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext("2d");
  if (!context) return 0;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const baseline = [pixels[0], pixels[1], pixels[2], pixels[3]];
  let painted = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (
      pixels[index] !== baseline[0] ||
      pixels[index + 1] !== baseline[1] ||
      pixels[index + 2] !== baseline[2] ||
      pixels[index + 3] !== baseline[3]
    ) {
      painted += 1;
    }
  }
  return painted;
}

function firstPoint(svg: string): { x: number; y: number } {
  const match = /<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/.exec(svg);
  if (!match) throw new Error("Expected an exported point circle.");
  return { x: Number(match[1]), y: Number(match[2]) };
}

export interface ChartsHarness {
  createIsland: typeof createIsland;
  cleanupApp: typeof cleanupApp;
  /** Appends a host `div` to `document.body` and boots `component` inside it. */
  mount: (component: () => JSXElement, options?: { width?: string }) => HTMLDivElement;
  flushPaint: typeof flushPaint;
  flushFrames: typeof flushFrames;
  delay: typeof delay;
  waitFor: typeof waitFor;
  required: typeof required;
  legendButton: typeof legendButton;
  dispatchPointer: typeof dispatchPointer;
  countPaintedPixels: typeof countPaintedPixels;
  firstPoint: typeof firstPoint;
  components: {
    CartesianExample: typeof CartesianExample;
    VisualMatrix: typeof VisualMatrix;
    ChartDialog: typeof ChartDialog;
    InteractivePlot: typeof InteractivePlot;
    LiveApp: typeof LiveApp;
    FollowApp: typeof FollowApp;
    TransitionExample: typeof TransitionExample;
  };
}

function mount(component: () => JSXElement, options: { width?: string } = {}): HTMLDivElement {
  const root = document.createElement("div");
  if (options.width) root.style.width = options.width;
  document.body.append(root);
  createIsland({ root, component });
  return root;
}

(window as Window & { charts: ChartsHarness }).charts = {
  createIsland,
  cleanupApp,
  mount,
  flushPaint,
  flushFrames,
  delay,
  waitFor,
  required,
  legendButton,
  dispatchPointer,
  countPaintedPixels,
  firstPoint,
  components: {
    CartesianExample,
    VisualMatrix,
    ChartDialog,
    InteractivePlot,
    LiveApp,
    FollowApp,
    TransitionExample,
  },
};
