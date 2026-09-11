import type { PlotDescriptor } from "../descriptors";
import { isChannelExpression, isRowTransform } from "../expressions";
import type { PlotKey, PlotRowKey, StackOptions } from "../model";
import { readRowKey } from "../rows";
import type { ResolvedScale, ScaleInput } from "../scales";
import type { HitRegion, SceneMark } from "../scene-model";
import {
  applyRowTransforms,
  createBins,
  evaluateChannel,
  isFiniteNumber,
  partitionRows,
  readChannel,
  stackValues,
  validScaleValue,
} from "../transforms";
import {
  boundMeterValue,
  channelSeries,
  isConstant,
  type MappedAreaDatum,
  type MarkKind,
  type PreparedDatum,
  type PreparedMark,
  type ScaleUse,
} from "./shared";
import { compileBars } from "./marks/bars";
import { compileLines } from "./marks/lines";
import { compileAreas } from "./marks/areas";
import { compilePoints } from "./marks/points";
import { compileArcs } from "./marks/arcs";
import { compileCells } from "./marks/cells";
import { compileRects } from "./marks/rects";
import { compileRules } from "./marks/rules";
import { compileTexts } from "./marks/texts";

export type { MarkKind, MappedAreaDatum, PreparedDatum, PreparedMark, ScaleUse };

