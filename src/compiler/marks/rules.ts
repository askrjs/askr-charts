import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import { emptyCompiled, finiteOr, mapped, markBase, resolveDash, type PreparedMark } from "../shared";

export function compileRules<Row>(
  mark: PreparedMark<Row>,
  scales: Readonly<Record<string, ResolvedScale>>,
  plotArea: { x: number; y: number; width: number; height: number },
  startOrder: number,
) {
  const xScale = scales[String(mark.props.xScale ?? "x")];
  const yScale = scales[String(mark.props.yScale ?? "y")];
  if (!xScale || !yScale) return emptyCompiled<Row>();
  const dash = resolveDash(mark.props.dash, "Rule");
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
