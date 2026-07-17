import { bench, describe } from "vite-plus/test";
import "../../src/styles.css";
import { createPlot } from "../../src";
import { renderPlotScene, defaultPlotTheme } from "../../src/render";
import { flushCanvasPaint, mountPlot, unmountPlot } from "../_shared/browser";
import { compileLineScene, sourceRows100k, type BenchmarkRow } from "../_shared/fixtures";

const runtimeGlobal = globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
};
runtimeGlobal.process ??= {};
runtimeGlobal.process.env ??= {};
runtimeGlobal.process.env.NODE_ENV = "production";

const BenchmarkPlot = createPlot<BenchmarkRow>();
const scene = compileLineScene(sourceRows100k);
const canvas = document.createElement("canvas");
canvas.width = 800;
canvas.height = 400;
const context = canvas.getContext("2d");
if (!context) throw new Error("Chromium did not provide a Canvas 2D context.");

let measuredMountMilliseconds = 0;
let mountClockAtStart = true;
const mountOptions = {
  time: 0,
  iterations: 3,
  warmupTime: 0,
  warmupIterations: 1,
  // Tinybench calls `now` immediately before and after each task. Feed it the
  // explicit compile/paint duration so deterministic Askr teardown remains out
  // of the acceptance sample while still running on every iteration.
  now: () => {
    if (mountClockAtStart) {
      mountClockAtStart = false;
      return 0;
    }
    mountClockAtStart = true;
    return measuredMountMilliseconds;
  },
};
const paintOptions = { time: 750, iterations: 50, warmupTime: 150, warmupIterations: 10 };

function HundredThousandRowPlot() {
  return (
    <BenchmarkPlot.Root
      data={sourceRows100k}
      rowKey="id"
      label="100k request latency"
      width={800}
      height={400}
    >
      <BenchmarkPlot.Line x="time" y="value" stroke="series" />
      <BenchmarkPlot.Tooltip />
      <BenchmarkPlot.Crosshair axes="xy" />
      <BenchmarkPlot.Zoom axes="xy" />
    </BenchmarkPlot.Root>
  );
}

describe("tier4 Chromium Canvas 2D acceptance", () => {
  bench(
    "mount, compile, and paint a 100k line plot (<=250ms)",
    async () => {
      const startedAt = performance.now();
      const root = mountPlot(<HundredThousandRowPlot />);
      try {
        await flushCanvasPaint();
        const frame = root.querySelector<HTMLElement>('[data-slot="plot-frame"]');
        const base = root.querySelector<HTMLCanvasElement>('[data-slot="plot-canvas-base"]');
        if (!frame || !base || frame.dataset.markCount !== "4" || base.width === 0) {
          throw new Error("The 100k plot did not complete its Canvas paint.");
        }
        measuredMountMilliseconds = performance.now() - startedAt;
      } finally {
        unmountPlot(root);
      }
    },
    mountOptions,
  );

  bench(
    "warm real-canvas 100k scene repaint (p99 proxy <=16.7ms)",
    () => {
      renderPlotScene(context, scene, defaultPlotTheme);
    },
    paintOptions,
  );
});