export function prepareMark<Row>(
  descriptor: PlotDescriptor<Record<string, unknown>>,
  ordinal: number,
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByKey: ReadonlyMap<PlotKey, number>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
  omittedKeys: Set<PlotKey>,
): PreparedMark<Row> {
  const kind = descriptor.kind as MarkKind;
  const props = descriptor.props;
  const dataSource = props.data;
  const markRows = Array.isArray(dataSource)
    ? (dataSource as readonly Row[])
    : typeof dataSource === "function"
      ? ((dataSource as () => readonly Row[])() ?? [])
      : rootRows;
  const transforms = props.transform;
  const transformList =
    transforms == null ? [] : Array.isArray(transforms) ? transforms : [transforms];
  for (const candidate of transformList) {
    if (
      !isRowTransform<Row>(candidate) ||
      (candidate.kind !== "filter" && candidate.kind !== "sort" && candidate.kind !== "partition")
    ) {
      throw new TypeError("Invalid plot row transform.");
    }
    if (candidate.kind === "filter" && typeof candidate.options.predicate !== "function") {
      throw new TypeError("A filter transform requires a predicate function.");
    }
    if (
      candidate.kind === "sort" &&
      candidate.options.direction != null &&
      candidate.options.direction !== "ascending" &&
      candidate.options.direction !== "descending"
    ) {
      throw new TypeError(`Invalid sort direction ${String(candidate.options.direction)}.`);
    }
  }
  const partitionIndices = transformList.flatMap((candidate, index) =>
    candidate.kind === "partition" ? [index] : [],
  );
  if (partitionIndices.length > 1) {
    throw new TypeError("A mark may contain at most one partition transform.");
  }
  const partitionIndex = partitionIndices[0] ?? -1;
  const partition = partitionIndex < 0 ? undefined : transformList[partitionIndex];
  if (partition && kind !== "Rect") {
    throw new TypeError("Only Rect marks support the partition transform.");
  }
  if (partition && partitionIndex !== transformList.length - 1) {
    throw new TypeError("The partition transform must be last.");
  }
  if (kind === "Rect" && partition) {
    const precedingTransforms = transformList.slice(0, partitionIndex);
    const partitionRowsInput = applyRowTransforms(markRows, precedingTransforms);
    const partitioned = partitionRows(partitionRowsInput, {
      id: partition.options.id,
      parentId: partition.options.parentId,
      children: partition.options.children,
      value: partition.options.value,
      padding: partition.options.padding as number | undefined,
    });
    return Object.freeze({
      kind,
      props,
      ordinal,
      directSourceIdentity: false,
      data: Object.freeze(
        partitioned.map((datum, index) => {
          const source = sourceIdentity(datum.row, rootRows, rowKey, sourceIndexByRow);
          return Object.freeze({
            row: datum.row,
            sourceIndex: source?.sourceIndex ?? index,
            sourceKeys: Object.freeze(source ? [source.key] : []),
            key: datum.id,
            x: datum.x0,
            x2: datum.x1,
            y: datum.y0,
            y2: datum.y1,
            value: datum.value,
            fillValue: readChannel<Row>(datum.row, index, props.fill),
            strokeValue: readChannel<Row>(datum.row, index, props.stroke),
            titleValue: readChannel<Row>(datum.row, index, props.title),
            series: channelSeries(readChannel<Row>(datum.row, index, props.fill)),
            values: Object.freeze({
              x: datum.x0,
              x2: datum.x1,
              y: datum.y0,
              y2: datum.y1,
              value: datum.value,
              depth: datum.depth,
            }),
          });
        }),
      ),
    });
  }

  const applicableTransforms = transformList;
  const rows = applyRowTransforms(markRows, applicableTransforms);
  if (
    (kind === "Bar" || kind === "Area") &&
    isChannelExpression(props.x) &&
    props.x.kind === "bin"
  ) {
    return Object.freeze({
      kind,
      props,
      ordinal,
      directSourceIdentity: false,
      data: prepareBinnedData(
        rows,
        rootRows,
        rowKey,
        sourceIndexByKey,
        sourceIndexByRow,
        props,
        omittedKeys,
      ),
    });
  }
  if (
    (kind === "Bar" || kind === "Area") &&
    isChannelExpression(props.y) &&
    (props.y.kind === "count" || props.y.kind === "sum" || props.y.kind === "mean")
  ) {
    return Object.freeze({
      kind,
      props,
      ordinal,
      directSourceIdentity: false,
      data: prepareAggregatedData(
        rows,
        rootRows,
        rowKey,
        sourceIndexByKey,
        sourceIndexByRow,
        props,
        omittedKeys,
      ),
    });
  }

  const evaluate = (input: unknown) =>
    requiresSequenceEvaluation(input) ? evaluateChannel(rows, input) : null;
  const fillInput = props.fill ?? props.category;
  const evaluated = {
    x: evaluate(props.x),
    x2: evaluate(props.x2),
    y: evaluate(props.y),
    y2: evaluate(props.y2),
    value: evaluate(props.value),
    radius: evaluate(props.r),
    fill: evaluate(fillInput),
    stroke: evaluate(props.stroke),
    title: evaluate(props.title),
    text: evaluate(props.text),
    defined: evaluate(props.defined),
  };
  const directSourceRows = rows === rootRows;
  let prepared = rows.map((row, index): PreparedDatum<Row> => {
    const sourceIndex = directSourceRows ? index : sourceIndexByRow.get(row);
    const sourceKey =
      sourceIndex === undefined
        ? undefined
        : readRowKey(rootRows[sourceIndex]!, sourceIndex, rowKey);
    const key =
      props.key == null
        ? (sourceKey ?? safeKey(row, index, rowKey))
        : safeKey(row, index, props.key);
    const x = evaluatedValue(row, index, props.x, evaluated.x);
    const x2 = evaluatedValue(row, index, props.x2, evaluated.x2);
    const y = evaluatedValue(row, index, props.y, evaluated.y);
    const y2 = evaluatedValue(row, index, props.y2, evaluated.y2);
    const value = evaluatedValue(row, index, props.value, evaluated.value);
    const radius = evaluatedValue(row, index, props.r, evaluated.radius);
    const fillValue = evaluatedValue(row, index, fillInput, evaluated.fill);
    const strokeValue = evaluatedValue(row, index, props.stroke, evaluated.stroke);
    const titleValue = evaluatedValue(row, index, props.title, evaluated.title);
    return {
      row,
      sourceIndex: sourceIndex ?? sourceIndexByKey.get(key) ?? -1,
      sourceKeys: Object.freeze(sourceKey === undefined ? [] : [sourceKey]),
      key,
      x,
      x2,
      y,
      y2,
      value,
      radius,
      fillValue,
      strokeValue,
      titleValue,
      textValue: evaluatedValue(row, index, props.text, evaluated.text),
      series: resolveSeries(row, index, props),
      defined:
        kind === "Line"
          ? props.defined == null ||
            evaluatedValue(row, index, props.defined, evaluated.defined) === true
          : undefined,
      values: Object.freeze({
        x,
        x2,
        y,
        y2,
        value,
      }),
      visible: false,
    };
  });

  prepared = prepared.filter((datum) => {
    const valid = requiredChannelsValid(kind, datum, props);
    if (!valid) omittedKeys.add(datum.key);
    // A deliberately undefined line datum is still needed as a run separator, even when
    // the accessor is guarding a missing x/y channel.
    return valid || (kind === "Line" && datum.defined === false);
  });
  const yOperation = isChannelExpression(props.y) ? props.y.kind : null;
  let directSourceIdentity = directSourceRows && props.key == null;
  if (
    (kind === "Bar" || kind === "Area") &&
    (props.stack || yOperation === "stack" || yOperation === "normalize")
  ) {
    prepared = applyPreparedStack(prepared, resolveStackOptions(props));
    directSourceIdentity = false;
  }
  return Object.freeze({
    kind,
    props,
    ordinal,
    directSourceIdentity,
    data: Object.freeze(prepared),
  });
}

