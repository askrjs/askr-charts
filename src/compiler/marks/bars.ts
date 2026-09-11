import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import {
  boundMeterValue,
  emptyCompiled,
  finiteOr,
  intersectsPlot,
  mapped,
  markBase,
  rectHit,
  type PreparedMark,
} from "../shared";

export function compileBars<Row>(
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
