import { downsamplePixelEnvelope } from "../../paths";
import type { ResolvedScale } from "../../scales";
import type { PlotKey } from "../../model";
import type { HitRegion, SceneMark, ScenePoint } from "../../scene-model";
import {
  SERIES_LINE_DASHES,
  emptyCompiled,
  finiteOr,
  groupBySeries,
  mapped,
  markBase,
  pointSourceKeys,
  resolveDash,
  titleFor,
  toCurve,
  type PreparedMark,
} from "../shared";

export function compileLines<Row>(
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
  let groupIndex = 0;
  for (const data of groups.values()) {
    const seriesIndex = groupIndex;
    groupIndex += 1;
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
      dash:
        mark.props.dash === undefined && groups.size > 1
          ? SERIES_LINE_DASHES[seriesIndex % SERIES_LINE_DASHES.length]!
          : resolveDash(mark.props.dash, "Line"),
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

export function clipPointsToPlotX(
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