function requiresSequenceEvaluation(input: unknown): boolean {
  return (
    isChannelExpression(input) &&
    (input.kind === "moving-window" ||
      input.kind === "moving-average" ||
      input.kind === "regression")
  );
}

function evaluatedValue<Row>(
  row: Row,
  index: number,
  input: unknown,
  evaluated: readonly unknown[] | null,
): unknown {
  if (evaluated) return evaluated[index];
  return input == null ? undefined : readChannel<Row>(row, index, input);
}

export function prepareBinnedData<Row>(
  rows: readonly Row[],
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByKey: ReadonlyMap<PlotKey, number>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
  props: Readonly<Record<string, unknown>>,
  omittedKeys: Set<PlotKey>,
): readonly PreparedDatum<Row>[] {
  const xExpression = props.x as {
    input?: unknown;
    options: Readonly<Record<string, unknown>>;
  };
  const rawX = rows.map((row, index) => readChannel<Row>(row, index, xExpression.input));
  for (let index = 0; index < rawX.length; index += 1) {
    const value = rawX[index];
    const valid = value instanceof Date ? Number.isFinite(value.getTime()) : isFiniteNumber(value);
    if (!valid)
      omittedKeys.add(
        sourceKeyForDatum(rows[index]!, index, rootRows, rowKey, sourceIndexByRow, props.key),
      );
  }
  const wasDate = rawX.some((value) => value instanceof Date);
  const bins = createBins(
    rawX.map((value) => (value instanceof Date || typeof value === "number" ? value : null)),
    xExpression.options,
  );
  const groups = new Map<
    string,
    { bin: (typeof bins)[number]; series: string | null; indices: number[] }
  >();
  for (const bin of bins) {
    for (const index of bin.indices) {
      const row = rows[index]!;
      const series = resolveSeries(row, index, props);
      const groupKey = compositeIdentity(serializeValue(bin.x0), serializeValue(bin.x1), series);
      const group = groups.get(groupKey) ?? { bin, series, indices: [] };
      group.indices.push(index);
      groups.set(groupKey, group);
    }
  }
  const result: PreparedDatum<Row>[] = [];
  const yExpression = isChannelExpression(props.y)
    ? (props.y as import("../model").ChannelExpression<number, string>)
    : null;
  for (const group of groups.values()) {
    const contributingIndices = aggregateContributionIndices(rows, group.indices, yExpression);
    const contributingIndexSet = new Set(contributingIndices);
    for (const index of group.indices) {
      if (!contributingIndexSet.has(index)) {
        omittedKeys.add(
          sourceKeyForDatum(rows[index]!, index, rootRows, rowKey, sourceIndexByRow, props.key),
        );
      }
    }
    const rowIndex = contributingIndices[0] ?? group.indices[0]!;
    const row = rows[rowIndex]!;
    const value = aggregateIndices(rows, group.indices, yExpression);
    const key = compositeIdentity(
      serializeValue(group.bin.x0),
      serializeValue(group.bin.x1),
      group.series,
    );
    const source = sourceIdentity(row, rootRows, rowKey, sourceIndexByRow);
    const sourceKey = sourceKeyForDatum(
      row,
      rowIndex,
      rootRows,
      rowKey,
      sourceIndexByRow,
      props.key,
    );
    const sourceKeys = lineageKeys(rows, contributingIndices, rootRows, rowKey, sourceIndexByRow);
    if (!isFiniteNumber(value)) {
      omittedKeys.add(sourceKey);
      continue;
    }
    const x0 = wasDate ? new Date(group.bin.x0) : group.bin.x0;
    const x1 = wasDate ? new Date(group.bin.x1) : group.bin.x1;
    result.push(
      Object.freeze({
        row,
        sourceIndex: source?.sourceIndex ?? sourceIndexByKey.get(sourceKey) ?? -1,
        sourceKeys,
        key,
        x: wasDate
          ? new Date((group.bin.x0 + group.bin.x1) / 2)
          : (group.bin.x0 + group.bin.x1) / 2,
        y: value,
        bin0: x0,
        bin1: x1,
        fillValue: readChannel<Row>(row, rowIndex, props.fill ?? props.category),
        strokeValue: readChannel<Row>(row, rowIndex, props.stroke),
        titleValue: readChannel<Row>(row, rowIndex, props.title),
        series: group.series,
        values: Object.freeze({ x0, x1, y: value, series: group.series }),
      }),
    );
  }
  return Object.freeze(
    props.stack || yExpression?.kind === "stack" || yExpression?.kind === "normalize"
      ? applyPreparedStack(result, resolveStackOptions(props))
      : result,
  );
}

