import { bench, describe } from "vite-plus/test";

import {
  buildDonutStops,
  createHeatmapLegendItems,
  createValueChartLegendItems,
  normalizeHeatmapData,
  normalizeValueChartData,
} from "../../src/core";
import {
  createChartId,
  mergeChartProps,
  mergeChartStyles,
} from "../../src/components/_internal/chart-helpers";
import { buildHeatmapData, buildValueData } from "../_shared/fixtures";
import { consume } from "../_shared/sink";

const WORK = 128;
const valueData = buildValueData(48);
const heatmapData = buildHeatmapData(12, 8);
const tupleValueData = valueData.map(
  (datum) => [datum.label, datum.value, datum.color, datum.description] as const,
);
const tupleHeatmapData = heatmapData.map(
  (datum) => [datum.x, datum.y, datum.value, datum.color, datum.description] as const,
);
const donutStopsData = normalizeValueChartData(valueData.slice(0, 12)).data;

describe("tier1 chart hotpath benches", () => {
  bench("normalize value chart data", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeValueChartData(valueData, {
        max: 120,
      });
    }

    consume(result);
  });

  bench("normalize heatmap data", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeHeatmapData(heatmapData, {
        max: 120,
      });
    }

    consume(result);
  });

  bench("build donut stops", () => {
    let result: string | undefined;

    for (let index = 0; index < WORK; index += 1) {
      result = buildDonutStops(normalizeValueChartData(valueData.slice(0, 12)).data);
    }

    consume(result);
  });

  bench("merge chart props and styles", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = mergeChartProps(
        { onPointerMove: () => undefined, role: "img", tabIndex: 0 },
        { onPointerMove: () => undefined, "data-slot": "bench-chart" },
        { style: mergeChartStyles({ "--ak-chart-item-index": index }, "opacity:1") },
      );
    }

    consume(result);
  });

  bench("build legend items", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = {
        heatmap: createHeatmapLegendItems(heatmapData, { steps: 4 }),
        value: createValueChartLegendItems(valueData.slice(0, 10)),
      };
    }

    consume(result);
  });

  bench("create chart ids", () => {
    let result = "";

    for (let index = 0; index < WORK; index += 1) {
      result = createChartId("chart-bench", `Revenue panel ${index}`);
    }

    consume(result);
  });

  bench("normalize value chart tuple data", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeValueChartData(tupleValueData, {
        max: 120,
      });
    }

    consume(result);
  });

  bench("normalize heatmap tuple data", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeHeatmapData(tupleHeatmapData, {
        max: 120,
      });
    }

    consume(result);
  });

  bench("build donut stops from normalized data", () => {
    let result: string | undefined;

    for (let index = 0; index < WORK; index += 1) {
      result = buildDonutStops(donutStopsData);
    }

    consume(result);
  });
});
