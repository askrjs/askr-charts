import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import {
  emptyCompiled,
  mapped,
  markBase,
  pointInPlot,
  toTextAlign,
  toTextBaseline,
  type PreparedMark,
} from "../shared";

export function compileTexts<Row>(
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
