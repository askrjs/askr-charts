import { bench, describe } from "vite-plus/test";

import { BarChart, Heatmap, Timeline } from "../../src/components";
import {
  buildHeatmapData,
  buildTimelineData,
  buildValueData,
  DashboardBench,
} from "../_shared/fixtures";
import { dispatchPointerMove, normalizeStyle, runMountedBench } from "../_shared/dom";

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
    await runMountedBench(
      <BarChart label="Revenue" animate data={buildValueData(16)} />,
      (container) => {
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
      },
    );
  });

  bench("heatmap mount and scan", async () => {
    await runMountedBench(
      <Heatmap label="Capacity" animate data={buildHeatmapData(6, 5)} />,
      (container) => {
        const cells = container.querySelectorAll('[data-slot="heatmap-cell"]');

        if (cells.length !== 30) {
          throw new Error("heatmap bench failed to mount the expected number of cells");
        }
      },
    );
  });

  bench("timeline subsystem mount", async () => {
    await runMountedBench(
      <Timeline label="Delivery plan" animate data={buildTimelineData(12)} />,
      (container) => {
        const items = container.querySelectorAll('[data-slot="timeline-item"]');

        if (items.length !== 12) {
          throw new Error("timeline bench failed to mount the expected milestones");
        }
      },
    );
  });
});
