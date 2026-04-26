import { normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { SparklineProps } from "./sparkline.types";

export function Sparkline({
  className,
  data,
  id,
  label,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: SparklineProps) {
  const normalized = normalizeValueChartData(data, {
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("sparkline-summary", id ?? label);
  const tableId = createChartId("sparkline-table", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      data-slot="sparkline"
      className={cx("ak-chart", "ak-sparkline", className)}
      style={style}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-sparkline-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="sparkline-list" className="ak-sparkline-list">
          {normalized.data.map((datum, index) => (
            <li
              key={`${datum.label}-${index}`}
              data-slot="sparkline-item"
              className="ak-sparkline-item"
              style={mergeChartStyles({
                "--ak-chart-item-color": datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`,
                "--ak-chart-item-value": `${Math.max(8, datum.fraction * 100)}%`,
              })}
              aria-label={`${datum.label}: ${datum.formattedValue}`}
            >
              <span data-slot="sparkline-stem" className="ak-sparkline-stem" />
              <span data-slot="sparkline-dot" className="ak-sparkline-dot" />
              <span className="ak-chart-sr-only">
                {datum.label}: {datum.formattedValue}
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
            <th scope="col">Point</th>
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
