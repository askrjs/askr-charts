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
import type { AreaChartProps } from "./area-chart.types";

export function AreaChart({
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
}: AreaChartProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "grow",
  });
  const normalized = normalizeValueChartData(data, {
    min,
    max,
    valueFormatter: resolveValueFormatter(valueFormatter),
  });
  const summaryId = createChartId("area-chart-summary", id ?? label);
  const tableId = createChartId("area-chart-table", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-ak-label-density={labelDensity}
      data-slot="area-chart"
      className={cx("ak-chart", "ak-area-chart", className)}
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
        className="ak-chart-graphic ak-area-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="area-chart-list" className="ak-area-chart-list">
          <For each={normalized.data} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum, index) => (
              <li
                data-ak-chart-item="true"
                data-ak-chart-tooltip-trigger="true"
                data-slot="area-chart-item"
                className="ak-area-chart-item"
                tabIndex={0}
                style={mergeChartStyles({
                  "--ak-chart-item-color":
                    datum.color ?? `var(--ak-chart-series-${(index() % 6) + 1})`,
                  "--ak-chart-item-index": index(),
                  "--ak-chart-item-min-block-size": datum.value > 0 ? "1rem" : 0,
                  "--ak-chart-item-value": `${datum.fraction * 100}%`,
                })}
              >
                <span
                  data-slot="area-chart-stage"
                  className="ak-area-chart-stage"
                  aria-hidden="true"
                >
                  <span data-slot="area-chart-fill" className="ak-area-chart-fill" />
                  <span data-slot="area-chart-connector" className="ak-area-chart-connector" />
                  <span data-slot="area-chart-point" className="ak-area-chart-point" />
                </span>
                <span data-slot="area-chart-label" className="ak-area-chart-label">
                  {datum.label}
                </span>
                <span data-slot="area-chart-value" className="ak-area-chart-value">
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
        {summary ?? getValueChartSummary(label, normalized.data, normalized.max, summary)}
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
