import { state, type State } from "@askrjs/askr";
import { cleanupApp, createIsland } from "@askrjs/askr/boot";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createPlot, type PlotApi } from "../../src";
import "../../src/styles.css";

interface Row {
  id: string;
  day: string;
  value: number;
  series: string;
}

const Plot = createPlot<Row>();
const initialRows: readonly Row[] = [
  { id: "a", day: "Mon", value: 2, series: "api" },
  { id: "b", day: "Tue", value: 4, series: "worker" },
];
let liveRows: State<readonly Row[]> | null = null;
let plotApi: PlotApi<Row> | null = null;

function TransitionExample() {
  liveRows = state<readonly Row[]>(initialRows);
  return <TransitionPlot data={liveRows} />;
}

function TransitionPlot({ data }: { data: readonly Row[] | (() => readonly Row[]) }) {
  return (
    <Plot.Root
      data={data}
      rowKey="id"
      label="Transition evidence"
      width={420}
      height={220}
      defaultSelection={{ keys: ["a"] }}
      onApiChange={(api) => (plotApi = api)}
    >
      <Plot.Line x="day" y="value" stroke="series" />
      <Plot.Point x="day" y="value" fill="series" />
      <Plot.Legend interactive />
    </Plot.Root>
  );
}

describe("mounted canvas transitions", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (container) {
      cleanupApp(container);
      container.remove();
    }
    container = null;
    liveRows = null;
    plotApi = null;
    vi.restoreAllMocks();
  });

  it("should animate keyed updates and cancel deterministically given reduced motion and cleanup", async () => {
    let reducedMotion = false;
    const nativeMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) =>
      query === "(prefers-reduced-motion: reduce)"
        ? motionMediaQuery(query, () => reducedMotion)
        : nativeMatchMedia(query),
    );
    container = document.createElement("div");
    container.style.setProperty("--ak-chart-transition-duration", "120ms");
    document.body.append(container);
    const element = <TransitionExample />;
    createIsland({ root: container, component: () => element });
    await flushPaint();
    await delay(140);

    let frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    let canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
    expect(frame.dataset.animationMode).toBe("none");
    expect(frame.hasAttribute("data-animation-running")).toBe(false);
    legendButton(container, "api").click();
    frame.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(plotApi!.exportSvg({ includeOverlays: true })).toMatch(
      /data-plot-overlays="true"[\s\S]*<circle/,
    );

    liveRows!.set([
      { id: "b", day: "Tue", value: 1, series: "worker" },
      { id: "a", day: "Mon", value: 8, series: "api" },
      { id: "c", day: "Wed", value: 5, series: "api" },
    ]);
    expect(liveRows!()).toHaveLength(3);
    await flushPaint();
    expect(plotApi?.rows).toHaveLength(3);

    frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
    await waitFor(() => frame?.dataset.animationMode === "keyed");
    expect(frame.dataset.animationMode, JSON.stringify({ ...frame.dataset })).toBe("keyed");
    expect(frame.getAttribute("data-animation-running")).toBe("true");
    expect(legendButton(container, "api").getAttribute("aria-pressed")).toBe("false");
    const selected = JSON.parse(
      plotApi!.exportData({ rows: "source", scope: "selected", format: "json" }),
    ) as Row[];
    expect(selected.map(({ id }) => id)).toEqual(["a"]);
    expect(plotApi!.exportSvg({ includeOverlays: true })).toMatch(
      /data-plot-overlays="true"[\s\S]*<circle/,
    );
    await delay(150);
    expect(frame.hasAttribute("data-animation-running")).toBe(false);

    reducedMotion = true;
    liveRows!.set([
      { id: "a", day: "Mon", value: 3, series: "api" },
      { id: "c", day: "Wed", value: 9, series: "api" },
    ]);
    await flushPaint();
    frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
    expect(frame.dataset.animationMode).toBe("none");
    expect(frame.hasAttribute("data-animation-running")).toBe(false);

    reducedMotion = false;
    liveRows!.set([
      { id: "a", day: "Mon", value: 9, series: "api" },
      { id: "c", day: "Wed", value: 2, series: "worker" },
    ]);
    await flushPaint();
    frame = required<HTMLElement>(container, '[data-slot="plot-frame"]');
    canvas = required<HTMLCanvasElement>(frame, '[data-slot="plot-canvas-marks"]');
    expect(frame.getAttribute("data-animation-running")).toBe("true");

    cleanupApp(container);
    expect(frame.hasAttribute("data-animation-running")).toBe(false);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    container.remove();
    container = null;
  });
});

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

async function flushPaint(): Promise<void> {
  await Promise.resolve();
  for (let frame = 0; frame < 5; frame += 1) {
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

function motionMediaQuery(query: string, reduced: () => boolean): MediaQueryList {
  return {
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
  };
}
