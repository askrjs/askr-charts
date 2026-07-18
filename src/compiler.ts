import type { PlotDescriptor } from "./descriptors";
import { isChannelExpression, isRowTransform } from "./expressions";
import type {
  AxisProps,
  PlotKey,
  PlotRowKey,
  PlotSummaryContext,
  PlotView,
  PrimitiveKind,
  ScaleProps,
  ScaleDomainValue,
  ScaleValue,
  StackOptions,
} from "./model";
import { downsamplePixelEnvelope } from "./paths";
import { readRowKey } from "./rows";
import { createScale, inferScaleType, type ResolvedScale, type ScaleInput } from "./scales";
import type {
  HitRegion,
  PlotScene,
  SceneAxis,
  SceneDiagnostic,
  SceneExportRow,
  SceneGrid,
  SceneInteractions,
  SceneLegend,
  SceneMark,
  SceneMarkBase,
  ScenePoint,
  SceneTick,
} from "./scene-model";
import {
  applyRowTransforms,
  createBins,
  evaluateChannel,
  isFiniteNumber,
  partitionRows,
  readChannel,
  stackValues,
  validScaleValue,
} from "./transforms";

type MarkKind = Extract<
  PrimitiveKind,
  "Bar" | "Line" | "Area" | "Point" | "Arc" | "Cell" | "Rect" | "Rule" | "Text"
>;

interface PreparedDatum<Row> {
  readonly row: Row;
  readonly sourceIndex: number;
  readonly sourceKeys: readonly PlotKey[];
  readonly key: PlotKey;
  readonly x?: unknown;
  readonly x2?: unknown;
  readonly y?: unknown;
  readonly y2?: unknown;
  readonly value?: unknown;
  readonly radius?: unknown;
  readonly fillValue?: unknown;
  readonly strokeValue?: unknown;
  readonly titleValue?: unknown;
  readonly textValue?: unknown;
  readonly series: string | null;
  readonly defined?: boolean;
  readonly stack0?: number;
  readonly stack1?: number;
  readonly bin0?: number | Date;
  readonly bin1?: number | Date;
  readonly values: Readonly<Record<string, unknown>>;
  visible?: boolean;
}

interface PreparedMark<Row> {
  readonly kind: MarkKind;
  readonly props: Readonly<Record<string, unknown>>;
  readonly data: readonly PreparedDatum<Row>[];
  readonly ordinal: number;
  readonly directSourceIdentity: boolean;
}

interface ScaleUse {
  readonly name: string;
  readonly channel: "x" | "y" | "color";
  readonly values: unknown[];
  band: boolean;
  includeZero: boolean;
}

interface MappedAreaDatum<Row> {
  readonly point: ScenePoint;
  readonly baseline: ScenePoint;
  readonly datum: PreparedDatum<Row>;
}

export interface CompilePlotOptions<Row> {
  readonly rows: readonly Row[];
  readonly rowKey: PlotRowKey<Row>;
  readonly label: string;
  readonly descriptors: readonly PlotDescriptor[];
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  readonly view?: PlotView;
  readonly summary?: string | ((context: PlotSummaryContext<Row>) => string);
  readonly locale?: string;
}

const SERIES_COLORS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `var(--ak-chart-series-${index + 1})`),
);

const MARK_KINDS = new Set<PrimitiveKind>([
  "Bar",
  "Line",
  "Area",
  "Point",
  "Arc",
  "Cell",
  "Rect",
  "Rule",
  "Text",
]);

