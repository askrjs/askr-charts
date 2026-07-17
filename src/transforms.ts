import { isChannelExpression, isRowTransform } from "./expressions";
import type {
  BinOptions,
  ChannelExpression,
  PlotChannelValue,
  PlotKey,
  RowTransform,
  ScaleValue,
  StackOptions,
  WindowOperation,
} from "./model";

export interface Bin {
  readonly x0: number;
  readonly x1: number;
  readonly indices: readonly number[];
}

export interface StackDatum<Key = unknown, Series = unknown> {
  readonly key: Key;
  readonly series: Series;
  readonly value: number;
  readonly index: number;
}

export interface StackedDatum<Key = unknown, Series = unknown> extends StackDatum<Key, Series> {
  readonly y0: number;
  readonly y1: number;
}

export interface RegressionResult {
  readonly slope: number;
  readonly intercept: number;
  readonly r2: number;
  readonly predict: (x: number) => number;
}

export interface PartitionDatum<Row> {
  readonly row: Row;
  readonly id: PlotKey;
  readonly parentId: PlotKey | null;
  readonly depth: number;
  readonly value: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function toComparableNumber(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return isFiniteNumber(value) ? value : null;
}

export function readChannel<Row>(
  row: Readonly<Row>,
  index: number,
  input: unknown,
): PlotChannelValue {
  if (typeof input === "function") {
    return (input as (value: Readonly<Row>, position: number) => PlotChannelValue)(row, index);
  }
  if (typeof input === "string") {
    return (row as Record<string, PlotChannelValue>)[input];
  }
  if (!isChannelExpression(input)) return undefined;

  switch (input.kind) {
    case "constant":
      return input.options.value as PlotChannelValue;
    case "count":
      return 1;
    case "bin":
    case "sum":
    case "mean":
    case "group":
    case "stack":
    case "normalize":
    case "moving-window":
    case "moving-average":
    case "regression":
      return readChannel<Row>(row, index, input.input);
  }
}

export function evaluateChannel<Row>(rows: readonly Row[], input: unknown): readonly unknown[] {
  if (!isChannelExpression(input)) {
    return Object.freeze(rows.map((row, index) => readChannel<Row>(row, index, input)));
  }

  if (input.kind === "moving-window" || input.kind === "moving-average") {
    const source = rows.map((row, index) => {
      const value = readChannel<Row>(row, index, input.input);
      return isFiniteNumber(value) ? value : null;
    });
    return movingWindowValues(source, {
      window: Number(input.options.window),
      operation:
        input.kind === "moving-average"
          ? "mean"
          : ((input.options.operation as WindowOperation | undefined) ?? "mean"),
      partial: input.options.partial !== false,
    });
  }

  if (input.kind === "regression") {
    const y = rows.map((row, index) =>
      toComparableNumber(readChannel<Row>(row, index, input.input)),
    );
    const xInput = input.options.x;
    const x = rows.map((row, index) =>
      xInput === undefined ? index : toComparableNumber(readChannel<Row>(row, index, xInput)),
    );
    const regression = linearRegression(x, y);
    return Object.freeze(x.map((value) => (value == null ? null : regression.predict(value))));
  }

  return Object.freeze(rows.map((row, index) => readChannel<Row>(row, index, input)));
}

export function applyRowTransforms<Row>(
  rows: readonly Row[],
  transforms: RowTransform<Row> | readonly RowTransform<Row>[] | undefined,
): readonly Row[] {
  if (!transforms) return rows;
  const list = Array.isArray(transforms) ? transforms : [transforms];
  if (list.length === 0) return rows;
  let result = [...rows];

  for (const descriptor of list) {
    if (!isRowTransform<Row>(descriptor)) {
      throw new TypeError("Invalid plot row transform.");
    }
    if (descriptor.kind === "filter") {
      const predicate = descriptor.options.predicate as (
        row: Readonly<Row>,
        index: number,
      ) => boolean;
      result = result.filter(predicate);
    } else if (descriptor.kind === "sort") {
      const by = descriptor.options.by;
      const direction = descriptor.options.direction === "descending" ? -1 : 1;
      result = result
        .map((row, index) => ({
          row,
          index,
          value: readChannel<Row>(row, index, by),
        }))
        .sort((left, right) => {
          const order = compareValues(left.value, right.value);
          return order === 0 ? left.index - right.index : order * direction;
        })
        .map(({ row }) => row);
    }
  }

  return Object.freeze(result);
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

export function createBins(
  values: readonly (number | Date | null | undefined)[],
  options: BinOptions = {},
): readonly Bin[] {
  const numeric = values.map(toComparableNumber);
  const finite = numeric.filter((value): value is number => value !== null);
  if (finite.length === 0) return Object.freeze([]);

  const explicitDomain = options.domain?.map(toComparableNumber);
  let detectedMin = Number.POSITIVE_INFINITY;
  let detectedMax = Number.NEGATIVE_INFINITY;
  for (const value of finite) {
    if (value < detectedMin) detectedMin = value;
    if (value > detectedMax) detectedMax = value;
  }
  let min = explicitDomain?.[0] ?? detectedMin;
  let max = explicitDomain?.[1] ?? detectedMax;
  if (min == null || max == null) return Object.freeze([]);
  if (max < min) [min, max] = [max, min];
  if (max === min) {
    const padding = Math.abs(min || 1) * 0.5;
    min -= padding;
    max += padding;
  }

  let thresholds: number[];
  if (Array.isArray(options.thresholds)) {
    thresholds = options.thresholds
      .filter(isFiniteNumber)
      .filter((value) => value > min && value < max)
      .sort((left, right) => left - right);
  } else {
    const requested =
      options.interval && options.interval > 0
        ? Math.ceil((max - min) / options.interval)
        : typeof options.thresholds === "number"
          ? options.thresholds
          : sturgesThreshold(finite.length);
    const count = Math.max(1, Math.floor(requested));
    const step =
      options.interval && options.interval > 0 ? options.interval : niceStep(max - min, count);
    const first = options.interval ? min : Math.floor(min / step) * step;
    const last = options.interval ? max : Math.ceil(max / step) * step;
    min = first;
    max = last;
    thresholds = [];
    for (let value = first + step; value < last && thresholds.length < 10_000; value += step) {
      thresholds.push(value);
    }
  }

  const edges = [min, ...thresholds, max];
  const bins = edges.slice(0, -1).map((x0, index) => ({
    x0,
    x1: edges[index + 1]!,
    indices: [] as number[],
  }));

  for (let index = 0; index < numeric.length; index += 1) {
    const value = numeric[index];
    if (value == null || value < min || value > max) continue;
    const binIndex = value === max ? bins.length - 1 : bisectRight(thresholds, value);
    bins[binIndex]?.indices.push(index);
  }

  return Object.freeze(
    bins.map((bin) => Object.freeze({ ...bin, indices: Object.freeze(bin.indices) })),
  );
}

function bisectRight(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (value < sorted[middle]!) high = middle;
    else low = middle + 1;
  }
  return low;
}

function sturgesThreshold(length: number): number {
  return Math.max(1, Math.ceil(Math.log2(length)) + 1);
}

function niceStep(span: number, count: number): number {
  const raw = Math.abs(span) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const error = raw / power;
  const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
  return factor * power;
}

export function aggregateBy<Key>(
  values: readonly (number | null | undefined)[],
  keys: readonly Key[],
  operation: "count" | "sum" | "mean",
): ReadonlyMap<Key, number> {
  const groups = new Map<Key, { sum: number; count: number }>();
  for (let index = 0; index < keys.length; index += 1) {
    const value = values[index];
    if (operation !== "count" && !isFiniteNumber(value)) continue;
    const group = groups.get(keys[index]!) ?? { sum: 0, count: 0 };
    group.count += 1;
    if (isFiniteNumber(value)) group.sum += value;
    groups.set(keys[index]!, group);
  }
  return new Map(
    [...groups].map(([key, group]) => [
      key,
      operation === "count"
        ? group.count
        : operation === "mean"
          ? group.sum / group.count
          : group.sum,
    ]),
  );
}

export function stackValues<Key, Series>(
  data: readonly StackDatum<Key, Series>[],
  options: StackOptions = {},
): readonly StackedDatum<Key, Series>[] {
  const grouped = new Map<Key, StackDatum<Key, Series>[]>();
  for (const datum of data) {
    if (!isFiniteNumber(datum.value)) continue;
    const group = grouped.get(datum.key) ?? [];
    group.push(datum);
    grouped.set(datum.key, group);
  }

  const result: StackedDatum<Key, Series>[] = [];
  for (const group of grouped.values()) {
    const ordered = orderStack(group, options.order ?? "none");
    if (options.offset === "zero") {
      let cursor = 0;
      for (const datum of ordered) {
        const y0 = cursor;
        cursor += datum.value;
        result.push(Object.freeze({ ...datum, y0, y1: cursor }));
      }
      continue;
    }
    const positiveTotal = ordered.reduce((total, datum) => total + Math.max(0, datum.value), 0);
    const negativeTotal = ordered.reduce(
      (total, datum) => total + Math.abs(Math.min(0, datum.value)),
      0,
    );
    let positive = 0;
    let negative = 0;
    for (const datum of ordered) {
      const divisor =
        options.offset === "expand"
          ? datum.value < 0
            ? negativeTotal || 1
            : positiveTotal || 1
          : 1;
      const value = datum.value / divisor;
      const y0 = value < 0 ? negative : positive;
      const y1 = y0 + value;
      if (value < 0) negative = y1;
      else positive = y1;
      result.push(Object.freeze({ ...datum, y0, y1 }));
    }
  }

  result.sort((left, right) => left.index - right.index);
  return Object.freeze(result);
}

function orderStack<Key, Series>(
  data: readonly StackDatum<Key, Series>[],
  order: NonNullable<StackOptions["order"]>,
): StackDatum<Key, Series>[] {
  if (order === "none") return [...data];
  const sorted = [...data].sort((left, right) => left.value - right.value);
  if (order === "descending") sorted.reverse();
  if (order !== "inside-out") return sorted;
  const result: StackDatum<Key, Series>[] = [];
  let left = 0;
  let right = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const datum = sorted[index]!;
    if (left <= right) {
      result.unshift(datum);
      left += Math.abs(datum.value);
    } else {
      result.push(datum);
      right += Math.abs(datum.value);
    }
  }
  return result;
}

