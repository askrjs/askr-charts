import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";
import { renderToStringSync } from "@askrjs/askr/ssr";

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
} from "../src/components";

function renderChart(render: () => unknown): string {
  return renderToStringSync(() => render());
}

function listCssFiles(dir: string): string[] {
  function collect(currentDir: string): string[] {
    return readdirSync(currentDir, { withFileTypes: true }).flatMap((entry: Dirent) => {
      const entryPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return collect(entryPath);
      }

      return entry.name.endsWith(".css") ? [entryPath] : [];
    });
  }

  return collect(dir).sort();
}

describe("chart components", () => {
  it("renders a bar chart with semantic root hooks and fallback content", () => {
    const html = renderChart(() =>
      BarChart({
        label: "Monthly revenue",
        data: [
          { label: "Jan", value: 42 },
          { label: "Feb", value: 18 },
        ],
        animate: true,
      }),
    );

    expect(html).toContain('data-slot="bar-chart"');
    expect(html).toContain('data-ak-animate="true"');
    expect(html).toContain('data-ak-animation="grow"');
    expect(html).toContain("--ak-chart-animation-duration:300ms");
    expect(html).toContain("ak-bar-chart");
    expect(html).toContain("--ak-chart-item-index:0");
  });

  it("renders line and area charts with point series hooks", () => {
    const line = renderChart(() =>
      LineChart({
        label: "Weekly signups",
        data: [
          { label: "Mon", value: 12 },
          { label: "Tue", value: 18 },
        ],
        animate: true,
      }),
    );
    const area = renderChart(() =>
      AreaChart({
        label: "Weekly orders",
        data: [
          { label: "Mon", value: 20 },
          { label: "Tue", value: 26 },
        ],
        animate: true,
      }),
    );

    expect(line).toContain('data-slot="line-chart"');
    expect(line).toContain('data-ak-animation="fade"');
    expect(line).toContain("--ak-chart-item-index:0");
    expect(line).toContain("--ak-chart-item-value:");
    expect(area).toContain('data-slot="area-chart"');
    expect(area).toContain('data-ak-animation="grow"');
    expect(area).toContain("--ak-chart-item-index:0");
  });

  it("renders reveal animation wrappers for line and area charts", () => {
    const line = renderChart(() =>
      LineChart({
        label: "Weekly signups",
        data: [
          { label: "Mon", value: 12 },
          { label: "Tue", value: 18 },
        ],
        animate: true,
        animation: { type: "reveal" },
      }),
    );
    const area = renderChart(() =>
      AreaChart({
        label: "Weekly orders",
        data: [
          { label: "Mon", value: 20 },
          { label: "Tue", value: 26 },
        ],
        animate: true,
        animation: { type: "reveal" },
      }),
    );

    expect(line).toContain('data-ak-animation="reveal"');
    expect(line).toContain('data-slot="line-chart-stroke-wrap"');
    expect(line).toContain('data-slot="line-chart-stroke"');
    expect(area).toContain('data-ak-animation="reveal"');
    expect(area).toContain('data-slot="area-chart-surface-wrap"');
    expect(area).toContain('data-slot="area-chart-surface"');
  });

  it("accepts tuple chart data and explicit minimum scales", () => {
    const bar = renderChart(() =>
      BarChart({
        label: "Monthly revenue",
        data: [
          ["Jan", 20],
          ["Feb", 40],
        ],
        min: 20,
        max: 40,
      }),
    );
    const heatmap = renderChart(() =>
      Heatmap({
        label: "Activity heatmap",
        data: [
          ["Mon", "Week 1", 2],
          ["Tue", "Week 1", 8],
        ],
        min: 2,
        max: 8,
      }),
    );

    expect(bar).toContain("--ak-chart-item-value:0%");
    expect(bar).toContain("--ak-chart-item-value:100%");
    expect(heatmap).toContain("Mon");
    expect(heatmap).toContain("Tue");
  });

  it("uses chart-specific default animation types when animate is enabled", () => {
    const donut = renderChart(() =>
      DonutChart({ label: "Traffic split", data: [{ label: "Direct", value: 50 }], animate: true }),
    );
    const flameGraph = renderChart(() =>
      FlameGraph({
        label: "Call stack",
        data: [{ label: "render", value: 100, children: [{ label: "load", value: 40 }] }],
        animate: true,
      }),
    );
    const heatmap = renderChart(() =>
      Heatmap({ label: "Activity", data: [{ x: "Mon", y: "Week 1", value: 1 }], animate: true }),
    );
    const progress = renderChart(() =>
      ProgressMeter({ label: "Quota", value: 48, max: 80, animate: true }),
    );
    const sparkline = renderChart(() =>
      Sparkline({ label: "Trend", data: [{ label: "Mon", value: 8 }], animate: true }),
    );
    const stacked = renderChart(() =>
      StackedBarChart({
        label: "Pipeline mix",
        data: [{ label: "Q1", segments: [{ label: "Open", value: 12 }] }],
        animate: true,
      }),
    );
    const timeline = renderChart(() =>
      Timeline({ label: "Roadmap", data: [{ label: "Alpha" }], animate: true }),
    );

    expect(donut).toContain('data-ak-animation="sweep"');
    expect(flameGraph).toContain('data-ak-animation="grow"');
    expect(heatmap).toContain('data-ak-animation="fade"');
    expect(progress).toContain('data-ak-animation="grow"');
    expect(sparkline).toContain('data-ak-animation="fade"');
    expect(stacked).toContain('data-ak-animation="grow"');
    expect(timeline).toContain('data-ak-animation="slide"');
  });

  it("lets structured animation override defaults and disable animation", () => {
    const chart = renderChart(() =>
      Heatmap({
        label: "Activity heatmap",
        data: [{ x: "Mon", y: "Week 1", value: 8 }],
        animate: true,
        animation: {
          type: "scale",
          duration: 200,
          delay: 4,
          stagger: 2,
          easing: "linear",
        },
      }),
    );
    const disabled = renderChart(() =>
      ProgressMeter({ label: "Quota progress", value: 1, animation: { type: "none" } }),
    );

    expect(chart).toContain('data-ak-animate="true"');
    expect(chart).toContain('data-ak-animation="scale"');
    expect(chart).toContain("--ak-chart-animation-duration:200ms");
    expect(chart).toContain("--ak-chart-animation-delay:4ms");
    expect(chart).toContain("--ak-chart-animation-stagger:2ms");
    expect(chart).toContain("--ak-chart-animation-easing:linear");
    expect(disabled).toContain('data-ak-animate="false"');
    expect(disabled).toContain('data-ak-animation="none"');
  });

  it("renders a donut chart with CSS-variable gradient stops", () => {
    const html = renderChart(() =>
      DonutChart({
        label: "Traffic split",
        data: [
          { label: "Direct", value: 50 },
          { label: "Referral", value: 50 },
        ],
        valueFormatter: (value) => `${value}%`,
      }),
    );

    expect(html).toContain('data-slot="donut-chart"');
    expect(html).toContain("--ak-chart-donut-stops:");
    expect(html).toContain("deg");
    expect(html).toContain('class="ak-donut-chart-total-value">100%</strong>');
    expect(html).toContain("Scale max is 100%");
  });

  it("renders a flame graph with positioned frame spans", () => {
    const html = renderChart(() =>
      FlameGraph({
        label: "Call stack",
        animate: true,
        data: [
          {
            label: "renderApp",
            value: 100,
            children: [
              { label: "loadRoute", value: 40 },
              { label: "renderPage", value: 60 },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('data-slot="flame-graph"');
    expect(html).toContain('data-ak-animation="grow"');
    expect(html).toContain("--ak-chart-item-offset:0%");
    expect(html).toContain("--ak-chart-item-value:100%");
    expect(html).toContain('data-slot="flame-graph-cell"');
  });

  it("renders a heatmap with CSS variable grid sizing", () => {
    const html = renderChart(() =>
      Heatmap({
        label: "Activity heatmap",
        data: [
          { x: "Mon", y: "Week 1", value: 8 },
          { x: "Tue", y: "Week 1", value: 4 },
        ],
      }),
    );

    expect(html).toContain('data-slot="heatmap"');
    expect(html).toContain("--ak-heatmap-columns:2");
  });

  it("renders a progress meter with semantic meter attributes", () => {
    const chart = ProgressMeter({
      label: "Quota progress",
      value: 48,
      max: 80,
    }) as { props: Record<string, unknown> };

    expect(chart.props["data-slot"]).toBe("progress-meter");
    expect(String(chart.props.style)).toContain("--ak-chart-item-value:60%");
  });

  it("renders a radial gauge with a conic progress dial", () => {
    const html = renderChart(() =>
      RadialGauge({
        label: "Fill rate",
        value: 68,
        max: 100,
      }),
    );

    expect(html).toContain('data-slot="radial-gauge"');
    expect(html).toContain("--ak-chart-gauge-angle:244.8deg");
    expect(html).toContain("Fill rate");
  });

  it("wires semantic chart variants and grid toggles through the rendered markup", () => {
    const html = [
      renderChart(() => ProgressMeter({ label: "Quota", value: 48, max: 80, variant: "success" })),
      renderChart(() =>
        RadialGauge({ label: "Fill rate", value: 68, max: 100, variant: "danger" }),
      ),
      renderChart(() =>
        Timeline({ label: "Release timeline", data: [{ label: "Alpha", status: "info" }] }),
      ),
      renderChart(() =>
        LineChart({ label: "Trend", data: [{ label: "Mon", value: 12 }], showGrid: true }),
      ),
      renderChart(() =>
        AreaChart({ label: "Orders", data: [{ label: "Mon", value: 12 }], showGrid: true }),
      ),
    ].join("");

    expect(html).toContain('data-ak-variant="success"');
    expect(html).toContain('data-ak-variant="danger"');
    expect(html).toContain('data-ak-status="info"');
    expect(html).toContain('data-ak-show-grid="true"');
    expect(html).toContain("--ak-chart-item-color:var(--ak-chart-color-success)");
    expect(html).toContain("--ak-chart-item-color:var(--ak-chart-color-danger)");
    expect(html).toContain("--ak-chart-item-color:var(--ak-chart-color-info)");
  });

  it("keeps the phase 3 visual polish hooks in the default chart styles", () => {
    const displayRoot = join(__dirname, "..", "src", "charts", "default", "styles", "display");
    const barCss = readFileSync(join(displayRoot, "bar-chart.css"), "utf8");
    const stackedBarCss = readFileSync(join(displayRoot, "stacked-bar-chart.css"), "utf8");
    const progressCss = readFileSync(join(displayRoot, "progress-meter.css"), "utf8");
    const areaCss = readFileSync(join(displayRoot, "area-chart.css"), "utf8");
    const lineCss = readFileSync(join(displayRoot, "line-chart.css"), "utf8");
    const heatmapCss = readFileSync(join(displayRoot, "heatmap.css"), "utf8");
    const tooltipCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "overlays", "tooltip.css"),
      "utf8",
    );

    expect(barCss).toContain("linear-gradient(");
    expect(barCss).toContain("brightness(1.08)");
    expect(stackedBarCss).toContain("linear-gradient(");
    expect(stackedBarCss).toContain("brightness(1.1)");
    expect(stackedBarCss).toContain("--ak-chart-row-value");
    expect(progressCss).toContain("linear-gradient(");
    expect(areaCss).toContain("52%, transparent");
    expect(areaCss).toContain("repeating-linear-gradient");
    expect(lineCss).toContain('data-ak-show-grid="true"');
    expect(heatmapCss).toContain("saturate(1.1)");
    expect(heatmapCss).toContain("outline: 2px solid");
    expect(tooltipCss).toContain("--ak-chart-tooltip-anchor-x");
    expect(tooltipCss).toContain("inset-inline-start: var(--ak-chart-tooltip-anchor-x");
  });

  it("keeps the phase 9 typography polish hooks in the shared styles", () => {
    const baseRoot = join(__dirname, "..", "src", "charts", "default", "styles", "base");
    const typographyCss = readFileSync(join(baseRoot, "typography.css"), "utf8");
    const legendCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "styles", "display", "legend.css"),
      "utf8",
    );
    const tokensCss = readFileSync(
      join(__dirname, "..", "src", "charts", "default", "tokens.css"),
      "utf8",
    );

    expect(tokensCss).toContain("--ak-chart-font-family-heading");
    expect(tokensCss).toContain("--ak-chart-font-weight-semibold");
    expect(typographyCss).toContain("font-family: var(--ak-chart-font-family-heading)");
    expect(typographyCss).toContain("text-wrap: balance");
    expect(typographyCss).toContain("font-variant-numeric: tabular-nums");
    expect(legendCss).toContain("font-weight: 600");
    expect(legendCss).toContain("font-variant-numeric: tabular-nums");
    expect(legendCss).toContain("color: var(--ak-chart-color-text)");
  });

  it("keeps display styles self-sufficient on chart-owned tokens", () => {
    const root = join(__dirname, "..");
    const styleFiles = [
      ...listCssFiles(join(root, "src", "charts", "default", "styles")),
      ...listCssFiles(join(root, "templates", "chart", "styles")),
    ];
    const forbiddenThemeToken = /--ak-(?:color|radius|duration|ease|z)-/;

    for (const file of styleFiles) {
      const css = readFileSync(file, "utf8");
      expect(css, `${file} should use --ak-chart-* tokens in display styles`).not.toMatch(
        forbiddenThemeToken,
      );
    }

    const tokensCss = readFileSync(join(root, "src", "charts", "default", "tokens.css"), "utf8");
    expect(tokensCss).toContain("var(--ak-color-accent, #2563eb)");
    expect(tokensCss).toContain("--ak-chart-focus-ring");
    expect(tokensCss).toContain("--ak-chart-tooltip-border");
  });

  it("renders zero values truthfully without forcing non-zero sizes", () => {
    const bar = renderChart(() =>
      BarChart({
        label: "Zero revenue",
        data: [{ label: "Jan", value: 0 }],
      }),
    );
    const sparkline = renderChart(() =>
      Sparkline({
        label: "Zero trend",
        data: [{ label: "Mon", value: 0 }],
      }),
    );
    const stacked = renderChart(() =>
      StackedBarChart({
        label: "Zero pipeline",
        data: [{ label: "Q1", segments: [{ label: "Open", value: 0 }] }],
      }),
    );
    const progress = ProgressMeter({
      label: "Zero quota",
      value: 0,
      max: 80,
    }) as { props: Record<string, unknown> };

    expect(bar).toContain("--ak-chart-item-value:0%");
    expect(bar).toContain("--ak-chart-item-min-size:0");
    expect(sparkline).toContain("--ak-chart-item-value:0%");
    expect(sparkline).toContain("--ak-chart-item-min-block-size:0");
    expect(stacked).toContain("--ak-chart-item-value:0%");
    expect(stacked).toContain("--ak-chart-item-min-size:0");
    expect(String(progress.props.style)).toContain("--ak-chart-item-value:0%");
    expect(String(progress.props.style)).toContain("--ak-chart-item-min-size:0");
  });

  it("renders a sparkline with column layout points", () => {
    const html = renderChart(() =>
      Sparkline({
        label: "Response time trend",
        data: [
          { label: "Mon", value: 8 },
          { label: "Tue", value: 4 },
        ],
      }),
    );

    expect(html).toContain('data-slot="sparkline"');
  });

  it("renders a sparkline line variant with stroke overlay and floating dots", () => {
    const html = renderChart(() =>
      Sparkline({
        label: "Response time trend",
        data: [
          { label: "Mon", value: 8 },
          { label: "Tue", value: 4 },
          { label: "Wed", value: 6 },
        ],
        variant: "line",
      }),
    );

    expect(html).toContain('data-ak-variant="line"');
    expect(html).toContain('data-slot="sparkline-stroke"');
    expect(html).toContain('data-slot="sparkline-dot"');
    expect(html).not.toContain('data-slot="sparkline-stem"');
    expect(html).toContain("--ak-sparkline-polygon:");
  });

  it("renders a stacked bar chart with stacked segments", () => {
    const html = renderChart(() =>
      StackedBarChart({
        label: "Pipeline mix",
        data: [
          {
            label: "Q1",
            segments: [
              { label: "Open", value: 12 },
              { label: "Won", value: 9 },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('data-slot="stacked-bar-chart"');
    expect(html).toContain('data-slot="stacked-bar-chart-stack"');
  });

  it("scales stacked bar rows against the shared scale while preserving composition", () => {
    const html = renderChart(() =>
      StackedBarChart({
        label: "Pipeline mix",
        data: [
          {
            label: "Q1",
            segments: [
              { label: "Open", value: 12 },
              { label: "Won", value: 8 },
            ],
          },
          {
            label: "Q2",
            segments: [
              { label: "Open", value: 3 },
              { label: "Won", value: 2 },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("--ak-chart-row-value:100%");
    expect(html).toContain("--ak-chart-row-value:25%");
    expect(html).toContain("--ak-chart-item-value:60%");
    expect(html).toContain("--ak-chart-item-value:40%");
  });

  it("clamps stacked bar row width when explicit max is smaller than the total", () => {
    const html = renderChart(() =>
      StackedBarChart({
        label: "Pipeline mix",
        max: 10,
        data: [
          {
            label: "Q1",
            segments: [
              { label: "Open", value: 15 },
              { label: "Won", value: 5 },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("--ak-chart-row-value:100%");
    expect(html).toContain("--ak-chart-item-value:75%");
    expect(html).toContain("--ak-chart-item-value:25%");
    expect(html).not.toContain("--ak-chart-row-value:200%");
  });

  it("renders a timeline with semantic item hooks", () => {
    const html = renderChart(() =>
      Timeline({
        label: "Release timeline",
        data: [
          { label: "Alpha", value: "Jan" },
          { label: "Beta", value: "Feb" },
        ],
      }),
    );

    expect(html).toContain('data-slot="timeline"');
  });

  it("emits label density controls on visible-label charts", () => {
    const bar = renderChart(() =>
      BarChart({
        label: "Monthly revenue",
        data: [{ label: "Jan", value: 42 }],
        labelDensity: "minimal",
      }),
    );
    const timeline = renderChart(() =>
      Timeline({
        label: "Release timeline",
        data: [{ label: "Alpha", value: "Jan", description: "Initial release" }],
        labelDensity: "compact",
      }),
    );

    expect(bar).toContain('data-ak-label-density="minimal"');
    expect(timeline).toContain('data-ak-label-density="compact"');
  });
});
