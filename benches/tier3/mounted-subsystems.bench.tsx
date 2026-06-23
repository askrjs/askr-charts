import { bench, describe } from "vite-plus/test";

import {
  AreaChart,
  BarChart,
  DonutChart,
  FlameGraph,
  Heatmap,
  LineChart,
  ProgressMeter,
  RadialGauge,
  Sparkline,
  StackedBarChart,
  Timeline,
} from "../../src/components";
import {
  benchDonutData,
  benchFlameGraphData,
  benchHeatmapData,
  benchSparklineData,
  benchStackedRows,
  benchTimelineData,
  benchTrendData,
  benchValueData,
  buildHeatmapData,
  buildTimelineData,
  buildValueData,
  DashboardBench,
} from "../_shared/fixtures";
import {
  dispatchPointerMove,
  expectBenchCount,
  expectBenchElement,
  normalizeStyle,
  runMountedBench,
} from "../_shared/dom";

const barChartData = buildValueData(16);
const heatmapData = buildHeatmapData(6, 5);
const timelineData = buildTimelineData(12);

describe("tier3 mounted subsystem benches", () => {
  bench("dashboard mount cycle", async () => {
    await runMountedBench(<DashboardBench />, (container) => {
      const panels = container.querySelectorAll('[data-slot="chart-panel"]');
      const legendItems = container.querySelectorAll('[data-slot="chart-legend-item"]');

      if (panels.length < 4 || legendItems.length === 0) {
        throw new Error("dashboard bench failed to mount expected chart shell structure");
      }
    });
  });

  bench("bar chart tooltip update cycle", async () => {
    await runMountedBench(<BarChart label="Revenue" animate data={barChartData} />, (container) => {
      const item = container.querySelector('[data-slot="bar-chart-item"]') as HTMLElement | null;

      if (!item) {
        throw new Error("bar chart bench failed to mount an interactive item");
      }

      dispatchPointerMove(
        item,
        { left: 100, top: 24, width: 200, height: 40 },
        { clientX: 152, clientY: 46 },
      );
      const style = normalizeStyle(item.getAttribute("style"));

      if (!style.includes("--ak-chart-tooltip-anchor-x:52px")) {
        throw new Error("bar chart bench failed to update tooltip anchor x");
      }
    });
  });

  bench("area chart mounted point scan", async () => {
    await runMountedBench(<AreaChart label="Orders" animate data={benchTrendData} />, (container) => {
      expectBenchElement(container, '[data-slot="area-chart-surface"]', "area chart");
      expectBenchCount(container, '[data-slot="area-chart-item"]', benchTrendData.length);
    });
  });

  bench("line chart mounted terminal scan", async () => {
    await runMountedBench(<LineChart label="Signups" animate data={benchTrendData} />, (container) => {
      expectBenchCount(container, '[data-slot="line-chart-item"]', benchTrendData.length);
      expectBenchElement(container, '[data-ak-line-terminal="true"]', "line chart");
    });
  });

  bench("donut chart segment and list scan", async () => {
    await runMountedBench(<DonutChart label="Mix" animate data={benchDonutData} />, (container) => {
      expectBenchCount(container, '[data-slot="donut-chart-item"]', benchDonutData.length);
      expectBenchCount(container, '[data-slot="donut-chart-segment"]', benchDonutData.length);
    });
  });

  bench("flame graph mounted cell scan", async () => {
    await runMountedBench(
      <FlameGraph label="Request flame graph" animate data={benchFlameGraphData} />,
      (container) => {
        expectBenchCount(container, '[data-slot="flame-graph-cell"]', 12);
        expectBenchCount(container, '[data-slot="flame-graph-row"]', 3);
      },
    );
  });

  bench("heatmap mount and scan", async () => {
    await runMountedBench(<Heatmap label="Capacity" animate data={heatmapData} />, (container) => {
      const cells = container.querySelectorAll('[data-slot="heatmap-cell"]');

      if (cells.length !== 30) {
        throw new Error("heatmap bench failed to mount the expected number of cells");
      }
    });
  });

  bench("progress meter mounted value scan", async () => {
    await runMountedBench(<ProgressMeter label="SLO" animate max={100} value={81} />, (container) => {
      expectBenchElement(container, '[role="meter"]', "progress meter");
      expectBenchElement(container, '[data-slot="progress-meter-value"]', "progress meter");
    });
  });

  bench("radial gauge mounted dial scan", async () => {
    await runMountedBench(<RadialGauge label="Fill rate" animate value={68} max={100} />, (container) => {
      expectBenchElement(container, '[data-slot="radial-gauge-dial"]', "radial gauge");
      expectBenchElement(container, '[data-slot="radial-gauge-ring"]', "radial gauge");
    });
  });

  bench("sparkline mounted dot scan", async () => {
    await runMountedBench(
      <Sparkline label="Trend" animate variant="line" data={benchSparklineData} />,
      (container) => {
        expectBenchElement(container, '[data-slot="sparkline-stroke"]', "sparkline");
        expectBenchCount(container, '[data-slot="sparkline-dot"]', benchSparklineData.length);
      },
    );
  });

  bench("stacked bar mounted segment scan", async () => {
    await runMountedBench(
      <StackedBarChart label="Delivery mix" animate data={benchStackedRows} />,
      (container) => {
        expectBenchCount(container, '[data-slot="stacked-bar-chart-item"]', benchStackedRows.length);
        expectBenchCount(container, '[data-slot="stacked-bar-chart-segment"]', 24);
      },
    );
  });

  bench("timeline subsystem mount", async () => {
    await runMountedBench(
      <Timeline label="Delivery plan" animate data={timelineData} />,
      (container) => {
        const items = container.querySelectorAll('[data-slot="timeline-item"]');

        if (items.length !== 12) {
          throw new Error("timeline bench failed to mount the expected milestones");
        }
      },
    );
  });

  bench("tooltip pointer flow across chart families", async () => {
    await runMountedBench(
      <>
        <AreaChart label="Orders" animate data={benchTrendData} />
        <BarChart label="Revenue" animate data={benchValueData} />
        <DonutChart label="Mix" animate data={benchDonutData} />
        <FlameGraph label="Request flame graph" animate data={benchFlameGraphData} />
        <Heatmap label="Capacity" animate data={benchHeatmapData} />
        <LineChart label="Signups" animate data={benchTrendData} />
        <Sparkline label="Trend" animate variant="line" data={benchSparklineData} />
        <StackedBarChart label="Delivery mix" animate data={benchStackedRows} />
        <Timeline label="Delivery plan" animate data={benchTimelineData} />
      </>,
      (container) => {
        const selectors = [
          '[data-slot="area-chart-item"]',
          '[data-slot="bar-chart-item"]',
          '[data-slot="donut-chart-item"]',
          '[data-slot="flame-graph-cell"]',
          '[data-slot="heatmap-cell"]',
          '[data-slot="line-chart-item"]',
          '[data-slot="sparkline-item"]',
          '[data-slot="stacked-bar-chart-segment"]',
          '[data-slot="timeline-item"]',
        ];

        for (let index = 0; index < selectors.length; index += 1) {
          const item = expectBenchElement<HTMLElement>(
            container,
            selectors[index]!,
            "tooltip family",
          );
          dispatchPointerMove(
            item,
            { left: 80 + index, top: 20, width: 220, height: 40 },
            { clientX: 120 + index, clientY: 36 },
          );
        }
      },
    );
  });
});
