import type { PlotDescriptor } from "../descriptors";
import type { AxisProps, ScaleDomainValue, ScaleValue } from "../model";
import { isFiniteNumber } from "../transforms";
import type { ResolvedScale } from "../scales";
import type {
  SceneAxis,
  SceneGrid,
  SceneInteractions,
  SceneLegend,
  SceneTick,
} from "../scene-model";
import { MARK_KINDS, channelSeries, isConstant, type ScaleUse } from "./shared";
import { isColorScale, scaleChannel } from "./scales";

export function resolveAxes(
  descriptors: readonly PlotDescriptor[],
  scales: Readonly<Record<string, ResolvedScale>>,
  uses: ReadonlyMap<string, ScaleUse>,
  cartesian: boolean,
  locale = "en-US",
): SceneAxis[] {
  const explicit = descriptors.filter((descriptor) => descriptor.kind === "Axis");
  const specs: AxisProps[] =
    explicit.length > 0
      ? explicit.map((descriptor) => descriptor.props as AxisProps)
      : cartesian
        ? (["x", "y"] as const).flatMap((axis): AxisProps[] => {
            const scale = [...uses.values()].find(
              (use) => use.channel === axis && scales[use.name] != null,
            );
            return scale
              ? [
                  {
                    axis,
                    scale: scale.name,
                    orient: axis === "x" ? "bottom" : "left",
                  },
                ]
              : [];
          })
        : [];
  const result: SceneAxis[] = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index]!;
    validateAxisSpec(spec);
    const scaleName =
      spec.scale ?? spec.axis ?? (spec.orient === "left" || spec.orient === "right" ? "y" : "x");
    const scale = scales[scaleName];
    if (!scale) {
      if (explicit.length > 0) throw new Error(`Axis references unknown scale ${scaleName}.`);
      continue;
    }
    if (isColorScale(scale)) {
      throw new TypeError(`Axis cannot use color scale ${scaleName}.`);
    }
    const declaredChannel = scaleChannel(descriptors, uses, scaleName);
    const axisChannel = spec.axis ?? declaredChannel ?? (scaleName === "y" ? "y" : "x");
    if (declaredChannel && spec.axis && declaredChannel !== spec.axis) {
      throw new TypeError(
        `Axis ${spec.axis} cannot use ${declaredChannel}-channel scale ${scaleName}.`,
      );
    }
    const orientation = spec.orient ?? (axisChannel === "y" ? "left" : "bottom");
    if (
      (axisChannel === "x" && (orientation === "left" || orientation === "right")) ||
      (axisChannel === "y" && (orientation === "top" || orientation === "bottom"))
    ) {
      throw new TypeError(
        `Axis for ${axisChannel}-channel scale ${scaleName} cannot use ${orientation} orientation.`,
      );
    }
    const horizontal = orientation === "top" || orientation === "bottom";
    const numericRange = scale.range.filter((value): value is number => typeof value === "number");
    const rangeSpan =
      numericRange.length > 1
        ? Math.abs(numericRange[numericRange.length - 1]! - numericRange[0]!)
        : 320;
    const adaptiveTickCount = Math.max(2, Math.round(rangeSpan / (horizontal ? 80 : 48)));
    const rawTicks = scale.ticks(spec.tickCount ?? adaptiveTickCount);
    const tickValues = collisionAwareTickValues(rawTicks, scale, horizontal, rangeSpan);
    const ticks: SceneTick[] = [];
    for (const value of tickValues) {
      if (typeof value === "boolean") continue;
      const mapped = scale.map(value);
      if (typeof mapped !== "number" || !Number.isFinite(mapped)) continue;
      const rawLabel = spec.tickFormat?.(value) ?? formatTick(value, locale, scale);
      const available = horizontal ? Math.max(24, rangeSpan / Math.max(1, tickValues.length)) : 120;
      ticks.push(
        Object.freeze({
          value,
          position: mapped + (scale.bandwidth ?? 0) / 2,
          label: ellipsizeTick(rawLabel, available),
        }),
      );
    }
    result.push(
      Object.freeze({
        id: `axis-${scaleName}-${orientation}-${index}`,
        scale: scaleName,
        orientation,
        label: spec.label ?? null,
        ticks: Object.freeze(ticks),
        grid: spec.grid ?? false,
      }),
    );
  }
  return result;
}

