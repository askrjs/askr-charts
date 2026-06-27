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
import { PieChart } from "../../src/components/pie-chart";
import { ProgressMeter } from "../../src/components/progress-meter";
import { RadialGauge } from "../../src/components/radial-gauge";
import { Sparkline } from "../../src/components/sparkline";
import { StackedBarChart } from "../../src/components/stacked-bar-chart";
import { Timeline } from "../../src/components/timeline";
import {
  benchDonutData,
  benchFlameGraphData,
  benchHeatmapData,
  benchLegendItems,
  benchPieData,
  benchSparklineData,
  benchStackedRows,
  benchTimelineData,
  benchTrendData,
  benchValueData,
  buildFlameGraphData,
  buildHeatmapData,
  buildLegendItems,
  buildStackedBarRows,
  buildTimelineData,
  buildValueData,
} from "../_shared/fixtures";
import { expectBenchCount, expectBenchElement, runMountedBench } from "../_shared/dom";

const valueData = buildValueData(18);
const donutData = buildValueData(6);
const heatmapData = buildHeatmapData(6, 4);
const timelineData = buildTimelineData(8);
const stackedRows = buildStackedBarRows(6, 4);
const flameGraphData = buildFlameGraphData();
const legendItems = buildLegendItems();
const trendData = buildValueData(12);
const sparklineData = buildValueData(10);

function benchMount(name: string, element: () => JSX.Element, selector: string, expectedCount = 1) {
  bench(name, async () => {
    await runMountedBench(element(), (container) => {
      expectBenchCount(container, selector, expectedCount);
    });
  });
}

describe("tier2 public chart render benches", () => {
  benchMount(
    "area chart isolated mount",
    () => <AreaChart label="Orders" animate data={benchTrendData} />,
    '[data-slot="area-chart"]',
  );

  benchMount(
    "bar chart isolated mount",
    () => <BarChart label="Revenue" animate data={benchValueData} />,
    '[data-slot="bar-chart"]',
  );

  benchMount(
    "donut chart isolated mount",
    () => <DonutChart label="Mix" animate data={benchDonutData} />,
    '[data-slot="donut-chart"]',
  );

  benchMount(
    "pie chart isolated mount",
    () => <PieChart label="Share" animate data={benchPieData} />,
    '[data-slot="pie-chart"]',
  );

  benchMount(
    "flame graph isolated mount",
    () => <FlameGraph label="Request flame graph" animate data={benchFlameGraphData} />,
    '[data-slot="flame-graph"]',
  );

  benchMount(
    "heatmap isolated mount",
    () => <Heatmap label="Capacity" animate data={benchHeatmapData} />,
    '[data-slot="heatmap"]',
  );

  benchMount(
    "line chart isolated mount",
    () => <LineChart label="Signups" animate data={benchTrendData} />,
    '[data-slot="line-chart"]',
  );

  benchMount(
    "progress meter isolated mount",
    () => <ProgressMeter label="SLO" animate max={100} value={81} />,
    '[data-slot="progress-meter"]',
  );

  benchMount(
    "radial gauge isolated mount",
    () => <RadialGauge label="Fill rate" animate value={68} max={100} />,
    '[data-slot="radial-gauge"]',
  );

  benchMount(
    "sparkline bar isolated mount",
    () => <Sparkline label="Trend" animate data={benchSparklineData} />,
    '[data-slot="sparkline"]',
  );

  benchMount(
    "sparkline line isolated mount",
    () => <Sparkline label="Trend" animate variant="line" data={benchSparklineData} />,
    '[data-slot="sparkline"]',
  );

  benchMount(
    "stacked bar chart isolated mount",
    () => <StackedBarChart label="Delivery mix" animate data={benchStackedRows} />,
    '[data-slot="stacked-bar-chart"]',
  );

  benchMount(
    "timeline isolated mount",
    () => <Timeline label="Delivery plan" animate data={benchTimelineData} />,
    '[data-slot="timeline"]',
  );

  benchMount(
    "chart shell isolated mount",
    () => (
      <ChartShell title="Bench shell" description="Public chart composition benchmark">
        <span data-slot="bench-shell-child" />
      </ChartShell>
    ),
    '[data-slot="chart-shell"]',
  );

  benchMount(
    "chart panel isolated mount",
    () => (
      <ChartPanel title="Bench panel" description="Panel benchmark">
        <span data-slot="bench-panel-child" />
      </ChartPanel>
    ),
    '[data-slot="chart-panel"]',
  );

  bench("chart legend isolated mount", async () => {
    await runMountedBench(<ChartLegend title="Legend" items={benchLegendItems} />, (container) => {
      expectBenchElement(container, '[data-slot="chart-legend"]', "chart legend");
      expectBenchCount(container, '[data-slot="chart-legend-item"]', benchLegendItems.length);
    });
  });

  benchMount(
    "chart empty state isolated mount",
    () => <ChartEmptyState title="No alerts" description="Everything is healthy" />,
    '[data-slot="chart-empty-state"]',
  );

  bench("value chart family mount", async () => {
    await runMountedBench(
      <>
        <BarChart label="Revenue" animate data={valueData} />
        <DonutChart label="Mix" animate data={donutData} />
        <PieChart label="Share" animate data={benchPieData} />
        <ProgressMeter label="SLO" animate max={100} value={81} />
      </>,
      (container) => {
        const charts = container.querySelectorAll(
          '[data-slot="bar-chart"], [data-slot="donut-chart"], [data-slot="pie-chart"], [data-slot="progress-meter"]',
        );

        if (charts.length !== 4) {
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
