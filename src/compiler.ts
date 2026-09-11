import type { PlotDescriptor } from "./descriptors";
import { isChannelExpression } from "./expressions";
import type { AxisProps, PlotKey, PlotRowKey, PlotSummaryContext, PlotView } from "./model";
import { readRowKey } from "./rows";
import type {
  HitRegion,
  PlotScene,
  SceneDiagnostic,
  SceneExportRow,
  SceneMark,
} from "./scene-model";
import { resolveAxes, resolveGrids, resolveInteractions, resolveLegends } from "./compiler/axes-legends";
import {
  collectInvalidLogSourceKeys,
  collectScaleUses,
  compileMark,
  prepareMark,
} from "./compiler/marks";
import { resolveScales } from "./compiler/scales";
import { MARK_KINDS } from "./compiler/shared";

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

  const legends = resolveLegends(options.descriptors, scales, scaleUses, sourceRows.length === 0);
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

function defaultSummary<Row>(label: string, context: PlotSummaryContext<Row>): string {
  const omitted =
    context.omittedRowCount > 0
      ? ` ${context.omittedRowCount} row${context.omittedRowCount === 1 ? " was" : "s were"} omitted because required values were missing or invalid.`
      : "";
  return `${label} contains ${context.visibleRowCount} visible data point${context.visibleRowCount === 1 ? "" : "s"} from ${context.sourceRowCount} source row${context.sourceRowCount === 1 ? "" : "s"}.${omitted}`;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