function collisionAwareTickValues(
  values: readonly ScaleDomainValue[],
  scale: ResolvedScale,
  horizontal: boolean,
  rangeSpan: number,
): readonly ScaleDomainValue[] {
  if (!horizontal || (scale.type !== "band" && scale.type !== "point") || values.length <= 2)
    return values;
  const spacing = rangeSpan / Math.max(1, values.length - 1);
  const widest = Math.max(...values.map((value) => String(value).length * 7 + 12));
  const step = Math.max(1, Math.ceil(widest / Math.max(1, spacing)));
  if (step === 1) return values;
  const retained = values.filter(
    (_value, index) => index === 0 || index === values.length - 1 || index % step === 0,
  );
  return Object.freeze(retained);
}

function ellipsizeTick(label: string, availablePixels: number): string {
  const characters = Math.max(4, Math.floor(availablePixels / 7));
  return label.length <= characters ? label : `${label.slice(0, Math.max(1, characters - 1))}…`;
}

export function resolveGrids(
  descriptors: readonly PlotDescriptor[],
  scales: Readonly<Record<string, ResolvedScale>>,
  uses: ReadonlyMap<string, ScaleUse>,
  axes: readonly SceneAxis[],
  _plotArea: { x: number; y: number; width: number; height: number },
): SceneGrid[] {
  const specs = descriptors
    .filter((descriptor) => descriptor.kind === "Grid")
    .map(
      (descriptor) =>
        descriptor.props as {
          scale?: string;
          axis?: "x" | "y";
          tickCount?: number;
        },
    );
  for (const axis of axes) {
    if (axis.grid)
      specs.push({
        scale: axis.scale,
        axis: axis.orientation === "left" || axis.orientation === "right" ? "y" : "x",
      });
  }
  return specs.flatMap((spec, index) => {
    if (spec.axis != null && spec.axis !== "x" && spec.axis !== "y") {
      throw new TypeError(`Invalid Grid axis ${String(spec.axis)}.`);
    }
    if (spec.scale != null && (typeof spec.scale !== "string" || spec.scale.length === 0)) {
      throw new TypeError("Grid scale must be a non-empty string.");
    }
    if (spec.tickCount != null && (!isFiniteNumber(spec.tickCount) || spec.tickCount <= 0)) {
      throw new RangeError("Grid tickCount must be a finite positive number.");
    }
    const name = spec.scale ?? spec.axis ?? "y";
    const scale = scales[name];
    if (!scale) throw new Error(`Grid references unknown scale ${name}.`);
    if (isColorScale(scale)) {
      throw new TypeError(`Grid cannot use color scale ${name}.`);
    }
    const declaredChannel = scaleChannel(descriptors, uses, name);
    if (declaredChannel === "color") {
      throw new TypeError(`Grid cannot use color-channel scale ${name}.`);
    }
    const axis = spec.axis ?? declaredChannel ?? (name === "x" ? "x" : "y");
    if (declaredChannel && spec.axis && declaredChannel !== spec.axis) {
      throw new TypeError(`Grid ${spec.axis} cannot use ${declaredChannel}-channel scale ${name}.`);
    }
    const positions = scale
      .ticks(spec.tickCount ?? 5)
      .map((value) => scale.map(value))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => value + (scale.bandwidth ?? 0) / 2);
    return [
      Object.freeze({
        id: `grid-${name}-${index}`,
        scale: name,
        axis,
        positions: Object.freeze(positions),
      }),
    ];
  });
}

export function resolveLegends(
  descriptors: readonly PlotDescriptor[],
  scales: Readonly<Record<string, ResolvedScale>>,
  uses: ReadonlyMap<string, ScaleUse>,
  emptyData: boolean,
): SceneLegend[] {
  const explicit = descriptors.filter((descriptor) => descriptor.kind === "Legend");
  const colorScales = [...uses.values()].filter((use) => use.channel === "color");
  const specs: { inferred: boolean; spec: Record<string, unknown> }[] =
    explicit.length > 0
      ? explicit.map((descriptor) => ({
          inferred: descriptor.props.scale == null,
          spec: descriptor.props as Record<string, unknown>,
        }))
      : colorScales.map((use) => ({ inferred: true, spec: { scale: use.name } }));
  return specs.flatMap(({ inferred, spec }) => {
    if (spec.position != null && !isLegendPosition(spec.position)) {
      throw new TypeError(`Invalid Legend position ${String(spec.position)}.`);
    }
    if (spec.scale != null && (typeof spec.scale !== "string" || spec.scale.length === 0)) {
      throw new TypeError("Legend scale must be a non-empty string.");
    }
    if (spec.label != null && typeof spec.label !== "string") {
      throw new TypeError("Legend label must be a string.");
    }
    const name = spec.scale ?? "color";
    const scale = scales[name];
    if (!scale && emptyData && inferred) return [];
    if (!scale) throw new Error(`Legend references unknown scale ${name}.`);
    if (!isColorScale(scale)) {
      throw new TypeError(`Legend requires a color scale, received ${name}.`);
    }
    if (spec.interactive != null && typeof spec.interactive !== "boolean") {
      throw new TypeError("Legend interactive must be a boolean.");
    }
    if (spec.interactive === true && scale.type === "continuous-color") {
      throw new TypeError("Continuous color legends cannot be interactive.");
    }
    if (spec.interactive === true && hasAmbiguousInteractiveColorChannels(descriptors, name)) {
      throw new TypeError(
        `Interactive legend ${name} cannot filter a mark with different data-driven fill and stroke channels.`,
      );
    }
    const items = scale.domain.map((value) =>
      Object.freeze({
        value: channelSeries(value) ?? "missing:",
        label: String(value instanceof Date ? value.toISOString() : value),
        color: String(scale.map(value) ?? "transparent"),
      }),
    );
    return [
      Object.freeze({
        scale: name,
        label: typeof spec.label === "string" ? spec.label : null,
        interactive: spec.interactive === true,
        position: isLegendPosition(spec.position) ? spec.position : "bottom",
        items: Object.freeze(items),
      }),
    ];
  });
}

