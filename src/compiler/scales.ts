import type { PlotDescriptor } from "../descriptors";
import type { PlotView, ScaleProps } from "../model";
import { createScale, inferScaleType, type ResolvedScale, type ScaleInput } from "../scales";
import { isFiniteNumber } from "../transforms";
import { SERIES_COLORS, validPaintScaleValue, type ScaleUse } from "./shared";
import { validDate, validTemporalScaleValue } from "./marks";

export const SCALE_TYPES: ReadonlySet<string> = new Set([
  "band",
  "point",
  "linear",
  "power",
  "log",
  "symlog",
  "time",
  "utc",
  "ordinal-color",
  "continuous-color",
]);

export function isColorScale(scale: ResolvedScale): boolean {
  return scale.type === "ordinal-color" || scale.type === "continuous-color";
}

export function resolveScales(
  descriptors: readonly PlotDescriptor[],
  uses: ReadonlyMap<string, ScaleUse>,
  plotArea: { x: number; y: number; width: number; height: number },
  view: PlotView | undefined,
): Record<string, ResolvedScale> {
  const explicit = new Map<string, ScaleProps>();
  for (const descriptor of descriptors) {
    if (descriptor.kind !== "Scale") continue;
    const rawProps = descriptor.props as Readonly<Record<string, unknown>>;
    const rawName = rawProps.name ?? rawProps.channel ?? "x";
    if (typeof rawName !== "string" || rawName.length === 0) {
      throw new TypeError("Scale names must be non-empty strings.");
    }
    const name = rawName;
    validateExplicitScaleProps(rawProps, name);
    const props = rawProps as ScaleProps;
    if (explicit.has(name)) throw new Error(`Duplicate scale ${name}.`);
    explicit.set(name, props);
  }
  const names = new Set([...uses.keys(), ...explicit.keys()]);
  const result: Record<string, ResolvedScale> = {};
  for (const name of names) {
    const use = uses.get(name) ?? {
      name,
      channel: (explicit.get(name)?.channel ?? "x") as ScaleUse["channel"],
      values: [],
      band: false,
      includeZero: false,
    };
    const props = explicit.get(name) ?? {};
    if (props.channel != null && props.channel !== use.channel) {
      throw new Error(
        `Scale ${name} is declared for ${props.channel} but used for ${use.channel}.`,
      );
    }
    let type = props.type ?? inferScaleType(use.values, use.channel);
    if (props.type == null && (type === "band" || type === "point") && use.channel !== "color") {
      type = use.band ? "band" : "point";
    }
    const colorType = type === "ordinal-color" || type === "continuous-color";
    if ((use.channel === "color") !== colorType) {
      throw new TypeError(
        `Scale ${name} type ${type} is incompatible with its ${use.channel} channel.`,
      );
    }
    const primaryName = primaryScaleName(uses, explicit, use.channel);
    const addressedView =
      use.channel === "color"
        ? undefined
        : (view?.scales?.[name] ??
          (primaryName === name ? (use.channel === "x" ? view?.x : view?.y) : undefined));
    // A view is a rendered-domain override. Unaddressed named scales retain
    // their descriptor domains and all other scale state.
    let domain = addressedView ? [...addressedView] : props.domain ? [...props.domain] : undefined;
    if (!domain && use.includeZero && ["linear", "power", "symlog"].includes(type)) {
      const numbers = use.values.filter(isFiniteNumber);
      if (numbers.length > 0) {
        let minimum = numbers[0]!;
        let maximum = numbers[0]!;
        for (let index = 1; index < numbers.length; index += 1) {
          minimum = Math.min(minimum, numbers[index]!);
          maximum = Math.max(maximum, numbers[index]!);
        }
        domain = [Math.min(0, minimum), Math.max(0, maximum)];
      }
    }
    const range = props.range
      ? [...props.range]
      : use.channel === "x"
        ? [plotArea.x, plotArea.x + plotArea.width]
        : use.channel === "y"
          ? [plotArea.y + plotArea.height, plotArea.y]
          : type === "continuous-color"
            ? ["#eff6ff", "#2563eb"]
            : SERIES_COLORS;
    result[name] = createScale({
      ...props,
      name,
      channel: use.channel,
      type,
      domain: domain as readonly ScaleInput[] | undefined,
      range,
      values: use.values,
      ...(addressedView ? { nice: false } : {}),
      padding: props.padding ?? (type === "band" ? 0.12 : 0),
      paddingInner: props.paddingInner ?? (type === "band" ? 0.12 : undefined),
      paddingOuter: props.paddingOuter ?? (type === "band" ? 0.06 : undefined),
    });
  }
  return result;
}

