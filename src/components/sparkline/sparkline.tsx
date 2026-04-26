import { For } from "@askrjs/askr";
import { normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { SparklineProps } from "./sparkline.types";

export function Sparkline({
  animate,
  animation,
  className,
  data,
  id,
  label,
  min,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: SparklineProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "fade",
  });
  const normalized = normalizeValueChartData(data, {
    min,
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("sparkline-summary", id ?? label);
  const tableId = createChartId("sparkline-table", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-slot="sparkline"
      className={cx("ak-chart", "ak-sparkline", className)}
      style={mergeChartStyles(animationStyle, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-sparkline-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="sparkline-list" className="ak-sparkline-list">
          <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum, index) => (
              <li
                data-ak-chart-item="true"
                data-ak-chart-tooltip-trigger="true"
                data-slot="sparkline-item"
                className="ak-sparkline-item"
                tabIndex={0}
                style={mergeChartStyles({
                  "--ak-chart-item-color":
                    datum.color ?? `var(--ak-chart-series-${(index() % 6) + 1})`,
                  "--ak-chart-item-index": index(),
                  "--ak-chart-item-min-block-size": datum.value > 0 ? "0.5rem" : 0,
                  "--ak-chart-item-value": `${datum.fraction * 100}%`,
                })}
                aria-label={`${datum.label}: ${datum.formattedValue}`}
              >
                <span data-slot="sparkline-stem" className="ak-sparkline-stem" />
                <span data-slot="sparkline-dot" className="ak-sparkline-dot" />
                <span className="ak-chart-sr-only">
                  {datum.label}: {datum.formattedValue}
                </span>
                <span data-slot="chart-tooltip" className="chart-tooltip" role="tooltip">
                  <span data-slot="chart-tooltip-title" className="chart-tooltip-title">
                    {datum.label}
                  </span>
                  <span data-slot="chart-tooltip-value" className="chart-tooltip-value">
                    {datum.formattedValue}
                  </span>
                  {datum.description ? <span>{datum.description}</span> : null}
                </span>
              </li>
            )}
          </For>
        </ol>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {getValueChartSummary(label, normalized.data, normalized.max, summary)}
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