function hasAmbiguousInteractiveColorChannels(
  descriptors: readonly PlotDescriptor[],
  scaleName: string,
): boolean {
  return descriptors.some((descriptor) => {
    if (!MARK_KINDS.has(descriptor.kind)) return false;
    const props = descriptor.props as Readonly<Record<string, unknown>>;
    if (String(props.colorScale ?? "color") !== scaleName) return false;
    const fill = props.fill ?? props.category;
    const stroke = props.stroke;
    return (
      fill != null && stroke != null && !isConstant(fill) && !isConstant(stroke) && fill !== stroke
    );
  });
}

export function resolveInteractions(
  descriptors: readonly PlotDescriptor[],
  hasMarks: boolean,
): SceneInteractions {
  const tooltip = singletonDescriptor(descriptors, "Tooltip");
  const crosshair = singletonDescriptor(descriptors, "Crosshair");
  const select = singletonDescriptor(descriptors, "Select");
  const zoom = singletonDescriptor(descriptors, "Zoom");
  const brush = singletonDescriptor(descriptors, "Brush");
  const tooltipProps = tooltip?.props as Record<string, unknown> | undefined;
  const crosshairProps = crosshair?.props as Record<string, unknown> | undefined;
  const selectProps = select?.props as Record<string, unknown> | undefined;
  const zoomProps = zoom?.props as Record<string, unknown> | undefined;
  const brushProps = brush?.props as Record<string, unknown> | undefined;
  if (
    tooltipProps?.channels != null &&
    (!Array.isArray(tooltipProps.channels) ||
      !tooltipProps.channels.every((channel) => typeof channel === "string"))
  ) {
    throw new TypeError("Tooltip channels must be an array of strings.");
  }
  if (tooltipProps?.format != null && typeof tooltipProps.format !== "function") {
    throw new TypeError("Tooltip format must be a function.");
  }
  if (
    tooltipProps?.mode != null &&
    tooltipProps.mode !== "auto" &&
    tooltipProps.mode !== "mark" &&
    tooltipProps.mode !== "x"
  ) {
    throw new TypeError(`Invalid Tooltip mode ${String(tooltipProps.mode)}.`);
  }
  if (selectProps?.mode != null && selectProps.mode !== "single" && selectProps.mode !== "toggle") {
    throw new TypeError(`Invalid Select mode ${String(selectProps.mode)}.`);
  }
  const crosshairAxes = crosshair
    ? resolveAxesOption(crosshairProps?.axes, "Crosshair axes")
    : "xy";
  const zoomAxes = zoom ? resolveAxesOption(zoomProps?.axes, "Zoom axes") : "xy";
  const brushAxis = brush ? resolveAxesOption(brushProps?.axis, "Brush axis") : "xy";
  if (
    brush &&
    brushProps?.modifier != null &&
    brushProps.modifier !== "none" &&
    brushProps.modifier !== "shift"
  ) {
    throw new TypeError(`Invalid Brush modifier ${String(brushProps.modifier)}.`);
  }
  const zoomMinimum = zoom ? resolveZoomExtent(zoomProps?.min, 1, "minimum") : 1;
  const zoomMaximum = zoom ? resolveZoomExtent(zoomProps?.max, 64, "maximum") : 64;
  if (zoom && zoomMaximum < zoomMinimum) {
    throw new RangeError("Zoom maximum must be greater than or equal to its minimum.");
  }
  for (const option of ["wheel", "pinch", "pan"] as const) {
    if (zoomProps?.[option] != null && typeof zoomProps[option] !== "boolean") {
      throw new TypeError(`Zoom ${option} must be a boolean.`);
    }
  }
  return Object.freeze({
    tooltip: Boolean(tooltip || hasMarks),
    tooltipMode:
      tooltipProps?.mode === "mark" || tooltipProps?.mode === "x" ? tooltipProps.mode : "auto",
    tooltipChannels: Array.isArray(tooltipProps?.channels)
      ? Object.freeze([...tooltipProps.channels] as string[])
      : null,
    tooltipFormat:
      typeof tooltipProps?.format === "function"
        ? (tooltipProps.format as (record: Readonly<Record<string, unknown>>) => string)
        : null,
    crosshair: crosshair ? crosshairAxes : null,
    select: select
      ? Object.freeze({ mode: selectProps?.mode === "toggle" ? "toggle" : "single" })
      : null,
    zoom: zoom
      ? Object.freeze({
          axes: zoomAxes,
          min: zoomMinimum,
          max: zoomMaximum,
          wheel: zoomProps?.wheel !== false,
          pinch: zoomProps?.pinch !== false,
          pan: zoomProps?.pan !== false,
        })
      : null,
    brush: brush
      ? Object.freeze({
          axis: brushAxis,
          modifier: brushProps?.modifier === "none" ? "none" : "shift",
        })
      : null,
  });
}

