import { For } from "@askrjs/askr";
import { normalizeValueChartData } from "../../core";
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
import type { LineChartProps } from "./line-chart.types";

export function LineChart({
  animate,
  animation,
  className,
  data,
  id,
  label,
  labelDensity = "full",
  min,
  max,
  showGrid,
  style,
  summary,
  valueFormatter,
  ...rest
}: LineChartProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "fade",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const normalized = normalizeValueChartData(data, {
    min,
    max,
    valueFormatter: formatter,
  });
  const points = normalized.data;
  const linePoints = points.map((datum, index, all) => {
    const x = all.length <= 1 ? 50 : (index / (all.length - 1)) * 100;
    const y = 100 - datum.fraction * 100;

    return { x, y };
  });
  const lineTop = linePoints.map(({ x, y }) => `${x.toFixed(3)}% ${Math.max(y - 1.1, 0)}%`);
  const lineBottom = [...linePoints]
    .reverse()
    .map(({ x, y }) => `${x.toFixed(3)}% ${Math.min(y + 1.1, 100)}%`);
  const linePolygon =
    linePoints.length > 0
      ? `polygon(${[...lineTop, ...lineBottom].join(", ")})`
      : "polygon(0% 50%, 100% 50%)";
  const summaryId = createChartId("line-chart-summary", id ?? label);
  const tableId = createChartId("line-chart-table", id ?? label);
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-ak-show-grid={showGrid ? "true" : undefined}
      data-ak-label-density={labelDensity}
      data-slot="line-chart"
      className={cx("ak-chart", "ak-line-chart", className)}
      style={mergeChartStyles(
        {
          "--ak-chart-max": normalized.max,
          ...animationStyle,
        },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-line-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <span
          data-slot="line-chart-stroke-wrap"
          className="ak-line-chart-stroke-wrap"
          aria-hidden="true"
        >
          <span
            data-slot="line-chart-stroke"
            className="ak-line-chart-stroke"
            aria-hidden="true"
            style={mergeChartStyles({
              "--ak-line-chart-polygon": linePolygon,
            })}
          />
        </span>
        <ol data-slot="line-chart-list" className="ak-line-chart-list">
          <For each={points} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum, index) => (
              <li
                data-ak-chart-item="true"
                data-ak-chart-tooltip-trigger="true"
                data-slot="line-chart-item"
                data-ak-line-terminal={index() === points.length - 1 ? "true" : undefined}
                className="ak-line-chart-item"
                tabIndex={0}
                style={mergeChartStyles({
                  "--ak-chart-item-color": datum.color ?? "var(--ak-chart-color-primary)",
                  "--ak-chart-item-index": index(),
                  "--ak-chart-item-min-block-size": datum.value > 0 ? "0.75rem" : 0,
                  "--ak-chart-item-value": `${datum.fraction * 100}%`,
                })}
              >
                <span
                  data-slot="line-chart-stage"
                  className="ak-line-chart-stage"
                  aria-hidden="true"
                >
                  <span data-slot="line-chart-connector" className="ak-line-chart-connector" />
                  <span data-slot="line-chart-point" className="ak-line-chart-point" />
                </span>
                <span data-slot="line-chart-label" className="ak-line-chart-label">
                  {datum.label}
                </span>
                <span data-slot="line-chart-value" className="ak-line-chart-value">
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
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getValueChartSummary(label, normalized.data, normalized.max, summary, formatter)}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
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