const SCALE_TYPES: ReadonlySet<string> = new Set([
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

export function compilePlotScene<Row>(options: CompilePlotOptions<Row>): PlotScene<Row> {
  const width = Math.max(1, finiteOr(options.width, 640));
  const height = Math.max(1, finiteOr(options.height, 360));
  const pixelRatio = Math.max(1, finiteOr(options.pixelRatio, 1));
  const sourceRows = Object.freeze([...options.rows]);
  const sourceIndexByKey = validateKeys(sourceRows, options.rowKey);
  const markDescriptors = options.descriptors.filter(
    (descriptor) =>
      MARK_KINDS.has(descriptor.kind) &&
      !(descriptor.props as Readonly<Record<string, unknown>>).hidden,
  );
  const sourceIndexByRow = new Map<Row, number>();
  if (markDescriptors.some(requiresSourceRowLookup)) {
    for (let index = 0; index < sourceRows.length; index += 1) {
      if (!sourceIndexByRow.has(sourceRows[index]!))
        sourceIndexByRow.set(sourceRows[index]!, index);
    }
  }
  const cartesian = markDescriptors.some((descriptor) => descriptor.kind !== "Arc");
  const margins = resolvePlotMargins(options.descriptors);
  const plotArea = Object.freeze(
    cartesian
      ? {
          x: margins.left,
          y: margins.top,
          width: Math.max(1, width - margins.left - margins.right),
          height: Math.max(1, height - margins.top - margins.bottom),
        }
      : {
          x: 12,
          y: 12,
          width: Math.max(1, width - 24),
          height: Math.max(1, height - 24),
        },
  );
  const omittedKeys = new Set<PlotKey>();
  const invalidLogKeys = new Set<PlotKey>();
  const preparedMarks = markDescriptors.map((descriptor, ordinal) =>
    prepareMark(
      descriptor as PlotDescriptor<Record<string, unknown>>,
      ordinal,
      sourceRows,
      options.rowKey,
      sourceIndexByKey,
      sourceIndexByRow,
      omittedKeys,
    ),
  );
  const scaleUses = collectScaleUses(preparedMarks);
  const scales = resolveScales(options.descriptors, scaleUses, plotArea, options.view);
  collectInvalidLogSourceKeys(preparedMarks, scales, invalidLogKeys);
  const axes = resolveAxes(options.descriptors, scales, scaleUses, cartesian, options.locale);
  const grids = resolveGrids(options.descriptors, scales, scaleUses, axes, plotArea);
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  const visibleKeys = new Set<PlotKey>();
  const directExportMark =
    preparedMarks.length === 1 && preparedMarks[0]!.directSourceIdentity ? preparedMarks[0]! : null;
  const exportRowsByKey = directExportMark
    ? null
    : new Map<
        PlotKey,
        {
          row: Row;
          key: PlotKey;
          sourceIndex: number;
          sourceKeys: Set<PlotKey>;
          values: Record<string, unknown>;
        }
      >();
  let order = 0;

  for (const prepared of preparedMarks) {
    const rendered = compileMark(prepared, scales, plotArea, order);
    order += rendered.marks.length + rendered.hits.length;
    marks.push(...rendered.marks);
    hits.push(...rendered.hits);
    if (rendered.visibleKeys) {
      for (const key of rendered.visibleKeys) visibleKeys.add(key);
    } else {
      for (const hit of rendered.hits) visibleKeys.add(hit.key);
    }
    if (exportRowsByKey) {
      for (const datum of prepared.data) {
        const existing = exportRowsByKey.get(datum.key);
        if (existing) {
          Object.assign(existing.values, datum.values);
          for (const key of datum.sourceKeys) existing.sourceKeys.add(key);
        } else {
          exportRowsByKey.set(datum.key, {
            row: datum.row,
            key: datum.key,
            sourceIndex: datum.sourceIndex,
            sourceKeys: new Set(datum.sourceKeys),
            values: { ...datum.values },
          });
        }
      }
    }
  }

  const exportRows: readonly SceneExportRow<Row>[] = Object.freeze(
    directExportMark
      ? directExportMark.data.map((datum) => {
          datum.visible = visibleKeys.has(datum.key);
          return Object.freeze(datum) as SceneExportRow<Row>;
        })
      : [...exportRowsByKey!.values()].map((record) =>
          Object.freeze({
            ...record,
            sourceKeys: Object.freeze([...record.sourceKeys]),
            visible: visibleKeys.has(record.key),
            values: Object.freeze(record.values),
          }),
        ),
  );
  const exportRowsAreSourceRows =
    directExportMark?.directSourceIdentity === true && exportRows.length === sourceRows.length;
  const sourceRowRecords = exportRowsAreSourceRows
    ? exportRows
    : buildSourceRowRecords(sourceRows, options.rowKey, exportRows);

  const legends = resolveLegends(options.descriptors, scales, scaleUses);
  const interactions = resolveInteractions(options.descriptors, marks.length > 0);
  const scaleDiagnostics = Object.values(scales)
    .filter((scale) => scale.omittedValueCount > 0)
    .map<SceneDiagnostic>((scale) =>
      Object.freeze({
        code: scale.type === "log" ? "invalid-log" : "missing-channel",
        message: `${scale.omittedValueCount} value(s) were omitted from ${scale.name}.`,
        count: scale.omittedValueCount,
      }),
    );
  const diagnostics: SceneDiagnostic[] = [...scaleDiagnostics];
  if (omittedKeys.size > 0) {
    diagnostics.unshift(
      Object.freeze({
        code: "missing-channel",
        message: `${omittedKeys.size} row(s) had missing or non-finite required channels.`,
        count: omittedKeys.size,
      }),
    );
  }
  const omittedSourceKeys = new Set([...omittedKeys, ...invalidLogKeys]);
  const omittedRowCount = Math.min(sourceRows.length, omittedSourceKeys.size);
  const summaryContext: PlotSummaryContext<Row> = Object.freeze({
    rows: sourceRows,
    sourceRowCount: sourceRows.length,
    transformedRowCount: exportRows.length,
    omittedRowCount,
    visibleRowCount: visibleKeys.size,
  });
  const summary =
    typeof options.summary === "function"
      ? options.summary(summaryContext)
      : (options.summary ?? defaultSummary(options.label, summaryContext));

  return Object.freeze({
    width,
    height,
    pixelRatio,
    plotArea,
    scales: Object.freeze(scales),
    axes: Object.freeze(axes),
    grids: Object.freeze(grids),
    marks: Object.freeze(marks),
    hits: Object.freeze(hits),
    legends: Object.freeze(legends),
    interactions,
    sourceRows,
    sourceRowRecords,
    transformedRows: exportRows,
    omittedRowCount,
    visibleRowCount: visibleKeys.size,
    diagnostics: Object.freeze(diagnostics),
    summary,
    empty: marks.length === 0,
  });
}

function validateKeys<Row>(
  rows: readonly Row[],
  rowKey: PlotRowKey<Row>,
): ReadonlyMap<PlotKey, number> {
  const result = new Map<PlotKey, number>();
  for (let index = 0; index < rows.length; index += 1) {
    const key = readRowKey(rows[index]!, index, rowKey);
    if (result.has(key)) throw new Error(`Duplicate plot row key ${String(key)}.`);
    result.set(key, index);
  }
  return result;
}

function resolvePlotMargins(descriptors: readonly PlotDescriptor[]) {
  const axes = descriptors
    .filter((descriptor) => descriptor.kind === "Axis")
    .map((descriptor) => descriptor.props as AxisProps);
  const top = axes.some((axis) => axis.orient === "top" && axis.label != null) ? 44 : 18;
  const right = axes.some((axis) => axis.orient === "right" && axis.label != null) ? 56 : 20;
  return Object.freeze({ top, right, bottom: 44, left: 56 });
}

function requiresSourceRowLookup(descriptor: PlotDescriptor): boolean {
  const props = descriptor.props as Readonly<Record<string, unknown>>;
  if (props.data != null || props.transform != null) return true;
  if (descriptor.kind !== "Bar" && descriptor.kind !== "Area") return false;
  return (
    (isChannelExpression(props.x) && props.x.kind === "bin") ||
    (isChannelExpression(props.y) &&
      (props.y.kind === "count" || props.y.kind === "sum" || props.y.kind === "mean"))
  );
}

function buildSourceRowRecords<Row>(
  sourceRows: readonly Row[],
  rowKey: PlotRowKey<Row>,
  exportRows: readonly SceneExportRow<Row>[],
) {
  const visibleSourceKeys = new Set<PlotKey>();
  for (const record of exportRows) {
    if (!record.visible) continue;
    for (const key of record.sourceKeys) visibleSourceKeys.add(key);
  }
  return Object.freeze(
    sourceRows.map((row, sourceIndex) => {
      const key = readRowKey(row, sourceIndex, rowKey);
      return Object.freeze({
        row,
        key,
        sourceIndex,
        visible: visibleSourceKeys.has(key),
      });
    }),
  );
}

function prepareMark<Row>(
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

function prepareBinnedData<Row>(
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
    ? (props.y as import("./model").ChannelExpression<number, string>)
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

function prepareAggregatedData<Row>(
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
  const yExpression = props.y as import("./model").ChannelExpression<number, string>;
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
  expression: import("./model").ChannelExpression<number, string> | null,
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
  expression: import("./model").ChannelExpression<number, string> | null,
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

function channelSeries(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return `string:${encodeSeriesString(value)}`;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? `date:${value.getTime()}` : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `number:${Object.is(value, -0) ? "-0" : String(value)}` : null;
  }
  if (typeof value === "boolean") return `boolean:${String(value)}`;
  return null;
}

function encodeSeriesString(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += encodeURIComponent(value.slice(index, index + 2));
        index += 1;
        continue;
      }
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      result += `%u${code.toString(16).padStart(4, "0")}`;
    } else {
      result += encodeURIComponent(value[index]!);
    }
  }
  return result;
}

function isConstant(value: unknown): boolean {
  return isChannelExpression(value) && value.kind === "constant";
}

function collectScaleUses<Row>(preparedMarks: readonly PreparedMark<Row>[]): Map<string, ScaleUse> {
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

function collectInvalidLogSourceKeys<Row>(
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

function resolveScales(
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

function validateScaleArray(
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

function primaryScaleName(
  uses: ReadonlyMap<string, ScaleUse>,
  explicit: ReadonlyMap<string, ScaleProps>,
  channel: ScaleUse["channel"],
): string | undefined {
  if (explicit.has(channel)) return channel;
  const preferred = channel === "x" ? ["bottom", "top"] : ["left", "right"];
  for (const name of preferred) if (uses.get(name)?.channel === channel) return name;
  return [...uses.values()].find((use) => use.channel === channel)?.name;
}

function scaleChannel(
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

function resolveAxes(
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
    const rangeSpan = numericRange.length > 1
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
  const retained = values.filter((_value, index) => index === 0 || index === values.length - 1 || index % step === 0);
  return Object.freeze(retained);
}

function ellipsizeTick(label: string, availablePixels: number): string {
  const characters = Math.max(4, Math.floor(availablePixels / 7));
  return label.length <= characters ? label : `${label.slice(0, Math.max(1, characters - 1))}…`;
}

function resolveGrids(
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

function resolveLegends(
  descriptors: readonly PlotDescriptor[],
  scales: Readonly<Record<string, ResolvedScale>>,
  uses: ReadonlyMap<string, ScaleUse>,
): SceneLegend[] {
  const explicit = descriptors.filter((descriptor) => descriptor.kind === "Legend");
  const colorScales = [...uses.values()].filter((use) => use.channel === "color");
  const specs: Record<string, unknown>[] =
    explicit.length > 0
      ? explicit.map((descriptor) => descriptor.props as Record<string, unknown>)
      : colorScales.map((use) => ({ scale: use.name }) as Record<string, unknown>);
  return specs.flatMap((spec) => {
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

function resolveInteractions(
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

function compileMark<Row>(
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

function compileBars<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const horizontal = mark.props.orientation === "horizontal";
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  for (const datum of mark.data) {
    let x: number;
    let y: number;
    let width: number;
    let height: number;
    if (horizontal) {
      const category = mapped(yScale, datum.x, false);
      const value0 = mapped(xScale, boundMeterValue(datum.stack0 ?? 0, mark.props));
      const value1 = mapped(xScale, boundMeterValue(datum.stack1 ?? datum.y, mark.props));
      if (category == null || value0 == null || value1 == null) continue;
      const inset = finiteOr(mark.props.inset, 0);
      const nominalHeight = yScale.bandwidth ?? 10;
      x = Math.min(value0, value1);
      y = category - (yScale.bandwidth == null ? nominalHeight / 2 : 0) + inset;
      width = Math.abs(value1 - value0);
      height = Math.max(1, nominalHeight - inset * 2);
    } else {
      const left = mapped(xScale, datum.bin0 ?? datum.x, false);
      const right = datum.bin1 != null ? mapped(xScale, datum.bin1, false) : null;
      const value0 = mapped(yScale, boundMeterValue(datum.stack0 ?? 0, mark.props));
      const value1 = mapped(yScale, boundMeterValue(datum.stack1 ?? datum.y, mark.props));
      if (left == null || value0 == null || value1 == null) continue;
      const inset = finiteOr(mark.props.inset, 1);
      const continuousUnbinned = right == null && xScale.bandwidth == null;
      const nominalWidth = xScale.bandwidth ?? 10;
      x = continuousUnbinned ? left - nominalWidth / 2 + inset : left + inset;
      width = Math.max(1, (right == null ? nominalWidth : right - left) - inset * 2);
      y = Math.min(value0, value1);
      height = Math.abs(value1 - value0);
    }
    if (!intersectsPlot(x, y, width, height, plotArea)) continue;
    const base = markBase(mark, datum, "bar", marks.length, scales);
    const sceneMark = Object.freeze({
      ...base,
      kind: "bar" as const,
      x,
      y,
      width,
      height,
      radius: Math.max(0, finiteOr(mark.props.radius, 2)),
    });
    marks.push(sceneMark);
    hits.push(rectHit(sceneMark, datum, startOrder + hits.length));
  }
  return { marks, hits };
}

function compileLines<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const groups = groupBySeries(mark.data);
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  const visibleKeys = new Set<PlotKey>();
  for (const data of groups.values()) {
    const dataByKey = new Map(data.map((datum) => [datum.key, datum]));
    const rawSegments: ScenePoint[][] = [];
    let currentSegment: ScenePoint[] = [];
    const closeSegment = () => {
      if (currentSegment.length > 0) rawSegments.push(currentSegment);
      currentSegment = [];
    };
    for (const datum of data) {
      if (datum.defined === false) {
        closeSegment();
        continue;
      }
      const x = mapped(xScale, datum.x, true);
      const y = mapped(yScale, datum.y, true);
      if (x == null || y == null) {
        closeSegment();
        continue;
      }
      currentSegment.push({
        x,
        y,
        sourceIndex: datum.sourceIndex,
        key: datum.key,
      });
    }
    closeSegment();
    const segments = Object.freeze(
      rawSegments
        .map((segment) => {
          segment.sort((left, right) => left.x - right.x);
          const clipped = clipPointsToPlotX(segment, plotArea);
          for (const point of clipped) visibleKeys.add(point.key);
          return Object.freeze([...downsamplePixelEnvelope(clipped, plotArea.width)]);
        })
        .filter((segment) => segment.length > 0),
    );
    const points = Object.freeze(segments.flat());
    if (points.length === 0) continue;
    const first = dataByKey.get(points[0]!.key) ?? data[0]!;
    const base = markBase(mark, first, "line", marks.length, scales);
    const sceneMark = Object.freeze({
      ...base,
      kind: "line" as const,
      sourceKeys: pointSourceKeys(points),
      fill: "none",
      segments,
      points,
      curve: toCurve(mark.props.curve),
      strokeWidth: Math.max(0.5, finiteOr(mark.props.strokeWidth, 2)),
    });
    marks.push(sceneMark);
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex]!;
      const datum = dataByKey.get(point.key) ?? first;
      const previous = points[pointIndex - 1];
      const next = points[pointIndex + 1];
      const polyline = [
        previous ? { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 } : point,
        point,
        next ? { x: (next.x + point.x) / 2, y: (next.y + point.y) / 2 } : point,
      ];
      hits.push(
        Object.freeze({
          id: `${sceneMark.id}-hit-${hits.length}`,
          shape: Object.freeze({
            kind: "polyline",
            points: Object.freeze(polyline),
            tolerance: 5,
          }),
          row: datum.row,
          sourceIndex: datum.sourceIndex,
          key: datum.key,
          mark: "line",
          title: titleFor(datum),
          channels: datum.values,
          series: datum.series,
          order: startOrder + hits.length,
        }),
      );
    }
  }
  return { marks, hits, visibleKeys: Object.freeze([...visibleKeys]) };
}

function compileAreas<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  const visibleKeys = new Set<PlotKey>();
  for (const data of groupBySeries(mark.data).values()) {
    const mappedData: MappedAreaDatum<Row>[] = [];
    for (const datum of data) {
      const x = mapped(xScale, datum.x, true);
      const y = mapped(yScale, datum.stack1 ?? datum.y, true);
      const y0 = mapped(yScale, datum.stack0 ?? datum.y2 ?? finiteOr(mark.props.baseline, 0), true);
      if (x == null || y == null || y0 == null) continue;
      mappedData.push({
        point: Object.freeze({ x, y, sourceIndex: datum.sourceIndex, key: datum.key }),
        baseline: Object.freeze({ x, y: y0, sourceIndex: datum.sourceIndex, key: datum.key }),
        datum,
      });
    }
    mappedData.sort((left, right) => left.point.x - right.point.x);
    const clippedData = clipAreaDataToPlotX(mappedData, plotArea);
    for (const entry of clippedData) visibleKeys.add(entry.point.key);
    const points = clippedData.map(({ point }) => point);
    if (points.length === 0) continue;
    const first = clippedData[0]!.datum;
    const sampledData = downsampleAreaData(clippedData, plotArea.width);
    const sceneMark = Object.freeze({
      ...markBase(mark, first, "area", marks.length, scales),
      kind: "area" as const,
      sourceKeys: pointSourceKeys(sampledData.map(({ point }) => point)),
      opacity: Math.min(finiteOr(mark.props.opacity, 0.32), 1),
      points: Object.freeze(sampledData.map(({ point }) => point)),
      baseline: Object.freeze(sampledData.map((entry) => entry.baseline)),
      curve: toCurve(mark.props.curve),
    });
    marks.push(sceneMark);
    for (let index = 0; index < sampledData.length; index += 1) {
      const entry = sampledData[index]!;
      const point = entry.point;
      const bottom = entry.baseline;
      const datum = entry.datum;
      const previous = sampledData[index - 1];
      const next = sampledData[index + 1];
      const leftX = previous ? (previous.point.x + point.x) / 2 : point.x - 4;
      const rightX = next ? (next.point.x + point.x) / 2 : point.x + 4;
      hits.push(
        Object.freeze({
          id: `${sceneMark.id}-hit-${index}`,
          shape: Object.freeze({
            kind: "polygon",
            points: Object.freeze([
              { x: leftX, y: point.y },
              { x: rightX, y: point.y },
              { x: rightX, y: bottom.y },
              { x: leftX, y: bottom.y },
            ]),
          }),
          row: datum.row,
          sourceIndex: point.sourceIndex,
          key: point.key,
          mark: "area",
          title: titleFor(datum),
          channels: datum.values,
          series: datum.series,
          order: startOrder + hits.length,
        }),
      );
    }
  }
  return { marks, hits, visibleKeys: Object.freeze([...visibleKeys]) };
}

function pointSourceKeys(points: readonly ScenePoint[]): readonly PlotKey[] {
  return Object.freeze([...new Set(points.map(({ key }) => key))]);
}

function clipPointsToPlotX(
  points: readonly ScenePoint[],
  plotArea: { x: number; width: number },
): readonly ScenePoint[] {
  if (points.length === 0) return Object.freeze([]);
  const left = plotArea.x;
  const right = plotArea.x + plotArea.width;
  if (points.length === 1) {
    return points[0]!.x >= left && points[0]!.x <= right
      ? Object.freeze([points[0]!])
      : Object.freeze([]);
  }
  const result: ScenePoint[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    if (end.x < left || start.x > right) continue;
    const clippedStart = start.x < left ? interpolateScenePoint(start, end, left) : start;
    const clippedEnd = end.x > right ? interpolateScenePoint(start, end, right) : end;
    pushUniqueScenePoint(result, clippedStart);
    pushUniqueScenePoint(result, clippedEnd);
  }
  return Object.freeze(result);
}

function interpolateScenePoint(start: ScenePoint, end: ScenePoint, x: number): ScenePoint {
  const amount = end.x === start.x ? 0 : (x - start.x) / (end.x - start.x);
  const identity = amount < 0.5 ? start : end;
  return Object.freeze({
    x,
    y: start.y + (end.y - start.y) * amount,
    sourceIndex: identity.sourceIndex,
    key: identity.key,
  });
}

function pushUniqueScenePoint(result: ScenePoint[], point: ScenePoint): void {
  const previous = result[result.length - 1];
  if (!previous || previous.x !== point.x || previous.y !== point.y) result.push(point);
}

function clipAreaDataToPlotX<Row>(
  data: readonly MappedAreaDatum<Row>[],
  plotArea: { x: number; width: number },
): readonly MappedAreaDatum<Row>[] {
  if (data.length === 0) return Object.freeze([]);
  const left = plotArea.x;
  const right = plotArea.x + plotArea.width;
  if (data.length === 1) {
    return data[0]!.point.x >= left && data[0]!.point.x <= right
      ? Object.freeze([data[0]!])
      : Object.freeze([]);
  }
  const result: MappedAreaDatum<Row>[] = [];
  for (let index = 1; index < data.length; index += 1) {
    const start = data[index - 1]!;
    const end = data[index]!;
    if (end.point.x < left || start.point.x > right) continue;
    const clippedStart = start.point.x < left ? interpolateAreaDatum(start, end, left) : start;
    const clippedEnd = end.point.x > right ? interpolateAreaDatum(start, end, right) : end;
    pushUniqueAreaDatum(result, clippedStart);
    pushUniqueAreaDatum(result, clippedEnd);
  }
  return Object.freeze(result);
}

function interpolateAreaDatum<Row>(
  start: MappedAreaDatum<Row>,
  end: MappedAreaDatum<Row>,
  x: number,
): MappedAreaDatum<Row> {
  const amount =
    end.point.x === start.point.x ? 0 : (x - start.point.x) / (end.point.x - start.point.x);
  const identity = amount < 0.5 ? start : end;
  return Object.freeze({
    point: Object.freeze({
      x,
      y: start.point.y + (end.point.y - start.point.y) * amount,
      sourceIndex: identity.point.sourceIndex,
      key: identity.point.key,
    }),
    baseline: Object.freeze({
      x,
      y: start.baseline.y + (end.baseline.y - start.baseline.y) * amount,
      sourceIndex: identity.baseline.sourceIndex,
      key: identity.baseline.key,
    }),
    datum: identity.datum,
  });
}

function pushUniqueAreaDatum<Row>(
  result: MappedAreaDatum<Row>[],
  entry: MappedAreaDatum<Row>,
): void {
  const previous = result[result.length - 1];
  if (
    !previous ||
    previous.point.x !== entry.point.x ||
    previous.point.y !== entry.point.y ||
    previous.baseline.y !== entry.baseline.y
  ) {
    result.push(entry);
  }
}

function downsampleAreaData<Row>(
  data: readonly MappedAreaDatum<Row>[],
  pixelWidth: number,
): readonly MappedAreaDatum<Row>[] {
  if (data.length <= Math.max(4, pixelWidth * 2) || pixelWidth <= 0) {
    return Object.freeze([...data]);
  }
  const buckets = new Map<
    number,
    {
      first: MappedAreaDatum<Row>;
      last: MappedAreaDatum<Row>;
      minPoint: MappedAreaDatum<Row>;
      maxPoint: MappedAreaDatum<Row>;
      minBaseline: MappedAreaDatum<Row>;
      maxBaseline: MappedAreaDatum<Row>;
    }
  >();
  for (const entry of data) {
    const bucket = Math.floor(entry.point.x);
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, {
        first: entry,
        last: entry,
        minPoint: entry,
        maxPoint: entry,
        minBaseline: entry,
        maxBaseline: entry,
      });
      continue;
    }
    current.last = entry;
    if (entry.point.y < current.minPoint.point.y) current.minPoint = entry;
    if (entry.point.y > current.maxPoint.point.y) current.maxPoint = entry;
    if (entry.baseline.y < current.minBaseline.baseline.y) current.minBaseline = entry;
    if (entry.baseline.y > current.maxBaseline.baseline.y) current.maxBaseline = entry;
  }
  const result: MappedAreaDatum<Row>[] = [];
  const seen = new Set<MappedAreaDatum<Row>>();
  const sourceOrder = new Map(data.map((entry, index) => [entry, index]));
  for (const bucket of buckets.values()) {
    const candidates = [
      bucket.first,
      bucket.minPoint,
      bucket.maxPoint,
      bucket.minBaseline,
      bucket.maxBaseline,
      bucket.last,
    ].sort(
      (left, right) =>
        left.point.x - right.point.x ||
        (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0),
    );
    for (const entry of candidates) {
      if (!seen.has(entry)) {
        seen.add(entry);
        result.push(entry);
      }
    }
  }
  return Object.freeze(result);
}

function compilePoints<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  const occupied = mark.data.length > 10_000 ? new Set<number>() : null;
  const occupiedColumns = Math.max(1, Math.floor(plotArea.width) + 1);
  for (const datum of mark.data) {
    const x = mapped(xScale, datum.x, true);
    const y = mapped(yScale, datum.y, true);
    if (x == null || y == null || !pointInPlot(x, y, plotArea)) continue;
    if (occupied) {
      const pixel = Math.floor(x - plotArea.x) + Math.floor(y - plotArea.y) * occupiedColumns;
      if (occupied.has(pixel)) continue;
      occupied.add(pixel);
    }
    const radius = Math.max(
      1,
      isFiniteNumber(datum.radius) ? datum.radius : finiteOr(mark.props.r, 3.5),
    );
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "point", marks.length, scales),
      kind: "point" as const,
      x,
      y,
      radius,
      shape: toPointShape(mark.props.shape),
    });
    marks.push(sceneMark);
    hits.push(
      Object.freeze({
        id: `${sceneMark.id}-hit`,
        shape: Object.freeze({
          kind: "circle",
          x,
          y,
          radius: Math.max(5, radius),
        }),
        row: datum.row,
        sourceIndex: datum.sourceIndex,
        key: datum.key,
        mark: "point",
        title: sceneMark.title,
        channels: datum.values,
        series: datum.series,
        order: startOrder + hits.length,
      }),
    );
  }
  return { marks, hits };
}

function compileArcs<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const values = mark.data.map((datum) => Math.max(0, Number(datum.value))).filter(Number.isFinite);
  const boundedMin = isFiniteNumber(mark.props.min) ? mark.props.min : null;
  const boundedMax = isFiniteNumber(mark.props.max) ? mark.props.max : null;
  const bounded = boundedMin !== null && boundedMax !== null && boundedMax > boundedMin;
  if (bounded && mark.data.length > 1) {
    throw new TypeError("A bounded Arc requires exactly one datum.");
  }
  const total = bounded ? boundedMax - boundedMin : values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return emptyCompiled<Row>();
  const start = finiteOr(mark.props.startAngle, -Math.PI / 2);
  const end = finiteOr(mark.props.endAngle, start + Math.PI * 2);
  const radius = Math.min(plotArea.width, plotArea.height) / 2;
  const outerRadius = clampRadius(mark.props.outerRadius, radius, radius * 0.9);
  const innerRadius = clampRadius(mark.props.innerRadius, outerRadius, 0);
  const cx = plotArea.x + plotArea.width / 2;
  const cy = plotArea.y + plotArea.height / 2;
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  let angle = start;
  for (let index = 0; index < mark.data.length; index += 1) {
    const datum = mark.data[index]!;
    const rawValue = Number(datum.value);
    const value = bounded
      ? Math.max(0, Math.min(total, rawValue - boundedMin))
      : Math.max(0, rawValue);
    if (!Number.isFinite(value) || value === 0) continue;
    const next = angle + ((end - start) * value) / total;
    const direction = next >= angle ? 1 : -1;
    const availableSpan = Math.abs(next - angle);
    const requestedPad = Math.max(0, finiteOr(mark.props.padAngle, 0.01));
    const pad = Math.min(requestedPad, Math.max(0, availableSpan - 1e-6));
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "arc", marks.length, scales),
      kind: "arc" as const,
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle: angle + (direction * pad) / 2,
      endAngle: next - (direction * pad) / 2,
      padAngle: pad,
      cornerRadius: Math.max(0, finiteOr(mark.props.cornerRadius, 0)),
    });
    marks.push(sceneMark);
    hits.push(
      Object.freeze({
        id: `${sceneMark.id}-hit`,
        shape: Object.freeze({
          kind: "arc",
          cx,
          cy,
          innerRadius,
          outerRadius,
          startAngle: sceneMark.startAngle,
          endAngle: sceneMark.endAngle,
        }),
        row: datum.row,
        sourceIndex: datum.sourceIndex,
        key: datum.key,
        mark: "arc",
        title: sceneMark.title,
        channels: datum.values,
        series: datum.series,
        order: startOrder + hits.length,
      }),
    );
    angle = next;
  }
  return { marks, hits };
}