export function movingWindowValues(
  values: readonly (number | null | undefined)[],
  options: { window: number; operation?: WindowOperation; partial?: boolean },
): readonly (number | null)[] {
  const window = Math.max(1, Math.floor(options.window));
  const operation = options.operation ?? "mean";
  const partial = options.partial !== false;
  const result: (number | null)[] = Array.from({ length: values.length }, () => null);

  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - window + 1);
    if (!partial && index - start + 1 < window) {
      result[index] = null;
      continue;
    }
    let sum = 0;
    let count = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let cursor = start; cursor <= index; cursor += 1) {
      const value = values[cursor];
      if (!isFiniteNumber(value)) continue;
      sum += value;
      count += 1;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    result[index] =
      count === 0
        ? null
        : operation === "sum"
          ? sum
          : operation === "min"
            ? min
            : operation === "max"
              ? max
              : sum / count;
  }

  return Object.freeze(result);
}

export function linearRegression(
  xValues: readonly (number | null | undefined)[],
  yValues: readonly (number | null | undefined)[],
): RegressionResult {
  let count = 0;
  let meanX = 0;
  let meanY = 0;
  let covariance = 0;
  let varianceX = 0;
  for (let index = 0; index < Math.min(xValues.length, yValues.length); index += 1) {
    const x = xValues[index];
    const y = yValues[index];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
    count += 1;
    const dx = x - meanX;
    meanX += dx / count;
    const dy = y - meanY;
    meanY += dy / count;
    covariance += dx * (y - meanY);
    varianceX += dx * (x - meanX);
  }

  const slope = count > 1 && varianceX !== 0 ? covariance / varianceX : 0;
  const intercept = meanY - slope * meanX;
  let residual = 0;
  let total = 0;
  for (let index = 0; index < Math.min(xValues.length, yValues.length); index += 1) {
    const x = xValues[index];
    const y = yValues[index];
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
    residual += (y - (slope * x + intercept)) ** 2;
    total += (y - meanY) ** 2;
  }

  return Object.freeze({
    slope,
    intercept,
    r2: total === 0 ? 1 : Math.max(0, 1 - residual / total),
    predict: (x: number) => meanY + slope * (x - meanX),
  });
}