function validateExplicitScaleProps(props: Readonly<Record<string, unknown>>, name: string): void {
  if (
    props.channel != null &&
    props.channel !== "x" &&
    props.channel !== "y" &&
    props.channel !== "color"
  ) {
    throw new TypeError(`Scale ${name} has invalid channel ${String(props.channel)}.`);
  }
  if (props.type != null && (typeof props.type !== "string" || !SCALE_TYPES.has(props.type))) {
    throw new TypeError(`Scale ${name} has invalid type ${String(props.type)}.`);
  }
  if (
    props.nice != null &&
    typeof props.nice !== "boolean" &&
    (typeof props.nice !== "number" || !Number.isFinite(props.nice) || props.nice <= 0)
  ) {
    throw new RangeError(`Scale ${name} nice must be a boolean or a finite positive number.`);
  }
  for (const property of ["clamp", "reverse"] as const) {
    if (props[property] != null && typeof props[property] !== "boolean") {
      throw new TypeError(`Scale ${name} ${property} must be a boolean.`);
    }
  }
  if (props.unknown != null && typeof props.unknown !== "string") {
    throw new TypeError(`Scale ${name} unknown must be a string.`);
  }

  const type = props.type as ScaleProps["type"];
  if (type === "log") {
    validatePositiveScaleParameter(props.base, name, "base", true);
  } else if (type === "power") {
    validatePositiveScaleParameter(props.exponent, name, "exponent");
  } else if (type === "symlog") {
    validatePositiveScaleParameter(props.constant, name, "constant");
  }

  const domain = validateScaleArray(props.domain, name, "domain");
  const range = validateScaleArray(props.range, name, "range");
  if (domain && !domain.every(validPaintScaleValue)) {
    throw new TypeError(`Scale ${name} domain contains an invalid value.`);
  }
  if (!type) return;

  const categorical = type === "band" || type === "point" || type === "ordinal-color";
  const color = type === "ordinal-color" || type === "continuous-color";
  if (domain && !categorical) {
    if (domain.length < 2) {
      throw new TypeError(`Scale ${name} domain requires at least two values.`);
    }
    if (type === "time" || type === "utc") {
      if (!domain.every(validTemporalScaleValue)) {
        throw new TypeError(`Scale ${name} ${type} domain requires finite dates or numbers.`);
      }
    } else if (type === "continuous-color") {
      const numeric = domain.every(isFiniteNumber);
      const temporal = domain.every(validDate);
      if (!numeric && !temporal) {
        throw new TypeError(
          `Scale ${name} continuous-color domain must contain only finite numbers or only valid dates.`,
        );
      }
    } else if (!domain.every((value) => isFiniteNumber(value) && (type !== "log" || value > 0))) {
      throw new TypeError(
        `Scale ${name} ${type} domain requires ${type === "log" ? "positive " : ""}finite numbers.`,
      );
    }
  }
  if (range) {
    if (range.length === 0) {
      throw new TypeError(`Scale ${name} range must not be empty.`);
    }
    if (color) {
      if (!range.every((value) => typeof value === "string")) {
        throw new TypeError(`Scale ${name} color range requires strings.`);
      }
    } else if (range.length < 2 || !range.every(isFiniteNumber)) {
      throw new TypeError(`Scale ${name} coordinate range requires at least two finite numbers.`);
    }
  }
}

function validatePositiveScaleParameter(
  value: unknown,
  scaleName: string,
  property: string,
  rejectOne = false,
): void {
  if (value === undefined) return;
  if (!isFiniteNumber(value) || value <= 0 || (rejectOne && value === 1)) {
    throw new RangeError(
      `Scale ${scaleName} ${property} must be finite, positive${rejectOne ? ", and different from one" : ""}.`,
    );
  }
}

export function validateScaleArray(
  value: unknown,
  scaleName: string,
  property: "domain" | "range",
): readonly unknown[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError(`Scale ${scaleName} ${property} must be an array.`);
  }
  return value;
}

export function primaryScaleName(
  uses: ReadonlyMap<string, ScaleUse>,
  explicit: ReadonlyMap<string, ScaleProps>,
  channel: ScaleUse["channel"],
): string | undefined {
  if (explicit.has(channel)) return channel;
  const preferred = channel === "x" ? ["bottom", "top"] : ["left", "right"];
  for (const name of preferred) if (uses.get(name)?.channel === channel) return name;
  return [...uses.values()].find((use) => use.channel === channel)?.name;
}

export function scaleChannel(
  descriptors: readonly PlotDescriptor[],
  uses: ReadonlyMap<string, ScaleUse>,
  name: string,
): ScaleUse["channel"] | undefined {
  const used = uses.get(name)?.channel;
  if (used) return used;
  const declared = descriptors.find((descriptor) => {
    if (descriptor.kind !== "Scale") return false;
    const props = descriptor.props as ScaleProps;
    return (props.name ?? props.channel ?? "x") === name;
  });
  return (declared?.props as ScaleProps | undefined)?.channel;
}
