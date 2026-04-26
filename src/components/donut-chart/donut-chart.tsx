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
        <div
          data-ak-chart-item="true"
          data-slot="donut-chart-ring"
          className="ak-donut-chart-ring"
          style={mergeChartStyles({ "--ak-chart-item-index": 0 })}
          aria-hidden="true"
        />
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
