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

const CHART_TOOLTIP_TRIGGER_SELECTOR = '[data-ak-chart-tooltip-trigger="true"]';
const CHART_TOOLTIP_X_VAR = "--ak-chart-tooltip-x";
const CHART_TOOLTIP_Y_VAR = "--ak-chart-tooltip-y";
const CHART_TOOLTIP_MARGIN = 12;
const CHART_TOOLTIP_OFFSET = 14;

function getChartTooltipTrigger(event: Event): HTMLElement | null {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }

  return event.target.closest(CHART_TOOLTIP_TRIGGER_SELECTOR) as HTMLElement | null;
}

function centerChartTooltip(event: Event): void {
  const trigger = getChartTooltipTrigger(event);
  if (!trigger) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  const x = Math.min(
    Math.max(rect.left + rect.width / 2, CHART_TOOLTIP_MARGIN),
    window.innerWidth - CHART_TOOLTIP_MARGIN,
  );
  const y = Math.max(rect.top, CHART_TOOLTIP_MARGIN + CHART_TOOLTIP_OFFSET);

  trigger.style.setProperty(CHART_TOOLTIP_X_VAR, `${x}px`);
  trigger.style.setProperty(CHART_TOOLTIP_Y_VAR, `${y}px`);
}

function positionChartTooltip(event: Event): void {
  const trigger = getChartTooltipTrigger(event);
  if (!trigger || !("clientX" in event)) {
    return;
  }

  const pointerEvent = event as PointerEvent;
  const x = Math.min(
    Math.max(pointerEvent.clientX, CHART_TOOLTIP_MARGIN),
    window.innerWidth - CHART_TOOLTIP_MARGIN,
  );
  const y =
    typeof pointerEvent.clientY === "number" && Number.isFinite(pointerEvent.clientY)
      ? Math.max(pointerEvent.clientY - CHART_TOOLTIP_OFFSET, CHART_TOOLTIP_MARGIN)
      : Math.max(trigger.getBoundingClientRect().top, CHART_TOOLTIP_MARGIN + CHART_TOOLTIP_OFFSET);

  trigger.style.setProperty(CHART_TOOLTIP_X_VAR, `${x}px`);
  trigger.style.setProperty(CHART_TOOLTIP_Y_VAR, `${y}px`);
}

export const chartTooltipTriggerProps = {
  onPointerEnter: positionChartTooltip,
  onPointerOver: positionChartTooltip,
  onPointerMove: positionChartTooltip,
  onFocusIn: centerChartTooltip,
} as const;

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