function formatTick(value: ScaleValue, locale: string, scale: ResolvedScale): string {
  if (value instanceof Date) {
    const dates = scale.domain.filter((candidate): candidate is Date => candidate instanceof Date);
    const span =
      dates.length < 2
        ? Number.POSITIVE_INFINITY
        : Math.abs(dates[dates.length - 1]!.getTime() - dates[0]!.getTime());
    const timeZone = scale.type === "utc" ? "UTC" : undefined;
    if (span < 2 * 60 * 1000) {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone,
      }).format(value);
    }
    if (span < 24 * 60 * 60 * 1000) {
      return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
      }).format(value);
    }
    if (span < 90 * 24 * 60 * 60 * 1000) {
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        timeZone,
      }).format(value);
    }
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
      timeZone,
    }).format(value);
  }
  if (typeof value === "number")
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
  return value;
}

function validateAxisSpec(spec: AxisProps): void {
  const axis = spec.axis as unknown;
  const orient = spec.orient as unknown;
  if (axis != null && axis !== "x" && axis !== "y") {
    throw new TypeError(`Invalid Axis axis ${String(axis)}.`);
  }
  if (
    orient != null &&
    orient !== "top" &&
    orient !== "right" &&
    orient !== "bottom" &&
    orient !== "left"
  ) {
    throw new TypeError(`Invalid Axis orientation ${String(orient)}.`);
  }
  if (
    (axis === "x" && (orient === "left" || orient === "right")) ||
    (axis === "y" && (orient === "top" || orient === "bottom"))
  ) {
    throw new TypeError(`Axis ${axis} cannot use ${String(orient)} orientation.`);
  }
  if (spec.scale != null && (typeof spec.scale !== "string" || spec.scale.length === 0)) {
    throw new TypeError("Axis scale must be a non-empty string.");
  }
  if (spec.tickCount != null && (!isFiniteNumber(spec.tickCount) || spec.tickCount <= 0)) {
    throw new RangeError("Axis tickCount must be a finite positive number.");
  }
  if (spec.tickFormat != null && typeof spec.tickFormat !== "function") {
    throw new TypeError("Axis tickFormat must be a function.");
  }
  if (spec.grid != null && typeof spec.grid !== "boolean") {
    throw new TypeError("Axis grid must be a boolean.");
  }
}

function singletonDescriptor(
  descriptors: readonly PlotDescriptor[],
  kind: "Tooltip" | "Crosshair" | "Select" | "Zoom" | "Brush",
): PlotDescriptor | undefined {
  const matches = descriptors.filter((descriptor) => descriptor.kind === kind);
  if (matches.length > 1) {
    throw new Error(`Duplicate ${kind} descriptor.`);
  }
  return matches[0];
}

function resolveAxesOption(value: unknown, label: string): "x" | "y" | "xy" {
  if (value === undefined) return "xy";
  if (value === "x" || value === "y" || value === "xy") return value;
  throw new TypeError(`${label} must be x, y, or xy.`);
}

function resolveZoomExtent(value: unknown, fallback: number, label: "minimum" | "maximum"): number {
  if (value === undefined) return fallback;
  if (!isFiniteNumber(value) || value <= 0) {
    throw new RangeError(`Zoom ${label} must be a finite positive number.`);
  }
  return value;
}

function isLegendPosition(value: unknown): value is "top" | "right" | "bottom" | "left" {
  return value === "top" || value === "right" || value === "bottom" || value === "left";
}