function compileCells<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  const inset = Math.max(0, finiteOr(mark.props.inset, 1));
  for (const datum of mark.data) {
    const x = mapped(xScale, datum.x, false);
    const y = mapped(yScale, datum.y, false);
    if (x == null || y == null) continue;
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "cell", marks.length, scales),
      kind: "cell" as const,
      x: x + inset,
      y: y + inset,
      width: Math.max(1, (xScale.bandwidth ?? 10) - inset * 2),
      height: Math.max(1, (yScale.bandwidth ?? 10) - inset * 2),
      radius: 1,
    });
    if (!intersectsPlot(sceneMark.x, sceneMark.y, sceneMark.width, sceneMark.height, plotArea))
      continue;
    marks.push(sceneMark);
    hits.push(rectHit(sceneMark, datum, startOrder + hits.length));
  }
  return { marks, hits };
}

function compileRects<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  for (const datum of mark.data) {
    const x0 = mapped(xScale, datum.x, false);
    const x1 = datum.x2 == null ? x0 : mapped(xScale, datum.x2, false);
    const y0 = mapped(yScale, datum.y, false);
    const y1 = datum.y2 == null ? y0 : mapped(yScale, datum.y2, false);
    if (x0 == null || x1 == null || y0 == null || y1 == null) continue;
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "rect", marks.length, scales),
      kind: "rect" as const,
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      width:
        datum.x2 == null
          ? Math.max(1, xScale.bandwidth ?? 0)
          : Math.max(1, Math.abs(x1 - x0) + (xScale.bandwidth ?? 0)),
      height:
        datum.y2 == null
          ? Math.max(1, yScale.bandwidth ?? 0)
          : Math.max(1, Math.abs(y1 - y0) + (yScale.bandwidth ?? 0)),
      radius: Math.max(0, finiteOr(mark.props.radius, 1)),
    });
    if (!intersectsPlot(sceneMark.x, sceneMark.y, sceneMark.width, sceneMark.height, plotArea))
      continue;
    marks.push(sceneMark);
    hits.push(rectHit(sceneMark, datum, startOrder + hits.length));
  }
  return { marks, hits };
}

