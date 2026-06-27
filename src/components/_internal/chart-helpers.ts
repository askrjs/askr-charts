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
    let css = "";

    for (const key in style) {
      if (!Object.prototype.hasOwnProperty.call(style, key)) {
        continue;
      }

      const value = style[key];
      if (value === undefined) {
        continue;
      }

      const declaration = `${key}:${String(value)}`;
      css = css ? `${css};${declaration}` : declaration;
    }

    return css;
  }

  return "";
}

export function mergeChartStyles(base: ChartStyle, incoming?: ChartStyleInput): string {
  const baseCss = serializeChartStyle(base);

  if (incoming === undefined) {
    return baseCss;
  }

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
const CHART_TOOLTIP_ANCHOR_X_VAR = "--ak-chart-tooltip-anchor-x";
const CHART_TOOLTIP_ANCHOR_Y_VAR = "--ak-chart-tooltip-anchor-y";
const EXTERNAL_TOOLTIP_SLOTS = new Set(["donut-chart-segment"]);

function getChartTooltipTrigger(event: Event): HTMLElement | null {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }

  return event.target.closest(CHART_TOOLTIP_TRIGGER_SELECTOR) as HTMLElement | null;
}

function getExternalChartTooltipAnchorTarget(trigger: HTMLElement): HTMLElement | null {
  const slot = trigger.getAttribute("data-slot");

  if (!slot || !EXTERNAL_TOOLTIP_SLOTS.has(slot)) {
    return null;
  }

  return trigger.parentElement instanceof HTMLElement ? trigger.parentElement : null;
}

function setChartTooltipAnchor(trigger: HTMLElement, x: string, y: string): void {
  trigger.style.setProperty(CHART_TOOLTIP_ANCHOR_X_VAR, x);
  trigger.style.setProperty(CHART_TOOLTIP_ANCHOR_Y_VAR, y);

  const externalTarget = getExternalChartTooltipAnchorTarget(trigger);
  if (externalTarget) {
    externalTarget.style.setProperty(CHART_TOOLTIP_ANCHOR_X_VAR, x);
    externalTarget.style.setProperty(CHART_TOOLTIP_ANCHOR_Y_VAR, y);
  }
}

function centerChartTooltip(event: Event): void {
  const trigger = getChartTooltipTrigger(event);
  if (!trigger) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  setChartTooltipAnchor(trigger, `${Math.max(0, rect.width / 2)}px`, "0px");
}

function positionChartTooltip(event: Event): void {
  const trigger = getChartTooltipTrigger(event);
  if (!trigger || !("clientX" in event)) {
    return;
  }

  const pointerEvent = event as PointerEvent;
  const rect = trigger.getBoundingClientRect();
  const rawX =
    typeof pointerEvent.clientX === "number" && Number.isFinite(pointerEvent.clientX)
      ? pointerEvent.clientX - rect.left
      : rect.width / 2;
  const rawY =
    typeof pointerEvent.clientY === "number" && Number.isFinite(pointerEvent.clientY)
      ? pointerEvent.clientY - rect.top
      : 0;
  const x = Math.min(Math.max(rawX, 0), Math.max(rect.width, 0));
  const y = Math.min(Math.max(rawY, 0), Math.max(rect.height, 0));

  setChartTooltipAnchor(trigger, `${x}px`, `${y}px`);
}

export const chartTooltipTriggerProps = {
  onPointerEnter: positionChartTooltip,
  onPointerOver: positionChartTooltip,
  onPointerMove: positionChartTooltip,
  onFocusIn: centerChartTooltip,
} as const;

function mergeChartEventHandlers(left: unknown, right: unknown): unknown {
  if (typeof left !== "function" || typeof right !== "function") {
    return right ?? left;
  }

  return (event: Event) => {
    left(event);
    right(event);
  };
}

export function mergeChartProps(
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("on") && key in merged) {
        merged[key] = mergeChartEventHandlers(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
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
  valueFormatter?: ChartValueFormatter,
): string {
  return summary ?? buildValueChartSummary(label, data, max, valueFormatter);
}

export function getHeatmapSummary(
  label: string,
  cells: readonly NormalizedHeatmapDatum[],
  max: number,
  summary?: string,
  valueFormatter?: ChartValueFormatter,
): string {
  return summary ?? buildHeatmapSummary(label, cells, max, valueFormatter);
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
