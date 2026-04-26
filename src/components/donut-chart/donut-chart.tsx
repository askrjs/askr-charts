import { buildDonutStops, getValueChartTotal, normalizeValueChartData } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  getValueChartSummary,
  mergeChartStyles,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { DonutChartProps } from "./donut-chart.types";

export function DonutChart({
  className,
  data,
  id,
  label,
  style,
  summary,
  totalLabel = "Total",
  valueFormatter,
  ...rest
}: DonutChartProps) {
  const normalized = normalizeValueChartData(data, {
    max: getValueChartTotal(data) || 1,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const total = getValueChartTotal(data);
  const summaryId = createChartId("donut-chart-summary", id ?? label);
  const tableId = createChartId("donut-chart-table", id ?? label);
  const donutStops = buildDonutStops(normalized.data);

  return (
    <section
      {...rest}
      id={id}
      data-slot="donut-chart"
      className={cx("ak-chart", "ak-donut-chart", className)}
      style={mergeChartStyles({ "--ak-chart-donut-stops": donutStops }, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-donut-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="donut-chart-ring" className="ak-donut-chart-ring" aria-hidden="true" />
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

      <ol data-slot="donut-chart-list" className="ak-donut-chart-list">
        {normalized.data.map((datum, index) => (
          <li
            key={`${datum.label}-${index}`}
            data-slot="donut-chart-item"
            className="ak-donut-chart-item"
            style={mergeChartStyles({
              "--ak-chart-item-color": datum.color ?? `var(--ak-chart-series-${(index % 6) + 1})`,
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
          </li>
        ))}
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
