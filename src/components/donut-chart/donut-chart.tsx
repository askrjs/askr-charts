import { For } from "@askrjs/askr";
import { buildDonutStops, getValueChartTotal, normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { DonutChartProps } from "./donut-chart.types";

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
    innerPoints.push(toDonutPoint(angle, 28));
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
  const normalized = normalizeValueChartData(data, {
    max: getValueChartTotal(data) || 1,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const total = getValueChartTotal(data);
  const summaryId = createChartId("donut-chart-summary", id ?? label);
  const tableId = createChartId("donut-chart-table", id ?? label);
  const donutStops = buildDonutStops(normalized.data);
  let cursor = 0;
  const donutSegments = normalized.data
    .map((datum, index) => {
      if (datum.value <= 0) {
        return null;
      }

      const slice = datum.fraction * 360;
      const start = cursor;
      const end = index === normalized.data.length - 1 ? 360 : cursor + slice;
      cursor = end;

      return {
        clipPath: buildDonutSegmentClipPath(start, end),
        color: datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`,
        datum,
        index,
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => segment !== null);

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="donut-chart"
      className={cx("ak-chart", "ak-donut-chart", className)}
      style={mergeChartStyles({ "--ak-chart-donut-stops": donutStops, ...animationStyle }, style)}
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
            {(segment) => (
              <button
                type="button"
                data-ak-chart-item="true"
                data-ak-chart-tooltip-trigger="true"
                data-slot="donut-chart-segment"
                className="ak-donut-chart-segment"
                aria-label={`${segment.datum.label}: ${segment.datum.formattedValue}`}
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
                <span data-slot="tooltip-content" className="chart-tooltip" role="tooltip">
                  <span className="chart-tooltip-title">
                    {segment.datum.label}
                  </span>
                  <span className="chart-tooltip-value">
                    {segment.datum.formattedValue}
                  </span>
                  {segment.datum.description ? <span>{segment.datum.description}</span> : null}
                </span>
              </button>
            )}
          </For>

          <div data-slot="donut-chart-center" className="ak-donut-chart-center">
            <span data-slot="donut-chart-total-label" className="ak-donut-chart-total-label">
              {totalLabel}
            </span>
            <strong data-slot="donut-chart-total-value" className="ak-donut-chart-total-value">
              {normalized.data[0]
                ? normalized.data[0].formattedValue.replace(
                    /.+/,
                    new Intl.NumberFormat("en-US").format(total),
                  )
                : "0"}
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
                "--ak-chart-item-color":
                  datum.color ?? `var(--ak-chart-series-${(index() % 6) + 1})`,
                "--ak-chart-item-index": index(),
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
                <span className="chart-tooltip-title">
                  {datum.label}
                </span>
                <span className="chart-tooltip-value">
                  {datum.formattedValue}
                </span>
                {datum.description ? <span>{datum.description}</span> : null}
              </span>
            </li>
          )}
        </For>
      </ol>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getValueChartSummary(label, normalized.data, total || 1, summary)}
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
