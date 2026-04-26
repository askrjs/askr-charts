import {
  buildHeatmapSummary,
  getAnimationDataAttrs,
  getAnimationStyle,
  normalizeAnimation,
  buildValueChartSummary,
  type ChartAnimation,
  type ChartAnimationDefaults,
  type ChartValueFormatter,
  type NormalizedChartAnimation,
  type NormalizedHeatmapDatum,
  type NormalizedValueChartDatum,
} from "../../core";

export type ChartStyleValue = string | number | undefined;

export type ChartStyle = Record<string, ChartStyleValue>;

export type ChartStyleInput = string | ChartStyle | undefined;

function serializeChartStyle(style: ChartStyleInput): string {
  if (typeof style === "string") {
    return style.trim();
  }

  if (style && typeof style === "object") {
    return Object.entries(style)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${String(value)}`)
      .join(";");
  }

  return "";
}

export function mergeChartStyles(base: ChartStyle, incoming?: ChartStyleInput): string {
  const baseCss = serializeChartStyle(base);
  const incomingCss = serializeChartStyle(incoming);

  if (!incomingCss) {
    return baseCss;
  }

  if (!baseCss) {
    return incomingCss;
  }

  return `${baseCss};${incomingCss}`;
}

export function createChartId(prefix: string, value: string): string {
  const slug =
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "chart";

  return `${prefix}-${slug}`;
}

export function getValueChartSummary(
  label: string,
  data: readonly NormalizedValueChartDatum[],
  max: number,
  summary?: string,
): string {
  return summary ?? buildValueChartSummary(label, data, max);
}

export function getHeatmapSummary(
  label: string,
  cells: readonly NormalizedHeatmapDatum[],
  max: number,
  summary?: string,
): string {
  return summary ?? buildHeatmapSummary(label, cells, max);
}

export function resolveValueFormatter(
  formatter?: ChartValueFormatter,
): ChartValueFormatter | undefined {
  return formatter;
}

export function resolveChartAnimation(
  animate: boolean | undefined,
  animation: ChartAnimation | undefined,
  defaults: Partial<ChartAnimationDefaults>,
): {
  animation: NormalizedChartAnimation;
  animationAttrs: Record<string, string>;
  animationStyle: ChartStyle;
} {
  const resolvedAnimation = normalizeAnimation(animation ?? animate, defaults);

  return {
    animation: resolvedAnimation,
    animationAttrs: getAnimationDataAttrs(resolvedAnimation),
    animationStyle: getAnimationStyle(resolvedAnimation),
  };
}