function compileRules<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const dash = resolveRuleDash(mark.props.dash);
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  for (const datum of mark.data) {
    const x1 = datum.x == null ? plotArea.x : mapped(xScale, datum.x, true);
    const x2 =
      datum.x2 == null
        ? datum.x == null
          ? plotArea.x + plotArea.width
          : x1
        : mapped(xScale, datum.x2, true);
    const y1 = datum.y == null ? plotArea.y : mapped(yScale, datum.y, true);
    const y2 =
      datum.y2 == null
        ? datum.y == null
          ? plotArea.y + plotArea.height
          : y1
        : mapped(yScale, datum.y2, true);
    if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "rule", marks.length, scales),
      kind: "rule" as const,
      x1,
      y1,
      x2,
      y2,
      strokeWidth: Math.max(0.5, finiteOr(mark.props.strokeWidth, 1)),
      dash,
    });
    marks.push(sceneMark);
    hits.push(
      Object.freeze({
        id: `${sceneMark.id}-hit`,
        shape: Object.freeze({ kind: "line", x1, y1, x2, y2, tolerance: 5 }),
        row: datum.row,
        sourceIndex: datum.sourceIndex,
        key: datum.key,
        mark: "rule",
        title: sceneMark.title,
        channels: datum.values,
        series: datum.series,
        order: startOrder + hits.length,
      }),
    );
  }
  return { marks, hits };
}

