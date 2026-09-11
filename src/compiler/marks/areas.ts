import type { ResolvedScale } from "../../scales";
import type { PlotKey } from "../../model";
import type { HitRegion, SceneMark } from "../../scene-model";
import {
  emptyCompiled,
  finiteOr,
  groupBySeries,
  mapped,
  markBase,
  pointSourceKeys,
  titleFor,
  toCurve,
  type MappedAreaDatum,
  type PreparedMark,
} from "../shared";

export function compileAreas<Row>(
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
