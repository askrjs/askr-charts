import { bench, describe } from "vite-plus/test";

import { AreaChart } from "../../src/components/area-chart";
import { BarChart } from "../../src/components/bar-chart";
import { ChartEmptyState } from "../../src/components/chart-empty-state";
import { ChartLegend } from "../../src/components/chart-legend";
import { ChartPanel } from "../../src/components/chart-panel";
import { ChartShell } from "../../src/components/chart-shell";
import { DonutChart } from "../../src/components/donut-chart";
import { FlameGraph } from "../../src/components/flame-graph";
import { Heatmap } from "../../src/components/heatmap";
import { LineChart } from "../../src/components/line-chart";
import { ProgressMeter } from "../../src/components/progress-meter";
import { RadialGauge } from "../../src/components/radial-gauge";
import { Sparkline } from "../../src/components/sparkline";
import { StackedBarChart } from "../../src/components/stacked-bar-chart";
import { Timeline } from "../../src/components/timeline";
import {
  buildFlameGraphData,
  buildHeatmapData,
  buildLegendItems,
  buildStackedBarRows,
  buildTimelineData,
  buildValueData,
} from "../_shared/fixtures";
import { runMountedBench } from "../_shared/dom";

const valueData = buildValueData(18);
const donutData = buildValueData(6);
const heatmapData = buildHeatmapData(6, 4);
const timelineData = buildTimelineData(8);
const stackedRows = buildStackedBarRows(6, 4);
const flameGraphData = buildFlameGraphData();
const legendItems = buildLegendItems();
const trendData = buildValueData(12);
const sparklineData = buildValueData(10);

describe("tier2 public chart render benches", () => {
  bench("value chart family mount", async () => {
    await runMountedBench(
      <>
        <BarChart label="Revenue" animate data={valueData} />
        <DonutChart label="Mix" animate data={donutData} />
        <ProgressMeter label="SLO" animate max={100} value={81} />
      </>,
      (container) => {
        const charts = container.querySelectorAll(
          '[data-slot="bar-chart"], [data-slot="donut-chart"], [data-slot="progress-meter"]',
        );

        if (charts.length !== 3) {
          throw new Error("value chart family bench failed to mount the expected public charts");
        }
      },
    );
  });

  bench("structural chart family mount", async () => {
    await runMountedBench(
      <>
        <Heatmap label="Capacity" animate data={heatmapData} />
        <StackedBarChart label="Delivery mix" animate data={stackedRows} />
        <FlameGraph label="Flame graph" animate data={flameGraphData} />
        <Timeline label="Delivery plan" animate data={timelineData} />
      </>,
      (container) => {
        const charts = container.querySelectorAll(
          '[data-slot="heatmap"], [data-slot="stacked-bar-chart"], [data-slot="flame-graph"], [data-slot="timeline"]',
        );

        if (charts.length !== 4) {
          throw new Error(
            "structural chart family bench failed to mount the expected public charts",
          );
        }
      },
    );
  });

  bench("trend and compact chart family mount", async () => {
    await runMountedBench(
      <>
        <AreaChart label="Orders" animate data={trendData} />
        <LineChart label="Signups" animate data={trendData} />
        <RadialGauge label="Fill rate" animate value={68} max={100} />
        <Sparkline label="Trend" animate variant="line" data={sparklineData} />
      </>,
      (container) => {
        const charts = container.querySelectorAll(
          '[data-slot="area-chart"], [data-slot="line-chart"], [data-slot="radial-gauge"], [data-slot="sparkline"]',
        );

        if (charts.length !== 4) {
          throw new Error("trend chart family bench failed to mount the expected public charts");
        }
      },
    );
  });

  bench("shell and legend composition mount", async () => {
    await runMountedBench(
      <ChartShell title="Bench shell" description="Public chart composition benchmark">
        <ChartPanel title="Summary">
          <BarChart label="Revenue" animate data={valueData} />
        </ChartPanel>
        <ChartLegend title="Legend" items={legendItems} />
        <ChartEmptyState title="No alerts" description="Everything is healthy" />
      </ChartShell>,
      (container) => {
        const shell = container.querySelector('[data-slot="chart-shell"]');
        const legendItems = container.querySelectorAll('[data-slot="chart-legend-item"]');
        const emptyState = container.querySelector('[data-slot="chart-empty-state"]');

        if (!shell || legendItems.length === 0 || !emptyState) {
          throw new Error(
            "shell composition bench failed to mount the expected chart shell structure",
          );
        }
      },
    );
  });

  bench("dashboard panel composition mount", async () => {
    await runMountedBench(
      <>
        <ChartPanel title="Revenue panel">
          <BarChart label="Revenue" animate data={valueData} />
        </ChartPanel>
        <ChartPanel title="Capacity panel">
          <Heatmap label="Capacity" animate data={heatmapData} />
        </ChartPanel>
      </>,
      (container) => {
        const panels = container.querySelectorAll('[data-slot="chart-panel"]');

        if (panels.length !== 2) {
          throw new Error("dashboard panel bench failed to mount the expected panel composition");
        }
      },
    );
  });
});