function resolveRuleDash(value: unknown): readonly number[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError("Rule dash must be an array of numbers.");
  }
  if (!value.every((entry) => isFiniteNumber(entry) && entry >= 0)) {
    throw new RangeError("Rule dash entries must be finite non-negative numbers.");
  }
  return Object.freeze([...value] as number[]);
}

function compileTexts<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const marks: SceneMark<Row>[] = [];
  const hits: HitRegion<Row>[] = [];
  for (const datum of mark.data) {
    const x = mapped(xScale, datum.x, true);
    const y = mapped(yScale, datum.y, true);
    if (x == null || y == null || !pointInPlot(x, y, plotArea)) continue;
    const text = String(datum.textValue ?? "");
    const sceneMark = Object.freeze({
      ...markBase(mark, datum, "text", marks.length, scales),
      kind: "text" as const,
      x,
      y,
      text,
      align: toTextAlign(mark.props.align),
      baseline: toTextBaseline(mark.props.baseline),
      font: typeof mark.props.font === "string" ? mark.props.font : null,
    });
    marks.push(sceneMark);
    hits.push(
      Object.freeze({
        id: `${sceneMark.id}-hit`,
        shape: Object.freeze({
          kind: "text",
          x: textHitBounds(x, text, toTextAlign(mark.props.align)).x,
          y: textHitBounds(
            x,
            text,
            toTextAlign(mark.props.align),
            y,
            toTextBaseline(mark.props.baseline),
          ).y,
          width: textHitBounds(x, text, toTextAlign(mark.props.align)).width,
          height: textHitBounds(
            x,
            text,
            toTextAlign(mark.props.align),
            y,
            toTextBaseline(mark.props.baseline),
          ).height,
        }),
        row: datum.row,
        sourceIndex: datum.sourceIndex,
        key: datum.key,
        mark: "text",
        title: sceneMark.title,
        channels: datum.values,
        series: datum.series,
        order: startOrder + hits.length,
      }),
    );
  }
  return { marks, hits };
}

