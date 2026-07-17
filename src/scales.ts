import type { ScaleProps, ScaleType, ScaleValue } from "./model";

export type ScaleInput = ScaleValue | boolean;
export type ScaleOutput = number | string;

export interface CreateScaleOptions extends Omit<ScaleProps, "domain" | "range"> {
  domain?: readonly ScaleInput[];
  range: readonly ScaleOutput[];
  values?: readonly unknown[];
}

export interface ResolvedScale {
  readonly name: string;
  readonly type: ScaleType;
  readonly domain: readonly ScaleInput[];
  readonly range: readonly ScaleOutput[];
  readonly clamp: boolean;
  readonly reverse: boolean;
  readonly omittedValueCount: number;
  readonly bandwidth?: number;
  readonly step?: number;
  map(value: ScaleInput | null | undefined): ScaleOutput | undefined;
  invert?(value: number): ScaleInput | undefined;
  ticks(count?: number): readonly ScaleInput[];
}

type ScaleChannel = NonNullable<ScaleProps["channel"]>;

type NumericDomain = {
  values: number[];
  omitted: number;
  reversed: boolean;
};

type TimeUnit = "millisecond" | "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

type TimeInterval = {
  unit: TimeUnit;
  step: number;
  duration: number;
};

const DEFAULT_ORDINAL_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
] as const;

const DEFAULT_CONTINUOUS_COLORS = ["#eff6ff", "#2563eb"] as const;

const TIME_INTERVALS: readonly TimeInterval[] = [
  { unit: "millisecond", step: 1, duration: 1 },
  { unit: "millisecond", step: 5, duration: 5 },
  { unit: "millisecond", step: 10, duration: 10 },
  { unit: "millisecond", step: 50, duration: 50 },
  { unit: "millisecond", step: 100, duration: 100 },
  { unit: "millisecond", step: 250, duration: 250 },
  { unit: "millisecond", step: 500, duration: 500 },
  { unit: "second", step: 1, duration: 1_000 },
  { unit: "second", step: 5, duration: 5_000 },
  { unit: "second", step: 15, duration: 15_000 },
  { unit: "second", step: 30, duration: 30_000 },
  { unit: "minute", step: 1, duration: 60_000 },
  { unit: "minute", step: 5, duration: 300_000 },
  { unit: "minute", step: 15, duration: 900_000 },
  { unit: "minute", step: 30, duration: 1_800_000 },
  { unit: "hour", step: 1, duration: 3_600_000 },
  { unit: "hour", step: 3, duration: 10_800_000 },
  { unit: "hour", step: 6, duration: 21_600_000 },
  { unit: "hour", step: 12, duration: 43_200_000 },
  { unit: "day", step: 1, duration: 86_400_000 },
  { unit: "day", step: 2, duration: 172_800_000 },
  { unit: "week", step: 1, duration: 604_800_000 },
  { unit: "month", step: 1, duration: 2_629_746_000 },
  { unit: "month", step: 3, duration: 7_889_238_000 },
  { unit: "month", step: 6, duration: 15_778_476_000 },
  { unit: "year", step: 1, duration: 31_556_952_000 },
] as const;

const NAMED_COLORS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  black: [0, 0, 0, 1],
  blue: [0, 0, 255, 1],
  cyan: [0, 255, 255, 1],
  gray: [128, 128, 128, 1],
  green: [0, 128, 0, 1],
  grey: [128, 128, 128, 1],
  magenta: [255, 0, 255, 1],
  orange: [255, 165, 0, 1],
  purple: [128, 0, 128, 1],
  red: [255, 0, 0, 1],
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  yellow: [255, 255, 0, 1],
};

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isScaleInput(value: unknown): value is ScaleInput {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value) ||
    isValidDate(value)
  );
}

function cloneScaleInput(value: ScaleInput): ScaleInput {
  return value instanceof Date ? new Date(value.getTime()) : value;
}

function valueKey(value: ScaleInput): string {
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

function freezeInputs(values: readonly ScaleInput[]): readonly ScaleInput[] {
  return Object.freeze(values.map(cloneScaleInput));
}

function freezeOutputs(values: readonly ScaleOutput[]): readonly ScaleOutput[] {
  return Object.freeze([...values]);
}

function normalizeCount(count: number | undefined, fallback = 5): number {
  if (!Number.isFinite(count)) return fallback;
  return Math.max(1, Math.floor(count ?? fallback));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizePadding(value: number | undefined, maximum = 1): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Number(value)));
}

function reverseRange(
  range: readonly ScaleOutput[],
  reverse: boolean | undefined,
): readonly ScaleOutput[] {
  const resolved = range.length > 0 ? [...range] : [0, 1];
  if (reverse) resolved.reverse();
  return freezeOutputs(resolved);
}