export function prepareAggregatedData<Row>(
  rows: readonly Row[],
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByKey: ReadonlyMap<PlotKey, number>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
  props: Readonly<Record<string, unknown>>,
  omittedKeys: Set<PlotKey>,
): readonly PreparedDatum<Row>[] {
  const groups = new Map<string, { x: unknown; series: string | null; indices: number[] }>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const x = readChannel<Row>(row, index, props.x);
    if (!validScaleValue(x)) {
      omittedKeys.add(sourceKeyForDatum(row, index, rootRows, rowKey, sourceIndexByRow, props.key));
      continue;
    }
    const series = resolveSeries(row, index, props);
    const groupKey = compositeIdentity(serializeValue(x), series);
    const group = groups.get(groupKey) ?? { x, series, indices: [] };
    group.indices.push(index);
    groups.set(groupKey, group);
  }
  const yExpression = props.y as import("../model").ChannelExpression<number, string>;
  const result: PreparedDatum<Row>[] = [];
  for (const group of groups.values()) {
    const contributingIndices = aggregateContributionIndices(rows, group.indices, yExpression);
    const contributingIndexSet = new Set(contributingIndices);
    for (const candidate of group.indices) {
      if (!contributingIndexSet.has(candidate)) {
        omittedKeys.add(
          sourceKeyForDatum(
            rows[candidate]!,
            candidate,
            rootRows,
            rowKey,
            sourceIndexByRow,
            props.key,
          ),
        );
      }
    }
    const index = contributingIndices[0] ?? group.indices[0]!;
    const row = rows[index]!;
    const source = sourceIdentity(row, rootRows, rowKey, sourceIndexByRow);
    const sourceKey = sourceKeyForDatum(row, index, rootRows, rowKey, sourceIndexByRow, props.key);
    const sourceKeys = lineageKeys(rows, contributingIndices, rootRows, rowKey, sourceIndexByRow);
    const y = aggregateIndices(rows, group.indices, yExpression);
    if (!isFiniteNumber(y)) {
      omittedKeys.add(sourceKey);
      continue;
    }
    result.push(
      Object.freeze({
        row,
        sourceIndex: source?.sourceIndex ?? sourceIndexByKey.get(sourceKey) ?? -1,
        sourceKeys,
        key: compositeIdentity(serializeValue(group.x), group.series),
        x: group.x,
        y,
        fillValue: readChannel<Row>(row, index, props.fill ?? props.category),
        strokeValue: readChannel<Row>(row, index, props.stroke),
        titleValue: readChannel<Row>(row, index, props.title),
        series: group.series,
        values: Object.freeze({ x: group.x, y, series: group.series }),
      }),
    );
  }
  return Object.freeze(
    props.stack ? applyPreparedStack(result, resolveStackOptions(props)) : result,
  );
}