function textHitBounds(
  x: number,
  text: string,
  align: CanvasTextAlign,
  y = 0,
  baseline: CanvasTextBaseline = "alphabetic",
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(8, text.length * 7);
  const left =
    align === "center" ? x - width / 2 : align === "right" || align === "end" ? x - width : x;
  const top =
    baseline === "top"
      ? y
      : baseline === "middle"
        ? y - 8
        : baseline === "bottom"
          ? y - 16
          : y - 13;
  return { x: left, y: top, width, height: 16 };
}

function markBase<Row>(
  mark: PreparedMark<Row>,
  datum: PreparedDatum<Row>,
  kind: SceneMark<Row>["kind"],
  index: number,
  scales: Readonly<Record<string, ResolvedScale>>,
): SceneMarkBase<Row> {
  const colorScale = String(mark.props.colorScale ?? "color");
  const defaultColor = SERIES_COLORS[mark.ordinal % SERIES_COLORS.length]!;
  const fill = paint(
    mark.props.fill ?? mark.props.category,
    datum.fillValue ?? (kind === "cell" ? datum.value : undefined),
    colorScale,
    defaultColor,
    scales,
  );
  const stroke = paint(
    mark.props.stroke,
    datum.strokeValue,
    colorScale,
    kind === "bar" || kind === "cell" || kind === "arc" || kind === "rect" ? "none" : defaultColor,
    scales,
  );
  return {
    id: `${kind}-${mark.ordinal}-${String(datum.key)}-${index}`,
    key: datum.key,
    sourceKeys: datum.sourceKeys,
    sourceIndex: datum.sourceIndex,
    row: datum.row,
    fill: kind === "line" || kind === "rule" ? "none" : fill,
    stroke,
    opacity: Math.max(0, Math.min(1, finiteOr(mark.props.opacity, 1))),
    title: titleFor(datum),
    series: datum.series,
    channels: datum.values,
  };
}

