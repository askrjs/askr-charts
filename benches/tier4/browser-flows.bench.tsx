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
  benchFlameGraphData,
  benchSparklineData,
  benchStackedRows,
  benchTimelineData,
  buildHeatmapData,
  buildValueData,
  DashboardBench,
} from "../_shared/fixtures";
import {
  dispatchPointerMove,
  expectBenchCount,
  expectBenchElement,
  flushBenchUpdates,
  normalizeStyle,
  runMountedBench,
} from "../_shared/dom";

const barChartData = buildValueData(18);
const donutData = buildValueData(6);
const heatmapData = buildHeatmapData(7, 5);

describe("tier4 browser integration benches", () => {
  bench("dashboard integration mount and style read", async () => {
    await runMountedBench(<DashboardBench />, async (container) => {
      const shell = container.querySelector('[data-slot="chart-shell"]') as HTMLElement | null;
      const panel = container.querySelector('[data-slot="chart-panel"]') as HTMLElement | null;
      const barFill = container.querySelector('[data-slot="bar-chart-fill"]') as HTMLElement | null;

      if (!shell || !panel || !barFill) {
        throw new Error("dashboard browser bench failed to mount expected integration surface");
      }

      await flushBenchUpdates();
      void getComputedStyle(shell).display;
      void getComputedStyle(panel).paddingInlineStart;
      void getComputedStyle(barFill).minInlineSize;
    });
  });

  bench("bar chart tooltip pointer flow", async () => {
    await runMountedBench(
      <BarChart label="Revenue" animate data={barChartData} />,
      async (container) => {
        const item = container.querySelector('[data-slot="bar-chart-item"]') as HTMLElement | null;

        if (!item) {
          throw new Error("browser tooltip bench failed to mount a bar chart item");
        }

        dispatchPointerMove(
          item,
          { left: 80, top: 20, width: 240, height: 44 },
          { clientX: 140, clientY: 38 },
        );
        await flushBenchUpdates();

        const style = normalizeStyle(item.getAttribute("style"));
        if (!style.includes("--ak-chart-tooltip-anchor-x:60px")) {
          throw new Error("browser tooltip bench failed to update tooltip anchor x");
        }
      },
    );
  });

  bench("progress meter browser aria scan", async () => {
    await runMountedBench(
      <ProgressMeter label="SLO" animate max={100} value={81} />,
      async (container) => {
        const meter = expectBenchElement<HTMLElement>(container, '[role="meter"]', "progress meter");

        await flushBenchUpdates();
        if (meter.getAttribute("aria-valuetext") !== "81%") {
          throw new Error("browser progress meter bench failed to expose meter value text");
        }
      },
    );
  });

  bench("donut segment interaction and style scan", async () => {
    await runMountedBench(
      <DonutChart label="Mix" animate data={donutData} />,
      async (container) => {
        const segment = container.querySelector(
          '[data-slot="donut-chart-segment"]',
        ) as HTMLElement | null;

        if (!segment) {
          throw new Error("browser donut bench failed to mount a segment");
        }

        segment.focus();
        await flushBenchUpdates();
        void getComputedStyle(segment).clipPath;
      },
    );
  });

  bench("radial gauge browser style scan", async () => {
    await runMountedBench(
      <RadialGauge label="Fill rate" animate value={68} max={100} />,
      async (container) => {
        const dial = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="radial-gauge-dial"]',
          "radial gauge",
        );

        await flushBenchUpdates();
        void getComputedStyle(dial).inlineSize;
      },
    );
  });

  bench("heatmap browser cell scan", async () => {
    await runMountedBench(
      <Heatmap label="Capacity" animate data={heatmapData} />,
      async (container) => {
        const firstCell = container.querySelector(
          '[data-slot="heatmap-cell"]',
        ) as HTMLElement | null;
        const cells = container.querySelectorAll('[data-slot="heatmap-cell"]');

        if (!firstCell || cells.length !== 35) {
          throw new Error("browser heatmap bench failed to mount expected cells");
        }

        await flushBenchUpdates();
        void getComputedStyle(firstCell).backgroundColor;
      },
    );
  });

  bench("trend chart browser point scan", async () => {
    await runMountedBench(
      <>
        <AreaChart label="Orders" animate data={barChartData} />
        <LineChart label="Signups" animate data={barChartData} />
      </>,
      async (container) => {
        const areaItem = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="area-chart-item"]',
          "area chart",
        );
        const lineItem = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="line-chart-item"]',
          "line chart",
        );

        await flushBenchUpdates();
        void getComputedStyle(areaItem).minBlockSize;
        void getComputedStyle(lineItem).minBlockSize;
      },
    );
  });

  bench("sparkline browser line scan", async () => {
    await runMountedBench(
      <Sparkline label="Trend" animate variant="line" data={benchSparklineData} />,
      async (container) => {
        const stroke = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="sparkline-stroke"]',
          "sparkline",
        );
        expectBenchCount(container, '[data-slot="sparkline-dot"]', benchSparklineData.length);

        await flushBenchUpdates();
        void getComputedStyle(stroke).clipPath;
      },
    );
  });

  bench("flame graph browser cell style scan", async () => {
    await runMountedBench(
      <FlameGraph label="Request flame graph" animate data={benchFlameGraphData} />,
      async (container) => {
        const cell = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="flame-graph-cell"]',
          "flame graph",
        );
        expectBenchCount(container, '[data-slot="flame-graph-row"]', 3);

        await flushBenchUpdates();
        void getComputedStyle(cell).inlineSize;
      },
    );
  });

  bench("stacked bar browser segment scan", async () => {
    await runMountedBench(
      <StackedBarChart label="Delivery mix" animate data={benchStackedRows} />,
      async (container) => {
        const segment = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="stacked-bar-chart-segment"]',
          "stacked bar",
        );
        expectBenchCount(container, '[data-slot="stacked-bar-chart-item"]', benchStackedRows.length);

        await flushBenchUpdates();
        void getComputedStyle(segment).inlineSize;
      },
    );
  });

  bench("timeline browser focus scan", async () => {
    await runMountedBench(
      <Timeline label="Delivery plan" animate data={benchTimelineData} />,
      async (container) => {
        const item = expectBenchElement<HTMLElement>(
          container,
          '[data-slot="timeline-item"]',
          "timeline",
        );
        expectBenchCount(container, '[data-slot="timeline-item"]', benchTimelineData.length);

        item.focus();
        await flushBenchUpdates();
        void getComputedStyle(item).outlineColor;
      },
    );
  });
});
