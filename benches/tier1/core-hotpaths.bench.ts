import { bench, describe } from "vite-plus/test";

import {
  buildDonutStops,
  buildHeatmapSummary,
  buildValueChartSummary,
  clampChartValue,
  createHeatmapLegendItems,
  createValueChartLegendItems,
  formatChartValue,
  getAnimationDataAttrs,
  getAnimationStyle,
  getChartSeriesColor,
  getChartStatusColor,
  getValueChartMax,
  getValueChartMin,
  getValueChartTotal,
  normalizeAnimation,
  normalizeHeatmapData,
  normalizeValueChartData,
  toChartFraction,
  uniqueLabels,
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
const normalizedValueData = normalizeValueChartData(valueData, { max: 120 }).data;
const normalizedHeatmapData = normalizeHeatmapData(heatmapData, { max: 120 }).cells;
const duplicateLabels = valueData.map((datum, index) =>
  index % 4 === 0 ? "Repeated label" : datum.label,
);
const formatter = (value: number) => `$${value}k`;

describe("tier1 chart hotpath benches", () => {
  bench("clamp, fraction, and format helpers", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = {
        clamped: clampChartValue(index % 5 === 0 ? Number.NaN : index - 12),
        formatted: formatChartValue(index % 3 === 0 ? 1_200 + index : index),
        fraction: toChartFraction(index, 240, 12),
      };
    }

    consume(result);
  });

  bench("value chart scale helpers", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = {
        max: getValueChartMax(valueData, index % 2 === 0 ? 120 : undefined),
        min: getValueChartMin(valueData, index % 2 === 0 ? 4 : undefined),
        total: getValueChartTotal(valueData),
      };
    }

    consume(result);
  });

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

  bench("normalize value chart detected scale", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeValueChartData(valueData, {
        valueFormatter: index % 2 === 0 ? formatter : undefined,
      });
    }

    consume(result);
  });

  bench("normalize heatmap detected scale", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = normalizeHeatmapData(heatmapData, {
        valueFormatter: index % 2 === 0 ? formatter : undefined,
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

  bench("summary builders", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = {
        heatmap: buildHeatmapSummary("Capacity", normalizedHeatmapData, 120, formatter),
        value: buildValueChartSummary("Revenue", normalizedValueData, 120, formatter),
      };
    }

    consume(result);
  });

  bench("series and status color helpers", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      result = {
        series: getChartSeriesColor(index, index % 5 === 0 ? "tomato" : undefined),
        status: getChartStatusColor(index % 2 === 0 ? "success" : "info"),
      };
    }

    consume(result);
  });

  bench("unique label ordering", () => {
    let result: string[] | undefined;

    for (let index = 0; index < WORK; index += 1) {
      result = uniqueLabels(duplicateLabels);
    }

    consume(result);
  });

  bench("animation helpers", () => {
    let result: unknown;

    for (let index = 0; index < WORK; index += 1) {
      const animation = normalizeAnimation(
        index % 2 === 0
          ? true
          : {
              type: "sweep",
              duration: index,
              delay: index % 12,
              stagger: index % 6,
              easing: "spring",
            },
        { type: "grow" },
      );

      result = {
        attrs: getAnimationDataAttrs(animation),
        style: getAnimationStyle(animation),
      };
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