export function partitionRows<Row>(
  rows: readonly Row[],
  options: {
    id: unknown;
    parentId?: unknown;
    children?: unknown;
    value: unknown;
    padding?: number;
  },
): readonly PartitionDatum<Row>[] {
  type Node = {
    row: Row;
    sourceIndex: number;
    id: PlotKey;
    parentId: PlotKey | null;
    ownValue: number;
    value: number;
    children: Node[];
  };

  const nodes = new Map<PlotKey, Node>();
  const roots: Node[] = [];
  const visitNested = (row: Row, sourceIndex: number, parentId: PlotKey | null): Node => {
    const idValue = readChannel<Row>(row, sourceIndex, options.id);
    if (typeof idValue !== "string" && typeof idValue !== "number") {
      throw new TypeError(`Partition id must be a string or number at row ${sourceIndex}.`);
    }
    if (nodes.has(idValue)) throw new Error(`Duplicate partition id ${String(idValue)}.`);
    const ownValue = readChannel<Row>(row, sourceIndex, options.value);
    const node: Node = {
      row,
      sourceIndex,
      id: idValue,
      parentId,
      ownValue: isFiniteNumber(ownValue) ? Math.max(0, ownValue) : 0,
      value: 0,
      children: [],
    };
    nodes.set(idValue, node);
    if (options.children !== undefined) {
      const children = readChannel<Row>(row, sourceIndex, options.children);
      if (Array.isArray(children)) {
        node.children = children.map((child, childIndex) =>
          visitNested(child as Row, childIndex, idValue),
        );
      }
    }
    return node;
  };

  if (options.children !== undefined) {
    rows.forEach((row, index) => roots.push(visitNested(row, index, null)));
  } else {
    rows.forEach((row, index) => {
      const id = readChannel<Row>(row, index, options.id);
      const parent =
        options.parentId === undefined ? null : readChannel<Row>(row, index, options.parentId);
      if (typeof id !== "string" && typeof id !== "number") {
        throw new TypeError(`Partition id must be a string or number at row ${index}.`);
      }
      if (nodes.has(id)) throw new Error(`Duplicate partition id ${String(id)}.`);
      const rawValue = readChannel<Row>(row, index, options.value);
      nodes.set(id, {
        row,
        sourceIndex: index,
        id,
        parentId: typeof parent === "string" || typeof parent === "number" ? parent : null,
        ownValue: isFiniteNumber(rawValue) ? Math.max(0, rawValue) : 0,
        value: 0,
        children: [],
      });
    });
    for (const node of nodes.values()) {
      const parent = node.parentId == null ? undefined : nodes.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    if (roots.length === 0 && nodes.size > 0) {
      throw new Error("Partition cycle detected: no root node exists.");
    }
  }

  const seen = new Set<PlotKey>();
  const visited = new Set<PlotKey>();
  const total = (node: Node): number => {
    if (seen.has(node.id)) throw new Error(`Partition cycle detected at ${String(node.id)}.`);
    seen.add(node.id);
    const childrenTotal = node.children.reduce((sum, child) => sum + total(child), 0);
    seen.delete(node.id);
    visited.add(node.id);
    node.value = Math.max(node.ownValue, childrenTotal);
    return node.value;
  };
  roots.forEach(total);
  if (visited.size !== nodes.size) {
    throw new Error("Partition cycle detected among disconnected nodes.");
  }
  const maxDepth = findMaxDepth(roots, 0);
  const padding = Math.max(0, Number(options.padding) || 0);
  const result: PartitionDatum<Row>[] = [];
  const layout = (nodesAtDepth: readonly Node[], x0: number, x1: number, depth: number) => {
    const totalValue =
      nodesAtDepth.reduce((sum, node) => sum + node.value, 0) || nodesAtDepth.length;
    let cursor = x0;
    for (const node of nodesAtDepth) {
      const span = (x1 - x0) * ((node.value || 1) / totalValue);
      const next = cursor + span;
      const inset = Math.min(padding / 2, span / 2);
      result.push(
        Object.freeze({
          row: node.row,
          id: node.id,
          parentId: node.parentId,
          depth,
          value: node.value,
          x0: cursor + inset,
          x1: next - inset,
          y0: depth / (maxDepth + 1),
          y1: (depth + 1) / (maxDepth + 1),
        }),
      );
      if (node.children.length > 0) layout(node.children, cursor, next, depth + 1);
      cursor = next;
    }
  };
  layout(roots, 0, 1, 0);
  return Object.freeze(result);
}

function findMaxDepth<Row>(nodes: readonly { children: readonly Row[] }[], depth: number): number {
  let maximum = depth;
  for (const node of nodes) {
    if (node.children.length > 0) {
      maximum = Math.max(
        maximum,
        findMaxDepth(node.children as readonly { children: readonly Row[] }[], depth + 1),
      );
    }
  }
  return maximum;
}

export function validScaleValue(value: unknown): value is ScaleValue {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return typeof value === "string" || isFiniteNumber(value);
}

export function expressionOperation(
  input: unknown,
): ChannelExpression<unknown, string>["kind"] | null {
  return isChannelExpression(input) ? input.kind : null;
}
