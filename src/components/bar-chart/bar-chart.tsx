import { normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { BarChartProps } from "./bar-chart.types";

export function BarChart({
  className,
  data,
  id,
  label,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: BarChartProps) {
  const normalized = normalizeValueChartData(data, {
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("bar-chart-summary", id ?? label);
  const tableId = createChartId("bar-chart-table", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      data-slot="bar-chart"
      className={cx("ak-chart", "ak-bar-chart", className)}
      style={mergeChartStyles({ "--ak-chart-max": normalized.max }, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="bar-chart-list" className="ak-bar-chart-list">
          {normalized.data.map((datum, index) => (
            <li
              key={`${datum.label}-${index}`}
              data-slot="bar-chart-item"
              className="ak-bar-chart-item"
              style={mergeChartStyles({
                "--ak-chart-item-color": datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`,
                "--ak-chart-item-value": `${Math.max(4, datum.fraction * 100)}%`,
              })}
            >
              <span data-slot="bar-chart-label" className="ak-bar-chart-label">
                {datum.label}
              </span>
              <span data-slot="bar-chart-track" className="ak-bar-chart-track">
                <span data-slot="bar-chart-fill" className="ak-bar-chart-fill" />
              </span>
              <span data-slot="bar-chart-value" className="ak-bar-chart-value">
                {datum.formattedValue}
              </span>
            </li>
          ))}
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
          {normalized.data.map((datum, index) => (
            <tr key={`${datum.label}-${index}`}>
              <th scope="row">{datum.label}</th>
              <td>{datum.formattedValue}</td>
              <td>{datum.description ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
