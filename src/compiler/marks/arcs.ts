import { isFiniteNumber } from "../../transforms";
import type { ResolvedScale } from "../../scales";
import type { HitRegion, SceneMark } from "../../scene-model";
import { clampRadius, emptyCompiled, finiteOr, markBase, type PreparedMark } from "../shared";

export function compileArcs<Row>(
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