function aggregateIndices<Row>(
  rows: readonly Row[],
  indices: readonly number[],
  expression: import("../model").ChannelExpression<number, string> | null,
): number {
  if (!expression || expression.kind === "count") return indices.length;
  let sum = 0;
  let count = 0;
  for (const index of indices) {
    const value = readChannel<Row>(rows[index]!, index, expression.input);
    if (!isFiniteNumber(value)) continue;
    sum += value;
    count += 1;
  }
  if (count === 0) return Number.NaN;
  return expression.kind === "mean" ? sum / count : sum;
}

function aggregateContributionIndices<Row>(
  rows: readonly Row[],
  indices: readonly number[],
  expression: import("../model").ChannelExpression<number, string> | null,
): readonly number[] {
  if (!expression || expression.kind === "count") return indices;
  return indices.filter((index) =>
    isFiniteNumber(readChannel<Row>(rows[index]!, index, expression.input)),
  );
}

function applyPreparedStack<Row>(
  data: readonly PreparedDatum<Row>[],
  options: StackOptions,
): PreparedDatum<Row>[] {
  const stacked = stackValues(
    data.map((datum, index) => ({
      key: serializeValue(datum.x),
      series: datum.series ?? String(index),
      value: Number(datum.y),
      index,
    })),
    options,
  );
  const stackedByIndex = new Map(stacked.map((datum) => [datum.index, datum]));
  return data.map((datum, index) => {
    const stack = stackedByIndex.get(index);
    return Object.freeze({
      ...datum,
      stack0: stack?.y0 ?? 0,
      stack1: stack?.y1 ?? Number(datum.y),
    });
  });
}

function resolveStackOptions(props: Readonly<Record<string, unknown>>): StackOptions {
  const yExpression = isChannelExpression(props.y) ? props.y : null;
  const expressionOptions = yExpression?.kind === "stack" ? yExpression.options : {};
  if (
    expressionOptions.offset != null &&
    expressionOptions.offset !== "zero" &&
    expressionOptions.offset !== "expand" &&
    expressionOptions.offset !== "diverging"
  ) {
    throw new TypeError(`Unsupported stack offset ${String(expressionOptions.offset)}.`);
  }
  if (
    expressionOptions.order != null &&
    expressionOptions.order !== "none" &&
    expressionOptions.order !== "ascending" &&
    expressionOptions.order !== "descending" &&
    expressionOptions.order !== "inside-out"
  ) {
    throw new TypeError(`Unsupported stack order ${String(expressionOptions.order)}.`);
  }
  const offset =
    props.normalize || yExpression?.kind === "normalize"
      ? "expand"
      : (expressionOptions.offset ?? "diverging");
  const order =
    expressionOptions.order === "ascending" ||
    expressionOptions.order === "descending" ||
    expressionOptions.order === "inside-out"
      ? expressionOptions.order
      : "none";
  return Object.freeze({ offset, order });
}

function requiredChannelsValid<Row>(
  kind: MarkKind,
  datum: PreparedDatum<Row>,
  props: Readonly<Record<string, unknown>>,
): boolean {
  if (kind === "Arc") {
    const bounded = isFiniteNumber(props.min) && isFiniteNumber(props.max) && props.max > props.min;
    return isFiniteNumber(datum.value) && (bounded || datum.value >= 0);
  }
  if (kind === "Text")
    return validScaleValue(datum.x) && validScaleValue(datum.y) && validTextValue(datum.textValue);
  if (kind === "Area") {
    return (
      validScaleValue(datum.x) &&
      isFiniteNumber(datum.y) &&
      (props.y2 == null || isFiniteNumber(datum.y2))
    );
  }
  if (kind === "Rule") {
    const provided = [
      [props.x, datum.x],
      [props.x2, datum.x2],
      [props.y, datum.y],
      [props.y2, datum.y2],
    ].filter(([input]) => input != null);
    return provided.length > 0 && provided.every(([, value]) => validScaleValue(value));
  }
  if (kind === "Rect") {
    return (
      validScaleValue(datum.x) &&
      validScaleValue(datum.y) &&
      (props.x2 == null || validScaleValue(datum.x2)) &&
      (props.y2 == null || validScaleValue(datum.y2))
    );
  }
  if (kind === "Cell") return validScaleValue(datum.x) && validScaleValue(datum.y);
  return validScaleValue(datum.x) && isFiniteNumber(datum.y);
}

