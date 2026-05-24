import { bench, describe } from "vite-plus/test";

import { BarChart, DonutChart, Heatmap } from "../../src/components";
import { buildHeatmapData, buildValueData, DashboardBench } from "../_shared/fixtures";
import {
  dispatchPointerMove,
  flushBenchUpdates,
  normalizeStyle,
  runMountedBench,
} from "../_shared/dom";

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
      <BarChart label="Revenue" animate data={buildValueData(18)} />,
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

  bench("donut segment interaction and style scan", async () => {
    await runMountedBench(
      <DonutChart label="Mix" animate data={buildValueData(6)} />,
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

  bench("heatmap browser cell scan", async () => {
    await runMountedBench(
      <Heatmap label="Capacity" animate data={buildHeatmapData(7, 5)} />,
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
});
