import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import {
  emptyCompiled,
  finiteOr,
  intersectsPlot,
  mapped,
  markBase,
  rectHit,
  type PreparedMark,
} from "../shared";

export function compileRects<Row>(
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
