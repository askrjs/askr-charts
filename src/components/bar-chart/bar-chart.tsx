import { For } from "@askrjs/askr";
import { mergeProps } from "@askrjs/askr/foundations";
import { normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  chartTooltipTriggerProps,
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { BarChartProps } from "./bar-chart.types";

export function BarChart({
  animate,
  animation,
  className,
  data,
  id,
  label,
  labelDensity = "full",
  min,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: BarChartProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "grow",
  });
  const normalized = normalizeValueChartData(data, {
    min,
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("bar-chart-summary", id ?? label);
  const tableId = createChartId("bar-chart-table", id ?? label);
  const sectionProps = mergeProps(rest, chartTooltipTriggerProps);

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="bar-chart"
      className={cx("ak-chart", "ak-bar-chart", className)}
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
        className="ak-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="bar-chart-list" className="ak-bar-chart-list">
          <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum, index) => (
              <li
                data-ak-chart-tooltip-trigger="true"
                data-slot="bar-chart-item"
                className="ak-bar-chart-item"
                tabIndex={0}
                style={mergeChartStyles({
                  "--ak-chart-item-color":
                    datum.color ?? `var(--ak-chart-series-${(index() % 6) + 1})`,
                  "--ak-chart-item-index": index(),
                  "--ak-chart-item-min-size": datum.value > 0 ? "0.5rem" : 0,
                  "--ak-chart-item-value": `${datum.fraction * 100}%`,
                })}
              >
                <span data-slot="bar-chart-label" className="ak-bar-chart-label">
                  {datum.label}
                </span>
                <span data-slot="bar-chart-track" className="ak-bar-chart-track">
                  <span
                    data-ak-chart-item="true"
                    data-slot="bar-chart-fill"
                    className="ak-bar-chart-fill"
                  />
                </span>
                <span data-slot="bar-chart-value" className="ak-bar-chart-value">
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
        {getValueChartSummary(label, normalized.data, normalized.max, summary)}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
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
