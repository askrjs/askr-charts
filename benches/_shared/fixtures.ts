import { compilePlotScene } from "../../src/compiler";
import type { PlotDescriptor } from "../../src/descriptors";
import type { PlotView } from "../../src/model";
import type { PlotScene } from "../../src/scene-model";

export interface BenchmarkRow {
  readonly id: number;
  readonly time: number;
  readonly value: number;
  readonly low: number;
  readonly series: "api" | "worker" | "cache" | "queue";
}

const SERIES = ["api", "worker", "cache", "queue"] as const;

export const sourceRows100k = buildRows(100_000);
export const sourceRows10k = Object.freeze(sourceRows100k.slice(0, 10_000));
export const liveWindowRows = Object.freeze(sourceRows100k.slice(95_000, 99_000));
export const liveBatchRows = buildRows(1_000, 100_000);

export const lineDescriptors: readonly PlotDescriptor[] = Object.freeze([
  descriptor("Line", { x: "time", y: "value", stroke: "series" }),
  descriptor("Tooltip", {}),
  descriptor("Crosshair", { axes: "xy" }),
  descriptor("Zoom", { axes: "xy" }),
]);

export const mixedDescriptors: readonly PlotDescriptor[] = Object.freeze([
  descriptor("Bar", { x: "time", y: "low", fill: "series" }),
  descriptor("Line", { x: "time", y: "value", stroke: "series" }),
  descriptor("Point", { x: "time", y: "value", fill: "series", r: 2 }),
  descriptor("Tooltip", {}),
  descriptor("Crosshair", { axes: "xy" }),
  descriptor("Zoom", { axes: "xy" }),
  descriptor("Brush", { axis: "x", modifier: "shift" }),
]);

export function buildRows(count: number, offset = 0): readonly BenchmarkRow[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const id = offset + index;
      const wave = Math.sin(id / 79) * 23 + Math.cos(id / 311) * 8;
      return Object.freeze({
        id,
        time: id,
        value: 80 + wave + (id % 17),
        low: 52 + wave * 0.45,
        series: SERIES[id % SERIES.length]!,
      });
    }),
  );
}

export function compileLineScene(
  rows: readonly BenchmarkRow[] = sourceRows100k,
  view?: PlotView,
): PlotScene<BenchmarkRow> {
  return compilePlotScene({
    rows,
    rowKey: "id",
    label: "100k request latency",
    descriptors: lineDescriptors,
    width: 800,
    height: 400,
    pixelRatio: 1,
    view,
  });
}

export function compileMixedScene(
  rows: readonly BenchmarkRow[] = sourceRows10k,
): PlotScene<BenchmarkRow> {
  return compilePlotScene({
    rows,
    rowKey: "id",
    label: "Mixed request latency",
    descriptors: mixedDescriptors,
    width: 800,
    height: 400,
    pixelRatio: 1,
  });
}

function descriptor(kind: PlotDescriptor["kind"], props: Record<string, unknown>): PlotDescriptor {
  return Object.freeze({ kind, props: Object.freeze(props) });
}