function categoricalDomain(values: readonly unknown[]): {
  domain: readonly ScaleInput[];
  omitted: number;
} {
  const domain: ScaleInput[] = [];
  const seen = new Set<string>();
  let omitted = 0;

  for (const value of values) {
    if (!isScaleInput(value)) {
      omitted += 1;
      continue;
    }

    const key = valueKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      domain.push(cloneScaleInput(value));
    }
  }

  return { domain: freezeInputs(domain), omitted };
}

function numericDomain(values: readonly unknown[], log = false): NumericDomain {
  const normalized: number[] = [];
  let omitted = 0;

  for (const value of values) {
    if (!isFiniteNumber(value) || (log && value <= 0)) {
      omitted += 1;
      continue;
    }
    normalized.push(value);
  }

  if (normalized.length === 0) {
    return {
      values: log ? [1, 10] : [0, 1],
      omitted,
      reversed: false,
    };
  }

  if (normalized.length === 1) {
    const value = normalized[0]!;
    if (log) {
      const lower = value / 10;
      return { values: [lower, value * 10], omitted, reversed: false };
    }
    const delta = value === 0 ? 1 : Math.abs(value) * 0.5;
    return { values: [value - delta, value + delta], omitted, reversed: false };
  }

  const first = normalized[0]!;
  const last = normalized[normalized.length - 1]!;
  const explicitDirection = first > last;
  let minimum = first;
  let maximum = first;
  for (let index = 1; index < normalized.length; index += 1) {
    minimum = Math.min(minimum, normalized[index]!);
    maximum = Math.max(maximum, normalized[index]!);
  }

  return {
    values: explicitDirection ? [maximum, minimum] : [minimum, maximum],
    omitted,
    reversed: explicitDirection,
  };
}

function derivedNumericDomain(values: readonly unknown[], log = false): NumericDomain {
  const normalized: number[] = [];
  let omitted = 0;

  for (const value of values) {
    if (!isFiniteNumber(value) || (log && value <= 0)) {
      omitted += 1;
      continue;
    }
    normalized.push(value);
  }

  if (normalized.length === 0) {
    return {
      values: log ? [1, 10] : [0, 1],
      omitted,
      reversed: false,
    };
  }

  let minimum = normalized[0]!;
  let maximum = normalized[0]!;
  for (let index = 1; index < normalized.length; index += 1) {
    minimum = Math.min(minimum, normalized[index]!);
    maximum = Math.max(maximum, normalized[index]!);
  }
  if (minimum === maximum) {
    const expanded = numericDomain([minimum], log);
    return { ...expanded, omitted };
  }
  return { values: [minimum, maximum], omitted, reversed: false };
}

function dateDomain(values: readonly unknown[], explicit: boolean): NumericDomain {
  const timestamps: number[] = [];
  let omitted = 0;

  for (const value of values) {
    if (isValidDate(value)) {
      timestamps.push(value.getTime());
    } else if (isFiniteNumber(value)) {
      timestamps.push(value);
    } else {
      omitted += 1;
    }
  }

  if (timestamps.length === 0) {
    return { values: [0, 86_400_000], omitted, reversed: false };
  }

  if (timestamps.length === 1) {
    return {
      values: [timestamps[0]! - 43_200_000, timestamps[0]! + 43_200_000],
      omitted,
      reversed: false,
    };
  }

  const first = timestamps[0]!;
  const last = timestamps[timestamps.length - 1]!;
  const reversed = explicit && first > last;
  let minimum = first;
  let maximum = first;
  for (let index = 1; index < timestamps.length; index += 1) {
    minimum = Math.min(minimum, timestamps[index]!);
    maximum = Math.max(maximum, timestamps[index]!);
  }
  return {
    values: reversed ? [maximum, minimum] : [minimum, maximum],
    omitted,
    reversed,
  };
}

function tickStep(start: number, stop: number, count: number): number {
  const span = Math.abs(stop - start);
  if (!Number.isFinite(span) || span === 0) return 0;

  const rawStep = span / Math.max(1, count);
  const power = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** power;
  const error = rawStep / magnitude;
  const factor =
    error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return factor * magnitude;
}

function roundTick(value: number, step: number): number {
  if (!Number.isFinite(value) || step === 0) return value;
  const precision = Math.max(0, -Math.floor(Math.log10(Math.abs(step))) + 2);
  return Number(value.toFixed(Math.min(15, precision)));
}

