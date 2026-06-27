import { For } from "@askrjs/askr";
import {
  formatChartValue,
  getChartSeriesColor,
  getValueChartTotal,
  normalizeValueChartData,
} from "../../core";
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
import type { DonutChartProps } from "./donut-chart.types";

const DONUT_INNER_RADIUS = 31;

function toDonutPoint(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * radius;
  const y = 50 + Math.sin(radians) * radius;
  return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
}

function buildDonutSegmentClipPath(start: number, end: number) {
  const sweep = Math.max(0, end - start);
  if (sweep <= 0) return null;

  const segments = Math.max(4, Math.ceil(sweep / 18));
  const outerPoints: string[] = [];
  const innerPoints: string[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = start + (sweep * index) / segments;
    outerPoints.push(toDonutPoint(angle, 50));
  }

  for (let index = segments; index >= 0; index -= 1) {
    const angle = start + (sweep * index) / segments;
    innerPoints.push(toDonutPoint(angle, DONUT_INNER_RADIUS));
  }

  return `polygon(${[...outerPoints, ...innerPoints].join(", ")})`;
}

export function DonutChart({
  animate,
  animation,
  className,
  data,
  id,
  label,
  labelDensity = "full",
  style,
  summary,
  totalLabel = "Total",
  valueFormatter,
  ...rest
}: DonutChartProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "sweep",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const total = getValueChartTotal(data);
  const normalized = normalizeValueChartData(data, {
    max: total || 1,
    valueFormatter: formatter,
  });
  const formattedTotal = formatChartValue(total, formatter);
  const summaryId = createChartId("donut-chart-summary", id ?? label);
  const tableId = createChartId("donut-chart-table", id ?? label);
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);
  const donutStops: string[] = [];
  const donutSegments: Array<{
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
        donutStops.push(`${color} ${start}deg ${segmentEnd}deg`);
      }

      if (gap > 0) {
        donutStops.push(`var(--ak-chart-donut-gap-color) ${segmentEnd}deg ${end}deg`);
      }

      if (datum.value > 0) {
        donutSegments.push({
          clipPath: buildDonutSegmentClipPath(start, end),
          color,
          datum,
          index,
        });
      }

      cursor = end;
    }
  }

  const donutStopsValue =
    donutStops.length > 0 ? donutStops.join(", ") : "var(--ak-chart-color-muted) 0deg 360deg";

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="donut-chart"
      className={cx("ak-chart", "ak-donut-chart", className)}
      style={mergeChartStyles(
        {
          "--ak-chart-donut-gap-color": "var(--ak-chart-color-surface)",
          "--ak-chart-donut-stops": donutStopsValue,
          ...animationStyle,
        },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-donut-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="donut-chart-ring-wrap" className="ak-donut-chart-ring-wrap">
          <div
            data-ak-chart-item="true"
            data-slot="donut-chart-ring"
            className="ak-donut-chart-ring"
            style={mergeChartStyles({ "--ak-chart-item-index": 0 })}
            aria-hidden="true"
          />

          <For each={donutSegments} by={(segment) => `${segment.datum.label}-${segment.index}`}>
            {(segment) => {
              const tooltipId = createChartId(
                "donut-chart-segment-tooltip",
                `${id ?? label}-${segment.datum.label}-${segment.index}`,
              );

              return (
                <span data-slot="donut-chart-segment-wrap" className="ak-donut-chart-segment-wrap">
                  <button
                    type="button"
                    data-ak-chart-item="true"
                    data-ak-chart-tooltip-trigger="true"
                    data-slot="donut-chart-segment"
                    className="ak-donut-chart-segment"
                    aria-label={`${segment.datum.label}: ${segment.datum.formattedValue}`}
                    aria-describedby={tooltipId}
                    tabIndex={0}
                    style={mergeChartStyles({
                      "--ak-chart-item-color": segment.color,
                      "--ak-chart-item-index": segment.index,
                      "--ak-donut-segment-clip-path": segment.clipPath ?? "none",
                    })}
                  >
                    <span className="ak-chart-sr-only">
                      {segment.datum.label}: {segment.datum.formattedValue}
                    </span>
                  </button>
                  <span
                    id={tooltipId}
                    data-slot="tooltip-content"
                    className="ak-donut-chart-segment-tooltip chart-tooltip"
                    role="tooltip"
                  >
                    <span className="chart-tooltip-title">{segment.datum.label}</span>
                    <span className="chart-tooltip-value">{segment.datum.formattedValue}</span>
                    {segment.datum.description ? <span>{segment.datum.description}</span> : null}
                  </span>
                </span>
              );
            }}
          </For>

          <div data-slot="donut-chart-center" className="ak-donut-chart-center">
            <span data-slot="donut-chart-total-label" className="ak-donut-chart-total-label">
              {totalLabel}
            </span>
            <strong data-slot="donut-chart-total-value" className="ak-donut-chart-total-value">
              {formattedTotal}
            </strong>
          </div>
        </div>
      </div>

      <ol data-slot="donut-chart-list" className="ak-donut-chart-list">
        <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
          {(datum, index) => (
            <li
              data-ak-chart-item="true"
              data-ak-chart-tooltip-trigger="true"
              data-slot="donut-chart-item"
              className="ak-donut-chart-item"
              tabIndex={0}
              style={mergeChartStyles({
                "--ak-chart-item-color": getChartSeriesColor(index(), datum.color),
                "--ak-chart-item-index": index(),
                "--ak-chart-item-value": `${datum.fraction * 100}%`,
              })}
            >
              <span
                data-slot="donut-chart-swatch"
                className="ak-donut-chart-swatch"
                aria-hidden="true"
              />
              <span data-slot="donut-chart-label" className="ak-donut-chart-label">
                {datum.label}
              </span>
              <span data-slot="donut-chart-value" className="ak-donut-chart-value">
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
