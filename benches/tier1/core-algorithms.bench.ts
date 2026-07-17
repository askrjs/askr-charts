import { bench, describe } from "vite-plus/test";
import { downsamplePixelEnvelope } from "../../src/paths";
import { appendPlotRows, trimPlotRows, upsertPlotRows } from "../../src/rows";
import { createScale } from "../../src/scales";
import {
  createBins,
  linearRegression,
  movingWindowValues,
  stackValues,
} from "../../src/transforms";
import { liveBatchRows, liveWindowRows, sourceRows10k, sourceRows100k } from "../_shared/fixtures";
import { consume } from "../_shared/sink";

const shortOptions = { time: 500, iterations: 20, warmupTime: 100, warmupIterations: 5 };
const values10k = Object.freeze(sourceRows10k.map((row) => row.value));
const times10k = Object.freeze(sourceRows10k.map((row) => row.time));
const stackInput = Object.freeze(
  sourceRows10k.slice(0, 4_000).map((row, index) => ({
    key: Math.floor(index / 4),
    series: row.series,
    value: index % 9 === 0 ? -row.value : row.value,
    index,
  })),
);
const densePoints = Object.freeze(
  sourceRows100k.map((row) => ({ x: row.time / 125, y: row.value })),
);

describe("tier1 DOM-free algorithm hot paths", () => {
  bench(
    "map 10k values and generate linear ticks",
    () => {
      const scale = createScale({
        name: "latency",
        type: "linear",
        values: values10k,
        range: [0, 800],
      });
      let mapped: unknown;
      for (let index = 0; index < values10k.length; index += 1) {
        mapped = scale.map(values10k[index]);
      }
      consume([mapped, scale.ticks(10)]);
    },
    shortOptions,
  );

  bench(
    "bin, moving-average, and regress 10k values",
    () => {
      consume([
        createBins(values10k, { thresholds: 40 }),
        movingWindowValues(values10k, { window: 64, operation: "mean", partial: true }),
        linearRegression(times10k, values10k),
      ]);
    },
    shortOptions,
  );

  bench(
    "build a diverging normalized stack",
    () => {
      consume(stackValues(stackInput, { offset: "expand", order: "inside-out" }));
    },
    shortOptions,
  );

  bench(
    "downsample a 100k line to an 800px envelope",
    () => {
      consume(downsamplePixelEnvelope(densePoints, 800));
    },
    shortOptions,
  );

  bench(
    "append, upsert, and trim a 1k live batch immutably",
    () => {
      const appended = appendPlotRows(liveWindowRows, liveBatchRows);
      const upserted = upsertPlotRows(appended, liveBatchRows.slice(0, 50), "id");
      consume(trimPlotRows(upserted, { rows: 5_000 }));
    },
    shortOptions,
  );
});