function numericTicks(start: number, stop: number, count = 5): readonly number[] {
  if (!Number.isFinite(start) || !Number.isFinite(stop)) return Object.freeze([]);
  if (start === stop) return Object.freeze([start]);

  const reversed = stop < start;
  const minimum = reversed ? stop : start;
  const maximum = reversed ? start : stop;
  const step = tickStep(minimum, maximum, normalizeCount(count));
  if (step === 0) return Object.freeze([start]);

  const first = Math.ceil(minimum / step - 1e-12);
  const last = Math.floor(maximum / step + 1e-12);
  const ticks: number[] = [];
  for (let index = first; index <= last; index += 1) {
    ticks.push(roundTick(index * step, step));
  }

  if (reversed) ticks.reverse();
  return Object.freeze(ticks);
}

function niceNumericDomain(start: number, stop: number, count: number): readonly [number, number] {
  const reversed = stop < start;
  const minimum = reversed ? stop : start;
  const maximum = reversed ? start : stop;
  const step = tickStep(minimum, maximum, count);
  if (step === 0) return [start, stop];

  const niceMinimum = roundTick(Math.floor(minimum / step) * step, step);
  const niceMaximum = roundTick(Math.ceil(maximum / step) * step, step);
  return reversed ? [niceMaximum, niceMinimum] : [niceMinimum, niceMaximum];
}

function logTicks(start: number, stop: number, count: number, base: number): readonly number[] {
  const reversed = stop < start;
  const minimum = reversed ? stop : start;
  const maximum = reversed ? start : stop;
  if (minimum <= 0 || !Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return Object.freeze([]);
  }

  const log = (value: number) => Math.log(value) / Math.log(base);
  const firstPower = Math.ceil(log(minimum) - 1e-12);
  const lastPower = Math.floor(log(maximum) + 1e-12);
  const ticks: number[] = [];
  const integerBase = Number.isInteger(base) && base >= 2 && base <= 16;

  if (integerBase && lastPower - firstPower < count) {
    for (let power = Math.floor(log(minimum)); power <= Math.ceil(log(maximum)); power += 1) {
      const magnitude = base ** power;
      for (let multiplier = 1; multiplier < base; multiplier += 1) {
        const value = multiplier * magnitude;
        if (value >= minimum * (1 - 1e-12) && value <= maximum * (1 + 1e-12)) {
          ticks.push(value);
        }
      }
    }
  } else {
    const powerStep = Math.max(1, Math.ceil((lastPower - firstPower + 1) / count));
    for (let power = firstPower; power <= lastPower; power += powerStep) {
      ticks.push(base ** power);
    }
  }

  if (reversed) ticks.reverse();
  return Object.freeze(ticks);
}

function transformPower(value: number, exponent: number): number {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

function untransformPower(value: number, exponent: number): number {
  return Math.sign(value) * Math.abs(value) ** (1 / exponent);
}

function transformSymlog(value: number, constant: number): number {
  return Math.sign(value) * Math.log1p(Math.abs(value) / constant);
}

function untransformSymlog(value: number, constant: number): number {
  return Math.sign(value) * Math.expm1(Math.abs(value)) * constant;
}

function interpolateNumberRange(range: readonly number[], value: number): number {
  if (range.length === 0) return value;
  if (range.length === 1) return range[0]!;

  const scaled = value * (range.length - 1);
  const index =
    value <= 0 ? 0 : value >= 1 ? range.length - 2 : Math.min(range.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  return range[index]! + (range[index + 1]! - range[index]!) * fraction;
}

function isMonotonic(values: readonly number[]): boolean {
  if (values.length < 2) return false;
  const direction = Math.sign(values[values.length - 1]! - values[0]!);
  if (direction === 0) return false;
  for (let index = 1; index < values.length; index += 1) {
    if (Math.sign(values[index]! - values[index - 1]!) !== direction) return false;
  }
  return true;
}

function uninterpolateNumberRange(
  range: readonly number[],
  value: number,
  clampValue: boolean,
): number | undefined {
  if (!isMonotonic(range)) return undefined;
  const ascending = range[range.length - 1]! > range[0]!;
  const minimum = ascending ? range[0]! : range[range.length - 1]!;
  const maximum = ascending ? range[range.length - 1]! : range[0]!;
  const resolvedValue = clampValue ? Math.min(maximum, Math.max(minimum, value)) : value;

  const beforeFirst = ascending ? resolvedValue < range[0]! : resolvedValue > range[0]!;
  const afterLast = ascending
    ? resolvedValue > range[range.length - 1]!
    : resolvedValue < range[range.length - 1]!;
  const firstIndex = beforeFirst ? 0 : afterLast ? range.length - 2 : undefined;
  if (firstIndex != null) {
    const left = range[firstIndex]!;
    const right = range[firstIndex + 1]!;
    const fraction = (resolvedValue - left) / (right - left);
    return (firstIndex + fraction) / (range.length - 1);
  }

  for (let index = 0; index < range.length - 1; index += 1) {
    const left = range[index]!;
    const right = range[index + 1]!;
    if (
      (ascending && resolvedValue >= left && resolvedValue <= right) ||
      (!ascending && resolvedValue <= left && resolvedValue >= right)
    ) {
      const fraction = right === left ? 0 : (resolvedValue - left) / (right - left);
      return (index + fraction) / (range.length - 1);
    }
  }

  return resolvedValue === range[0] ? 0 : 1;
}

function numericRange(range: readonly ScaleOutput[]): readonly number[] | undefined {
  return range.every(isFiniteNumber) ? (range as readonly number[]) : undefined;
}

function resolveNumericRange(
  range: readonly ScaleOutput[],
  reverse: boolean | undefined,
): readonly number[] {
  const resolved = reverseRange(range, reverse);
  const numeric = numericRange(resolved);
  if (!numeric || numeric.length === 0) {
    throw new TypeError("Continuous coordinate scales require a numeric range.");
  }
  return numeric;
}

function parseHexColor(value: string): readonly [number, number, number, number] | undefined {
  const match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!match) return undefined;
  const hex = match[1]!;
  if (![3, 4, 6, 8].includes(hex.length)) return undefined;

  const expanded =
    hex.length <= 4 ? [...hex].map((character) => `${character}${character}`).join("") : hex;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    alpha,
  ];
}