function paint(
  input: unknown,
  value: unknown,
  scaleName: string,
  fallback: string,
  scales: Readonly<Record<string, ResolvedScale>>,
): string {
  if (isConstant(input))
    return String((input as { options: Record<string, unknown> }).options.value);
  if (value != null) {
    const mappedColor = validPaintScaleValue(value)
      ? scales[scaleName]?.map(value as ScaleInput)
      : undefined;
    if (typeof mappedColor === "string") return mappedColor;
    const index = stableHash(String(value)) % SERIES_COLORS.length;
    return SERIES_COLORS[index]!;
  }
  return fallback;
}

function rectHit<Row>(
  mark: Extract<SceneMark<Row>, { kind: "bar" | "cell" | "rect" }>,
  datum: PreparedDatum<Row>,
  order: number,
): HitRegion<Row> {
  return Object.freeze({
    id: `${mark.id}-hit`,
    shape: Object.freeze({
      kind: "rect",
      x: mark.x,
      y: mark.y,
      width: mark.width,
      height: mark.height,
    }),
    row: datum.row,
    sourceIndex: datum.sourceIndex,
    key: datum.key,
    sourceKeys: datum.sourceKeys,
    markId: mark.id,
    mark: mark.kind,
    title: mark.title,
    channels: datum.values,
    series: datum.series,
    order,
  });
}