function safeKey<Row>(row: Row, index: number, key: unknown): PlotKey {
  return readRowKey(row, index, key as PlotRowKey<Row>);
}

function sourceIdentity<Row>(
  row: Row,
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
): { readonly key: PlotKey; readonly sourceIndex: number } | null {
  const sourceIndex = sourceIndexByRow.get(row);
  return sourceIndex === undefined
    ? null
    : Object.freeze({
        key: readRowKey(rootRows[sourceIndex]!, sourceIndex, rowKey),
        sourceIndex,
      });
}

function sourceKeyForDatum<Row>(
  row: Row,
  index: number,
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
  markKey: unknown,
): PlotKey {
  return (
    sourceIdentity(row, rootRows, rowKey, sourceIndexByRow)?.key ??
    safeKey(row, index, markKey ?? rowKey)
  );
}

function lineageKeys<Row>(
  rows: readonly Row[],
  indices: readonly number[],
  rootRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  sourceIndexByRow: ReadonlyMap<Row, number>,
): readonly PlotKey[] {
  const result = new Set<PlotKey>();
  for (const index of indices) {
    const source = sourceIdentity(rows[index]!, rootRows, rowKey, sourceIndexByRow);
    if (source) result.add(source.key);
  }
  return Object.freeze([...result]);
}

function resolveSeries<Row>(
  row: Row,
  index: number,
  props: Readonly<Record<string, unknown>>,
): string | null {
  const stackInput = props.stack === true || props.stack === false ? undefined : props.stack;
  const candidates = [stackInput, props.fill, props.category, props.stroke];
  const input = candidates.find((candidate) => candidate != null && !isConstant(candidate));
  if (input == null) return null;
  return channelSeries(readChannel<Row>(row, index, input));
}

export function collectScaleUses<Row>(
  preparedMarks: readonly PreparedMark<Row>[],
): Map<string, ScaleUse> {
  const uses = new Map<string, ScaleUse>();
  const get = (name: string, channel: ScaleUse["channel"]): ScaleUse => {
    const existing = uses.get(name);
    if (existing) {
      if (existing.channel !== channel) {
        throw new Error(
          `Scale ${name} cannot be used for both ${existing.channel} and ${channel} channels.`,
        );
      }
      return existing;
    }
    const created: ScaleUse = {
      name,
      channel,
      values: [],
      band: false,
      includeZero: false,
    };
    uses.set(name, created);
    return created;
  };

  for (const mark of preparedMarks) {
    const xName = String(mark.props.xScale ?? "x");
    const yName = String(mark.props.yScale ?? "y");
    const colorName = String(mark.props.colorScale ?? "color");
    const horizontal = mark.kind === "Bar" && mark.props.orientation === "horizontal";
    if (mark.kind === "Arc") {
      // Arc geometry does not consume Cartesian coordinate scales.
    } else if (horizontal) {
      const xUse = get(xName, "x");
      const yUse = get(yName, "y");
      xUse.includeZero = true;
      yUse.band = true;
      if (isFiniteNumber(mark.props.min)) xUse.values.push(mark.props.min);
      if (isFiniteNumber(mark.props.max)) xUse.values.push(mark.props.max);
      for (const datum of mark.data) {
        xUse.values.push(
          boundMeterValue(datum.stack0 ?? 0, mark.props),
          boundMeterValue(datum.stack1 ?? datum.y, mark.props),
        );
        yUse.values.push(datum.x);
      }
    } else {
      const xUse = get(xName, "x");
      const yUse = get(yName, "y");
      xUse.band ||=
        mark.kind === "Bar" ||
        mark.kind === "Cell" ||
        (mark.kind === "Rect" && mark.props.x2 == null);
      yUse.band ||= mark.kind === "Cell" || (mark.kind === "Rect" && mark.props.y2 == null);
      yUse.includeZero ||= mark.kind === "Bar" || mark.kind === "Area";
      if (mark.kind === "Bar") {
        if (isFiniteNumber(mark.props.min)) yUse.values.push(mark.props.min);
        if (isFiniteNumber(mark.props.max)) yUse.values.push(mark.props.max);
      }
      for (const datum of mark.data) {
        xUse.values.push(datum.bin0 ?? datum.x, datum.bin1 ?? datum.x2);
        yUse.values.push(
          mark.kind === "Bar"
            ? boundMeterValue(datum.stack0 ?? datum.y, mark.props)
            : (datum.stack0 ?? datum.y),
          mark.kind === "Bar"
            ? boundMeterValue(datum.stack1 ?? datum.y2, mark.props)
            : (datum.stack1 ?? datum.y2),
        );
      }
    }

    const colorValues: unknown[] = [];
    for (const datum of mark.data) {
      if (!isConstant(mark.props.fill)) {
        if (datum.fillValue != null) colorValues.push(datum.fillValue);
        else if (mark.kind === "Cell" && datum.value != null) colorValues.push(datum.value);
      }
      if (!isConstant(mark.props.stroke) && datum.strokeValue != null) {
        colorValues.push(datum.strokeValue);
      }
    }
    if (colorValues.length > 0) get(colorName, "color").values.push(...colorValues);
  }
  for (const use of uses.values()) {
    use.values.splice(
      0,
      use.values.length,
      ...use.values.filter((value) => value !== undefined && value !== null),
    );
  }
  return uses;
}

