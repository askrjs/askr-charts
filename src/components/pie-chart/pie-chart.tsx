import { For } from "@askrjs/askr";
import { getChartSeriesColor, getValueChartTotal, normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  chartTooltipTriggerProps,
  createChartId,
  getValueChartSummary,
  mergeChartProps,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { PieChartProps } from "./pie-chart.types";

function toPiePoint(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * radius;
  const y = 50 + Math.sin(radians) * radius;

  return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
}

function buildPieSegmentClipPath(start: number, end: number) {
  const sweep = Math.max(0, end - start);
  if (sweep <= 0) return null;

  const segments = Math.max(4, Math.ceil(sweep / 18));
  const points = ["50% 50%"];

  for (let index = 0; index <= segments; index += 1) {
    const angle = start + (sweep * index) / segments;
    points.push(toPiePoint(angle, 50));
  }

  return `polygon(${points.join(", ")})`;
}

export function PieChart({
  animate,
  animation,
  className,
  data,
  id,
  label,
  labelDensity = "full",
  style,
  summary,
  valueFormatter,
  ...rest
}: PieChartProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "sweep",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const total = getValueChartTotal(data);
  const normalized = normalizeValueChartData(data, {
    max: total || 1,
    valueFormatter: formatter,
  });
  const summaryId = createChartId("pie-chart-summary", id ?? label);
  const tableId = createChartId("pie-chart-table", id ?? label);
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);
  const pieStops: string[] = [];
  const pieSegments: Array<{
    clipPath: string | null;
    color: string;
    datum: (typeof normalized.data)[number];
    index: number;
  }> = [];
  let lastPositiveIndex = -1;
  let cursor = 0;

  for (let index = 0; index < normalized.data.length; index += 1) {
    if (normalized.data[index]!.value > 0) {
      lastPositiveIndex = index;
    }
  }

  if (total > 0) {
    for (let index = 0; index < normalized.data.length; index += 1) {
      const datum = normalized.data[index]!;
      const slice = datum.fraction * 360;
      const start = cursor;
      const end = index === lastPositiveIndex ? 360 : cursor + slice;
      const gap =
        datum.value > 0 && index < lastPositiveIndex ? Math.min(2, Math.max(0, end - start)) : 0;
      const segmentEnd = Math.max(start, end - gap);
      const color = getChartSeriesColor(index, datum.color);

      if (datum.value > 0 && segmentEnd > start) {
        pieStops.push(`${color} ${start}deg ${segmentEnd}deg`);
      }

      if (gap > 0) {
        pieStops.push(`var(--ak-chart-color-muted) ${segmentEnd}deg ${end}deg`);
      }

      if (datum.value > 0) {
        pieSegments.push({
          clipPath: buildPieSegmentClipPath(start, end),
          color,
          datum,
          index,
        });
      }

      cursor = end;
    }
  }

  const pieStopsValue =
    pieStops.length > 0 ? pieStops.join(", ") : "var(--ak-chart-color-muted) 0deg 360deg";

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="pie-chart"
      className={cx("ak-chart", "ak-pie-chart", className)}
      style={mergeChartStyles({ "--ak-chart-pie-stops": pieStopsValue, ...animationStyle }, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-pie-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="pie-chart-disc-wrap" className="ak-pie-chart-disc-wrap">
          <div
            data-ak-chart-item="true"
            data-slot="pie-chart-disc"
            className="ak-pie-chart-disc"
            style={mergeChartStyles({ "--ak-chart-item-index": 0 })}
            aria-hidden="true"
          />

          <For each={pieSegments} by={(segment) => `${segment.datum.label}-${segment.index}`}>
            {(segment) => (
              <button
                type="button"
                data-ak-chart-item="true"
                data-ak-chart-tooltip-trigger="true"
                data-slot="pie-chart-segment"
                className="ak-pie-chart-segment"
                aria-label={`${segment.datum.label}: ${segment.datum.formattedValue}`}
                tabIndex={0}
                style={mergeChartStyles({
                  "--ak-chart-item-color": segment.color,
                  "--ak-chart-item-index": segment.index,
                  "--ak-pie-segment-clip-path": segment.clipPath ?? "none",
                })}
              >
                <span className="ak-chart-sr-only">
                  {segment.datum.label}: {segment.datum.formattedValue}
                </span>
                <span data-slot="tooltip-content" className="chart-tooltip" role="tooltip">
                  <span className="chart-tooltip-title">{segment.datum.label}</span>
                  <span className="chart-tooltip-value">{segment.datum.formattedValue}</span>
                  {segment.datum.description ? <span>{segment.datum.description}</span> : null}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>

      <ol data-slot="pie-chart-list" className="ak-pie-chart-list">
        <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
          {(datum, index) => (
            <li
              data-ak-chart-item="true"
              data-ak-chart-tooltip-trigger="true"
              data-slot="pie-chart-item"
              className="ak-pie-chart-item"
              tabIndex={0}
              style={mergeChartStyles({
                "--ak-chart-item-color": getChartSeriesColor(index(), datum.color),
                "--ak-chart-item-index": index(),
              })}
            >
              <span
                data-slot="pie-chart-swatch"
                className="ak-pie-chart-swatch"
                aria-hidden="true"
              />
              <span data-slot="pie-chart-label" className="ak-pie-chart-label">
                {datum.label}
              </span>
              <span data-slot="pie-chart-value" className="ak-pie-chart-value">
                {datum.formattedValue}
              </span>
              <span data-slot="tooltip-content" className="chart-tooltip" role="tooltip">
                <span className="chart-tooltip-title">{datum.label}</span>
                <span className="chart-tooltip-value">{datum.formattedValue}</span>
                {datum.description ? <span>{datum.description}</span> : null}
              </span>
            </li>
          )}
        </For>
      </ol>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getValueChartSummary(label, normalized.data, total || 1, summary, formatter)}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Segment</th>
            <th scope="col">Value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum) => (
              <tr>
                <th scope="row">{datum.label}</th>
                <td>{datum.formattedValue}</td>
                <td>{datum.description ?? ""}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}
