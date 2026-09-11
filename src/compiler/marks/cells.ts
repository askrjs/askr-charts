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

export function compileCells<Row>(
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