function parseRgbChannel(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isFinite(percent) ? Math.min(255, Math.max(0, (percent / 100) * 255)) : undefined;
  }
  const channel = Number.parseFloat(trimmed);
  return Number.isFinite(channel) ? Math.min(255, Math.max(0, channel)) : undefined;
}

function parseAlphaChannel(value: string): number | undefined {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const alpha = trimmed.endsWith("%") ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, alpha));
}

function parseRgbColor(value: string): readonly [number, number, number, number] | undefined {
  const match = /^rgba?\((.+)\)$/i.exec(value.trim());
  if (!match) return undefined;
  const parts = match[1]!
    .replace("/", ",")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return undefined;
  const red = parseRgbChannel(parts[0]!);
  const green = parseRgbChannel(parts[1]!);
  const blue = parseRgbChannel(parts[2]!);
  const alpha = parts[3] == null ? 1 : parseAlphaChannel(parts[3]!);
  if (red == null || green == null || blue == null || alpha == null) return undefined;
  return [red, green, blue, alpha];
}

function parseColor(value: string): readonly [number, number, number, number] | undefined {
  return NAMED_COLORS[value.trim().toLowerCase()] ?? parseHexColor(value) ?? parseRgbColor(value);
}

function formatInterpolatedColor(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
  fraction: number,
): string {
  const channel = (index: 0 | 1 | 2) =>
    Math.min(255, Math.max(0, Math.round(left[index] + (right[index] - left[index]) * fraction)));
  const alpha = Math.min(1, Math.max(0, left[3] + (right[3] - left[3]) * fraction));
  if (Math.abs(alpha - 1) < 1e-9) {
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
  }
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${Number(alpha.toFixed(3))})`;
}

function interpolateColorRange(
  range: readonly string[],
  value: number,
  clampValue: boolean,
): string {
  if (range.length === 0) return DEFAULT_CONTINUOUS_COLORS[0];
  if (range.length === 1) return range[0]!;
  const resolved = clampValue ? clamp01(value) : value;
  if (resolved === 0) return range[0]!;
  if (resolved === 1) return range[range.length - 1]!;

  const scaled = resolved * (range.length - 1);
  const index =
    resolved < 0
      ? 0
      : resolved > 1
        ? range.length - 2
        : Math.min(range.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const leftText = range[index]!;
  const rightText = range[index + 1]!;
  const left = parseColor(leftText);
  const right = parseColor(rightText);
  return left && right
    ? formatInterpolatedColor(left, right, fraction)
    : fraction < 0.5
      ? leftText
      : rightText;
}

function inferValueKind(values: readonly unknown[]): "date" | "number" | "categorical" | undefined {
  let sawDate = false;
  let sawNumber = false;
  let sawCategorical = false;

  for (const value of values) {
    if (
      value == null ||
      (typeof value === "number" && !Number.isFinite(value)) ||
      (value instanceof Date && !isValidDate(value))
    ) {
      continue;
    }
    if (isValidDate(value)) sawDate = true;
    else if (isFiniteNumber(value)) sawNumber = true;
    else if (typeof value === "string" || typeof value === "boolean") sawCategorical = true;
  }

  if (sawCategorical || (sawDate && sawNumber)) return "categorical";
  if (sawDate) return "date";
  if (sawNumber) return "number";
  return undefined;
}

export function inferScaleType(values: readonly unknown[], channel?: ScaleChannel): ScaleType {
  const kind = inferValueKind(values);
  if (channel === "color") {
    return kind === "number" || kind === "date" ? "continuous-color" : "ordinal-color";
  }
  if (kind === "date") return "time";
  if (kind === "number" || kind == null) return "linear";
  return "band";
}

function createCategoricalScale(
  options: CreateScaleOptions,
  type: "band" | "point" | "ordinal-color",
): ResolvedScale {
  for (const [name, value] of [
    ["padding", options.padding],
    ["paddingInner", options.paddingInner],
    ["paddingOuter", options.paddingOuter],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`${name} must be a finite non-negative number.`);
    }
  }
  const source = options.domain ?? options.values ?? [];
  const { domain, omitted } = categoricalDomain(source);
  const actualRange =
    type === "ordinal-color" && options.range.length === 0
      ? freezeOutputs(
          options.reverse ? [...DEFAULT_ORDINAL_COLORS].reverse() : DEFAULT_ORDINAL_COLORS,
        )
      : reverseRange(options.range, options.reverse);
  const indexByKey = new Map(domain.map((value, index) => [valueKey(value), index]));
  const unknownValue = options.unknown;

  if (type === "ordinal-color") {
    if (!actualRange.every((value) => typeof value === "string")) {
      throw new TypeError("Ordinal color scales require a string range.");
    }
    const colors = actualRange as readonly string[];

    const scale: ResolvedScale = {
      name: options.name ?? options.channel ?? "color",
      type,
      domain,
      range: actualRange,
      clamp: false,
      reverse: options.reverse ?? false,
      omittedValueCount: omitted,
      map(value) {
        if (value == null) return unknownValue;
        const index = indexByKey.get(valueKey(value));
        return index == null ? unknownValue : colors[index % colors.length];
      },
      ticks() {
        return domain;
      },
    };
    return Object.freeze(scale);
  }

  const positions = numericRange(actualRange);
  if (!positions || positions.length < 2) {
    throw new TypeError(`${type} scales require a two-value numeric range.`);
  }

  const rangeStart = positions[0]!;
  const rangeStop = positions[positions.length - 1]!;
  const reversedRange = rangeStop < rangeStart;
  const start = Math.min(rangeStart, rangeStop);
  const stop = Math.max(rangeStart, rangeStop);
  const count = domain.length;
  const shorthandPadding = normalizePadding(options.padding);
  const paddingInner =
    type === "point" ? 1 : normalizePadding(options.paddingInner ?? shorthandPadding);
  const paddingOuter = normalizePadding(options.paddingOuter ?? shorthandPadding, Number.MAX_VALUE);
  const denominator = Math.max(1, count - paddingInner + paddingOuter * 2);
  const step = (stop - start) / denominator;
  const offset = (stop - start - step * (count - paddingInner)) / 2;
  const bandwidth = type === "point" ? 0 : step * (1 - paddingInner);

  const scale: ResolvedScale = {
    name: options.name ?? options.channel ?? type,
    type,
    domain,
    range: actualRange,
    clamp: false,
    reverse: options.reverse ?? false,
    omittedValueCount: omitted,
    bandwidth,
    step,
    map(value) {
      if (value == null) return unknownValue;
      const index = indexByKey.get(valueKey(value));
      if (index == null) return unknownValue;
      const orderedIndex = reversedRange ? count - 1 - index : index;
      return start + offset + step * orderedIndex;
    },
    ticks() {
      return domain;
    },
  };

  return Object.freeze(scale);
}

function floorTime(timestamp: number, interval: TimeInterval, utc: boolean): number {
  if (interval.unit === "millisecond") {
    return Math.floor(timestamp / interval.step) * interval.step;
  }

  const date = new Date(timestamp);
  const get = (local: keyof Date, universal: keyof Date): (() => number) =>
    date[utc ? universal : local].bind(date) as () => number;
  const set = (local: keyof Date, universal: keyof Date): ((...values: number[]) => number) =>
    date[utc ? universal : local].bind(date) as (...values: number[]) => number;

  if (interval.unit === "second") {
    const second = get("getSeconds", "getUTCSeconds")();
    set("setMilliseconds", "setUTCMilliseconds")(0);
    set("setSeconds", "setUTCSeconds")(Math.floor(second / interval.step) * interval.step);
  } else if (interval.unit === "minute") {
    const minute = get("getMinutes", "getUTCMinutes")();
    set("setSeconds", "setUTCSeconds")(0, 0);
    set("setMinutes", "setUTCMinutes")(Math.floor(minute / interval.step) * interval.step);
  } else if (interval.unit === "hour") {
    const hour = get("getHours", "getUTCHours")();
    set("setMinutes", "setUTCMinutes")(0, 0, 0);
    set("setHours", "setUTCHours")(Math.floor(hour / interval.step) * interval.step);
  } else if (interval.unit === "day") {
    const day = get("getDate", "getUTCDate")();
    set("setHours", "setUTCHours")(0, 0, 0, 0);
    set("setDate", "setUTCDate")(Math.floor((day - 1) / interval.step) * interval.step + 1);
  } else if (interval.unit === "week") {
    const weekday = get("getDay", "getUTCDay")();
    set("setHours", "setUTCHours")(0, 0, 0, 0);
    set("setDate", "setUTCDate")(get("getDate", "getUTCDate")() - weekday);
  } else if (interval.unit === "month") {
    const month = get("getMonth", "getUTCMonth")();
    set("setDate", "setUTCDate")(1);
    set("setHours", "setUTCHours")(0, 0, 0, 0);
    set("setMonth", "setUTCMonth")(Math.floor(month / interval.step) * interval.step);
  } else {
    const year = get("getFullYear", "getUTCFullYear")();
    set("setMonth", "setUTCMonth")(0, 1);
    set("setHours", "setUTCHours")(0, 0, 0, 0);
    set("setFullYear", "setUTCFullYear")(Math.floor(year / interval.step) * interval.step);
  }

  return date.getTime();
}

function offsetTime(timestamp: number, interval: TimeInterval, utc: boolean): number {
  if (interval.unit === "millisecond") return timestamp + interval.step;
  const date = new Date(timestamp);

  if (interval.unit === "second") {
    if (utc) date.setUTCSeconds(date.getUTCSeconds() + interval.step);
    else date.setSeconds(date.getSeconds() + interval.step);
  } else if (interval.unit === "minute") {
    if (utc) date.setUTCMinutes(date.getUTCMinutes() + interval.step);
    else date.setMinutes(date.getMinutes() + interval.step);
  } else if (interval.unit === "hour") {
    if (utc) date.setUTCHours(date.getUTCHours() + interval.step);
    else date.setHours(date.getHours() + interval.step);
  } else if (interval.unit === "day" || interval.unit === "week") {
    const days = interval.unit === "week" ? interval.step * 7 : interval.step;
    if (utc) date.setUTCDate(date.getUTCDate() + days);
    else date.setDate(date.getDate() + days);
  } else if (interval.unit === "month") {
    if (utc) date.setUTCMonth(date.getUTCMonth() + interval.step);
    else date.setMonth(date.getMonth() + interval.step);
  } else if (utc) {
    date.setUTCFullYear(date.getUTCFullYear() + interval.step);
  } else {
    date.setFullYear(date.getFullYear() + interval.step);
  }

  return date.getTime();
}

function ceilTime(timestamp: number, interval: TimeInterval, utc: boolean): number {
  const floor = floorTime(timestamp, interval, utc);
  return floor === timestamp ? floor : offsetTime(floor, interval, utc);
}

function chooseTimeInterval(start: number, stop: number, count: number): TimeInterval {
  const target = Math.abs(stop - start) / normalizeCount(count);
  const final = TIME_INTERVALS[TIME_INTERVALS.length - 1]!;
  if (target > final.duration) {
    const years = target / final.duration;
    const step = Math.max(1, tickStep(0, years, 1));
    return { unit: "year", step, duration: final.duration * step };
  }

  let selected = TIME_INTERVALS[0]!;
  let distance = Math.abs(Math.log(target / selected.duration));
  for (const interval of TIME_INTERVALS.slice(1)) {
    const nextDistance = Math.abs(Math.log(target / interval.duration));
    if (nextDistance < distance) {
      selected = interval;
      distance = nextDistance;
    }
  }
  return selected;
}

function timeTicks(start: number, stop: number, count: number, utc: boolean): readonly Date[] {
  const reversed = stop < start;
  const minimum = reversed ? stop : start;
  const maximum = reversed ? start : stop;
  const interval = chooseTimeInterval(minimum, maximum, count);
  const ticks: Date[] = [];
  let current = ceilTime(minimum, interval, utc);
  let guard = 0;

  while (current <= maximum && guard < 10_000) {
    ticks.push(new Date(current));
    const next = offsetTime(current, interval, utc);
    if (next <= current) break;
    current = next;
    guard += 1;
  }

  if (reversed) ticks.reverse();
  return Object.freeze(ticks);
}

function createTimeScale(options: CreateScaleOptions, type: "time" | "utc"): ResolvedScale {
  const explicit = options.domain != null;
  const source = options.domain ?? options.values ?? [];
  let resolvedDomain = dateDomain(source, explicit);
  const count = normalizeCount(typeof options.nice === "number" ? options.nice : undefined);
  const utc = type === "utc";

  if (options.nice) {
    const start = resolvedDomain.values[0]!;
    const stop = resolvedDomain.values[1]!;
    const reversed = stop < start;
    const minimum = reversed ? stop : start;
    const maximum = reversed ? start : stop;
    const interval = chooseTimeInterval(minimum, maximum, count);
    const niceMinimum = floorTime(minimum, interval, utc);
    const niceMaximum = ceilTime(maximum, interval, utc);
    resolvedDomain = {
      ...resolvedDomain,
      values: reversed ? [niceMaximum, niceMinimum] : [niceMinimum, niceMaximum],
    };
  }

  const range = resolveNumericRange(options.range, options.reverse);
  const start = resolvedDomain.values[0]!;
  const stop = resolvedDomain.values[1]!;
  const domainDelta = stop - start;
  const shouldClamp = options.clamp ?? false;
  const unknownValue = options.unknown;
  const domain = freezeInputs([new Date(start), new Date(stop)]);
  const rangeValues = freezeOutputs(range);

  const normalize = (timestamp: number) => {
    const value = domainDelta === 0 ? 0.5 : (timestamp - start) / domainDelta;
    return shouldClamp ? clamp01(value) : value;
  };

  const scale: ResolvedScale = {
    name: options.name ?? options.channel ?? type,
    type,
    domain,
    range: rangeValues,
    clamp: shouldClamp,
    reverse: options.reverse ?? false,
    omittedValueCount: resolvedDomain.omitted,
    map(value) {
      const timestamp =
        value instanceof Date ? value.getTime() : typeof value === "number" ? value : NaN;
      if (!Number.isFinite(timestamp)) return unknownValue;
      return interpolateNumberRange(range, normalize(timestamp));
    },
    invert(value) {
      const normalized = uninterpolateNumberRange(range, value, shouldClamp);
      if (normalized == null) return undefined;
      const fraction = shouldClamp ? clamp01(normalized) : normalized;
      return new Date(start + domainDelta * fraction);
    },
    ticks(tickCount = 5) {
      return timeTicks(start, stop, normalizeCount(tickCount), utc);
    },
  };

  return Object.freeze(scale);
}

function createContinuousColorScale(options: CreateScaleOptions): ResolvedScale {
  const source = options.domain ?? options.values ?? [];
  const dateValues = inferValueKind(source) === "date";
  let resolvedDomain = dateValues
    ? dateDomain(source, options.domain != null)
    : options.domain
      ? numericDomain(source)
      : derivedNumericDomain(source);
  const count = normalizeCount(typeof options.nice === "number" ? options.nice : undefined);

  if (options.nice && !dateValues) {
    const nice = niceNumericDomain(resolvedDomain.values[0]!, resolvedDomain.values[1]!, count);
    resolvedDomain = { ...resolvedDomain, values: [...nice] };
  }

  const output = options.range.length > 0 ? options.range : DEFAULT_CONTINUOUS_COLORS;
  if (!output.every((value) => typeof value === "string")) {
    throw new TypeError("Continuous color scales require a string range.");
  }
  const colors = [...(output as readonly string[])];
  if (options.reverse) colors.reverse();

  const start = resolvedDomain.values[0]!;
  const stop = resolvedDomain.values[1]!;
  const delta = stop - start;
  const shouldClamp = options.clamp ?? true;
  const unknownValue = options.unknown;
  const domain = freezeInputs(dateValues ? [new Date(start), new Date(stop)] : [start, stop]);
  const range = freezeOutputs(colors);

  const scale: ResolvedScale = {
    name: options.name ?? options.channel ?? "color",
    type: "continuous-color",
    domain,
    range,
    clamp: shouldClamp,
    reverse: options.reverse ?? false,
    omittedValueCount: resolvedDomain.omitted,
    map(value) {
      const numeric =
        value instanceof Date ? value.getTime() : typeof value === "number" ? value : NaN;
      if (!Number.isFinite(numeric)) return unknownValue;
      const raw = delta === 0 ? 0.5 : (numeric - start) / delta;
      return interpolateColorRange(colors, raw, shouldClamp);
    },
    ticks(tickCount = 5) {
      return dateValues
        ? timeTicks(start, stop, normalizeCount(tickCount), false)
        : numericTicks(start, stop, normalizeCount(tickCount));
    },
  };

  return Object.freeze(scale);
}

function createNumericScale(
  options: CreateScaleOptions,
  type: "linear" | "power" | "log" | "symlog",
): ResolvedScale {
  if (
    type === "log" &&
    options.base !== undefined &&
    (!Number.isFinite(options.base) || options.base <= 0 || options.base === 1)
  ) {
    throw new RangeError("Log scale base must be finite, positive, and different from one.");
  }
  if (
    type === "power" &&
    options.exponent !== undefined &&
    (!Number.isFinite(options.exponent) || options.exponent <= 0)
  ) {
    throw new RangeError("Power scale exponent must be a finite positive number.");
  }
  if (
    type === "symlog" &&
    options.constant !== undefined &&
    (!Number.isFinite(options.constant) || options.constant <= 0)
  ) {
    throw new RangeError("Symlog scale constant must be a finite positive number.");
  }
  const explicit = options.domain != null;
  const source = options.domain ?? options.values ?? [];
  let resolvedDomain = explicit
    ? numericDomain(source, type === "log")
    : derivedNumericDomain(source, type === "log");
  const niceCount = normalizeCount(typeof options.nice === "number" ? options.nice : undefined);
  const base =
    Number.isFinite(options.base) && options.base! > 0 && options.base !== 1 ? options.base! : 10;
  const exponent =
    Number.isFinite(options.exponent) && options.exponent! > 0 ? options.exponent! : 1;
  const constant =
    Number.isFinite(options.constant) && options.constant! > 0 ? options.constant! : 1;

  if (options.nice) {
    if (type === "log") {
      const start = resolvedDomain.values[0]!;
      const stop = resolvedDomain.values[1]!;
      const reversed = stop < start;
      const minimum = reversed ? stop : start;
      const maximum = reversed ? start : stop;
      const niceMinimum = base ** Math.floor(Math.log(minimum) / Math.log(base));
      const niceMaximum = base ** Math.ceil(Math.log(maximum) / Math.log(base));
      resolvedDomain = {
        ...resolvedDomain,
        values: reversed ? [niceMaximum, niceMinimum] : [niceMinimum, niceMaximum],
      };
    } else {
      const nice = niceNumericDomain(
        resolvedDomain.values[0]!,
        resolvedDomain.values[1]!,
        niceCount,
      );
      resolvedDomain = { ...resolvedDomain, values: [...nice] };
    }
  }

  const range = resolveNumericRange(options.range, options.reverse);
  const start = resolvedDomain.values[0]!;
  const stop = resolvedDomain.values[1]!;
  const transform =
    type === "power"
      ? (value: number) => transformPower(value, exponent)
      : type === "log"
        ? (value: number) => Math.log(value) / Math.log(base)
        : type === "symlog"
          ? (value: number) => transformSymlog(value, constant)
          : (value: number) => value;
  const untransform =
    type === "power"
      ? (value: number) => untransformPower(value, exponent)
      : type === "log"
        ? (value: number) => base ** value
        : type === "symlog"
          ? (value: number) => untransformSymlog(value, constant)
          : (value: number) => value;
  const transformedStart = transform(start);
  const transformedStop = transform(stop);
  const transformedDelta = transformedStop - transformedStart;
  const shouldClamp = options.clamp ?? false;
  const unknownValue = options.unknown;
  const domain = freezeInputs([start, stop]);
  const rangeValues = freezeOutputs(range);

  const scale: ResolvedScale = {
    name: options.name ?? options.channel ?? type,
    type,
    domain,
    range: rangeValues,
    clamp: shouldClamp,
    reverse: options.reverse ?? false,
    omittedValueCount: resolvedDomain.omitted,
    map(value) {
      if (!isFiniteNumber(value) || (type === "log" && value <= 0)) return unknownValue;
      const transformed = transform(value);
      const raw =
        transformedDelta === 0 ? 0.5 : (transformed - transformedStart) / transformedDelta;
      return interpolateNumberRange(range, shouldClamp ? clamp01(raw) : raw);
    },
    invert(value) {
      const normalized = uninterpolateNumberRange(range, value, shouldClamp);
      if (normalized == null) return undefined;
      const fraction = shouldClamp ? clamp01(normalized) : normalized;
      return untransform(transformedStart + transformedDelta * fraction);
    },
    ticks(tickCount = 5) {
      return type === "log"
        ? logTicks(start, stop, normalizeCount(tickCount), base)
        : numericTicks(start, stop, normalizeCount(tickCount));
    },
  };

  return Object.freeze(scale);
}

export function createScale(options: CreateScaleOptions): ResolvedScale {
  const source = options.domain ?? options.values ?? [];
  const inferredChannel =
    options.channel ??
    (options.range.length > 0 && options.range.every((value) => typeof value === "string")
      ? "color"
      : undefined);
  const type = options.type ?? inferScaleType(source, inferredChannel);

  if (type === "band" || type === "point" || type === "ordinal-color") {
    return createCategoricalScale(options, type);
  }
  if (type === "time" || type === "utc") return createTimeScale(options, type);
  if (type === "continuous-color") return createContinuousColorScale(options);
  return createNumericScale(options, type);
}
