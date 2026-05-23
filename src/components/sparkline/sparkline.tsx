import { For } from "@askrjs/askr";
import { getChartSeriesColor, normalizeValueChartData } from "../../core";
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
  variant = "bar",
  style,
  summary,
  valueFormatter,
  ...rest
}: SparklineProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "fade",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const normalized = normalizeValueChartData(data, {
    min,
    max,
    valueFormatter: formatter,
  });
  const sparklineLineColor = normalized.data.find((datum) => datum.color)?.color;
  const sparklineLinePoints = normalized.data.map((datum, index, all) => {
    const x = all.length <= 1 ? 50 : (index / (all.length - 1)) * 100;
    const y = 100 - datum.fraction * 100;

    return { x, y };
  });
  const sparklineLinePolygon =
    variant === "line" && sparklineLinePoints.length > 0
      ? `polygon(${[
          ...sparklineLinePoints.map(
            ({ x, y }) => `${x.toFixed(3)}% ${Math.max(y - 2.5, 0).toFixed(3)}%`,
          ),
          ...[...sparklineLinePoints]
            .reverse()
            .map(({ x, y }) => `${x.toFixed(3)}% ${Math.min(y + 2.5, 100).toFixed(3)}%`),
        ].join(", ")})`
      : undefined;
  const summaryId = createChartId("sparkline-summary", id ?? label);
  const tableId = createChartId("sparkline-table", id ?? label);
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-ak-variant={variant}
      data-slot="sparkline"
      className={cx("ak-chart", "ak-sparkline", className)}
      style={mergeChartStyles(
        {
          ...(variant === "line" && sparklineLineColor
            ? { "--ak-chart-item-color": sparklineLineColor }
            : {}),
          ...animationStyle,
        },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-sparkline-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        {variant === "line" && sparklineLinePolygon ? (
          <span
            data-slot="sparkline-stroke"
            className="ak-sparkline-stroke"
            aria-hidden="true"
            style={mergeChartStyles({
              "--ak-sparkline-polygon": sparklineLinePolygon,
            })}
          />
        ) : null}
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
                  "--ak-chart-item-color": getChartSeriesColor(index(), datum.color),
                  "--ak-chart-item-index": index(),
                  "--ak-chart-item-min-block-size":
                    variant === "line" ? 0 : datum.value > 0 ? "0.5rem" : 0,
                  "--ak-chart-item-value": `${datum.fraction * 100}%`,
                })}
                aria-label={`${datum.label}: ${datum.formattedValue}`}
              >
                {variant === "line" ? null : (
                  <span data-slot="sparkline-stem" className="ak-sparkline-stem" />
                )}
                <span data-slot="sparkline-dot" className="ak-sparkline-dot" />
                <span className="ak-chart-sr-only">
                  {datum.label}: {datum.formattedValue}
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