export function collectInvalidLogSourceKeys<Row>(
  preparedMarks: readonly PreparedMark<Row>[],
  scales: Readonly<Record<string, ResolvedScale>>,
  omittedKeys: Set<PlotKey>,
): void {
  const invalidFor = (scaleName: string, values: readonly unknown[]): boolean => {
    const scale = scales[scaleName];
    if (scale?.type !== "log") return false;
    return values.some((value) => {
      if (value == null) return false;
      const mappedValue = scale.map(value as ScaleInput);
      return typeof mappedValue !== "number" || !Number.isFinite(mappedValue);
    });
  };
  const omit = (datum: PreparedDatum<Row>) => {
    for (const key of datum.sourceKeys) omittedKeys.add(key);
  };

  for (const mark of preparedMarks) {
    if (mark.kind === "Arc") continue;
    const xName = String(mark.props.xScale ?? "x");
    const yName = String(mark.props.yScale ?? "y");
    const horizontal = mark.kind === "Bar" && mark.props.orientation === "horizontal";
    for (const datum of mark.data) {
      const invalidX = horizontal
        ? invalidFor(xName, [
            boundMeterValue(datum.stack0 ?? 0, mark.props),
            boundMeterValue(datum.stack1 ?? datum.y, mark.props),
          ])
        : invalidFor(xName, [datum.bin0 ?? datum.x, datum.bin1 ?? datum.x2]);
      const invalidY = horizontal
        ? invalidFor(yName, [datum.x])
        : invalidFor(yName, [datum.stack0 ?? datum.y, datum.stack1 ?? datum.y2]);
      if (invalidX || invalidY) omit(datum);
    }
  }
}

export function compileMark<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
): {
  marks: SceneMark<Row>[];
  hits: HitRegion<Row>[];
  visibleKeys?: readonly PlotKey[];
} {
  switch (mark.kind) {
    case "Bar":
      return compileBars(mark, scales, plotArea, startOrder);
    case "Line":
      return compileLines(mark, scales, plotArea, startOrder);
    case "Area":
      return compileAreas(mark, scales, plotArea, startOrder);
    case "Point":
      return compilePoints(mark, scales, plotArea, startOrder);
    case "Arc":
      return compileArcs(mark, scales, plotArea, startOrder);
    case "Cell":
      return compileCells(mark, scales, plotArea, startOrder);
    case "Rect":
      return compileRects(mark, scales, plotArea, startOrder);
    case "Rule":
      return compileRules(mark, scales, plotArea, startOrder);
    case "Text":
      return compileTexts(mark, scales, plotArea, startOrder);
  }
}

function compositeIdentity(...parts: readonly (string | null)[]): string {
  return JSON.stringify(parts);
}

function serializeValue(value: unknown): string {
  return value instanceof Date ? `date:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

export function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function validTemporalScaleValue(value: unknown): value is number | Date {
  return isFiniteNumber(value) || validDate(value);
}

function validTextValue(value: unknown): boolean {
  return typeof value === "boolean" || validScaleValue(value);
}
