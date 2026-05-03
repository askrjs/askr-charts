import { clampChartValue, formatChartValue, toChartFraction } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { RadialGaugeProps } from "./radial-gauge.types";

export function RadialGauge({
  animate,
  animation,
  className,
  description,
  id,
  label,
  max = 100,
  style,
  summary,
  value,
  valueFormatter,
  ...rest
}: RadialGaugeProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "sweep",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const normalizedMax = Math.max(1, clampChartValue(max));
  const normalizedValue = Math.min(clampChartValue(value), normalizedMax);
  const fraction = toChartFraction(normalizedValue, normalizedMax);
  const percentage = Math.round(fraction * 100);
  const summaryId = createChartId("radial-gauge-summary", id ?? label);
  const tableId = createChartId("radial-gauge-table", id ?? label);
  const formattedValue = formatChartValue(normalizedValue, formatter);
  const formattedMax = formatChartValue(normalizedMax, formatter);

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-slot="radial-gauge"
      className={cx("ak-chart", "ak-radial-gauge", className)}
      style={mergeChartStyles(
        {
          "--ak-chart-item-value": `${percentage}%`,
          "--ak-chart-gauge-angle": `${fraction * 360}deg`,
          ...animationStyle,
        },
        style,
      )}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-radial-gauge-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <div data-slot="radial-gauge-dial" className="ak-radial-gauge-dial">
          <span data-slot="radial-gauge-ring" className="ak-radial-gauge-ring" aria-hidden="true" />
          <span data-slot="radial-gauge-center" className="ak-radial-gauge-center">
            <span data-slot="radial-gauge-label" className="ak-radial-gauge-label">
              {label}
            </span>
            <strong data-slot="radial-gauge-value" className="ak-radial-gauge-value">
              {formattedValue}
            </strong>
            <span data-slot="radial-gauge-scale" className="ak-radial-gauge-scale">
              {formattedValue} / {formattedMax}
            </span>
            {description ? (
              <span data-slot="radial-gauge-description" className="ak-radial-gauge-description">
                {description}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {summary ??
          `${label}. ${percentage}% complete at ${formattedValue} out of ${formattedMax}.`}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Value</th>
            <th scope="col">Max</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{label}</th>
            <td>{formattedValue}</td>
            <td>{formattedMax}</td>
            <td>{description ?? ""}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