function mapped(scale: ResolvedScale, value: unknown, center = false): number | null {
  if (!validScaleValue(value) && typeof value !== "boolean") return null;
  const result = scale.map(value as ScaleInput);
  return typeof result === "number" && Number.isFinite(result)
    ? result + (center ? (scale.bandwidth ?? 0) / 2 : 0)
    : null;
}

function groupBySeries<Row>(data: readonly PreparedDatum<Row>[]) {
  const groups = new Map<string, PreparedDatum<Row>[]>();
  for (const datum of data) {
    const key = datum.series ?? "__default__";
    const group = groups.get(key) ?? [];
    group.push(datum);
    groups.set(key, group);
  }
  return groups;
}

function titleFor<Row>(datum: PreparedDatum<Row>): string {
  if (datum.titleValue != null) return String(datum.titleValue);
  return Object.entries(datum.values)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(", ");
}

function defaultSummary<Row>(label: string, context: PlotSummaryContext<Row>): string {
  const omitted =
    context.omittedRowCount > 0
      ? ` ${context.omittedRowCount} row${context.omittedRowCount === 1 ? " was" : "s were"} omitted because required values were missing or invalid.`
      : "";
  return `${label} contains ${context.visibleRowCount} visible data point${context.visibleRowCount === 1 ? "" : "s"} from ${context.sourceRowCount} source row${context.sourceRowCount === 1 ? "" : "s"}.${omitted}`;
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

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "missing";
  return String(value);
}

function compositeIdentity(...parts: readonly (string | null)[]): string {
  return JSON.stringify(parts);
}

function serializeValue(value: unknown): string {
  return value instanceof Date ? `date:${value.getTime()}` : `${typeof value}:${String(value)}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validTemporalScaleValue(value: unknown): value is number | Date {
  return isFiniteNumber(value) || validDate(value);
}

function validPaintScaleValue(value: unknown): value is ScaleInput {
  return typeof value === "boolean" || validScaleValue(value);
}

function validTextValue(value: unknown): boolean {
  return typeof value === "boolean" || validScaleValue(value);
}

function isColorScale(scale: ResolvedScale): boolean {
  return scale.type === "ordinal-color" || scale.type === "continuous-color";
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

function intersectsPlot(
  x: number,
  y: number,
  width: number,
  height: number,
  plot: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    x + width < plot.x ||
    x > plot.x + plot.width ||
    y + height < plot.y ||
    y > plot.y + plot.height
  );
}

function pointInPlot(
  x: number,
  y: number,
  plot: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= plot.x && x <= plot.x + plot.width && y >= plot.y && y <= plot.y + plot.height;
}

function emptyCompiled<Row>(): {
  marks: SceneMark<Row>[];
  hits: HitRegion<Row>[];
} {
  return { marks: [], hits: [] };
}

function boundMeterValue(value: unknown, props: Readonly<Record<string, unknown>>): unknown {
  if (!isFiniteNumber(value)) return value;
  const minimum = isFiniteNumber(props.min) ? props.min : Number.NEGATIVE_INFINITY;
  const maximum = isFiniteNumber(props.max) ? props.max : Number.POSITIVE_INFINITY;
  return Math.max(Math.min(minimum, maximum), Math.min(Math.max(minimum, maximum), value));
}

function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function clampRadius(value: unknown, maximum: number, fallback: number): number {
  const resolved = finiteOr(value, fallback);
  return Math.max(0, Math.min(maximum, resolved <= 1 ? resolved * maximum : resolved));
}

function toCurve(value: unknown): "linear" | "step" | "monotone" {
  return value === "step" || value === "monotone" ? value : "linear";
}

function toPointShape(value: unknown): "circle" | "square" | "diamond" {
  return value === "square" || value === "diamond" ? value : "circle";
}

function toTextAlign(value: unknown): CanvasTextAlign {
  return ["left", "right", "center", "start", "end"].includes(String(value))
    ? (value as CanvasTextAlign)
    : "center";
}

function toTextBaseline(value: unknown): CanvasTextBaseline {
  return ["top", "hanging", "middle", "alphabetic", "ideographic", "bottom"].includes(String(value))
    ? (value as CanvasTextBaseline)
    : "middle";
}

function isLegendPosition(value: unknown): value is "top" | "right" | "bottom" | "left" {
  return value === "top" || value === "right" || value === "bottom" || value === "left";
}
