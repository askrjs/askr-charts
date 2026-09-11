import { isFiniteNumber } from "../../transforms";
import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import {
  SERIES_POINT_SHAPES,
  emptyCompiled,
  finiteOr,
  mapped,
  markBase,
  pointInPlot,
  toPointShape,
  type PreparedMark,
} from "../shared";

export function compilePoints<Row>(
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
  const series = [...new Set(mark.data.map((datum) => datum.series ?? "__default__"))];
  const cycleShapes = mark.props.shape === undefined && series.length > 1;
  const shapesBySeries = new Map(
    series.map((name, index) => [name, SERIES_POINT_SHAPES[index % SERIES_POINT_SHAPES.length]!]),
  );
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
      shape: cycleShapes
        ? (shapesBySeries.get(datum.series ?? "__default__") ?? "circle")
        : toPointShape(mark.props.shape),
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
