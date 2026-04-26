import { clampChartValue, formatChartValue, toChartFraction } from "../../core";
import { cx } from "../_internal/classnames";
import { createChartId, mergeChartStyles, resolveValueFormatter } from "../_internal/chart-helpers";
import type { ProgressMeterProps } from "./progress-meter.types";

export function ProgressMeter({
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
}: ProgressMeterProps) {
  const formatter = resolveValueFormatter(valueFormatter);
  const normalizedMax = Math.max(1, clampChartValue(max));
  const normalizedValue = Math.min(clampChartValue(value), normalizedMax);
  const fraction = toChartFraction(normalizedValue, normalizedMax);
  const percentage = Math.round(fraction * 100);
  const summaryId = createChartId("progress-meter-summary", id ?? label);
  const meterId = createChartId("progress-meter-value", id ?? label);

  return (
    <section
      {...rest}
      id={id}
      data-slot="progress-meter"
      className={cx("ak-chart", "ak-progress-meter", className)}
      style={mergeChartStyles(
        {
          "--ak-chart-item-value": `${Math.max(2, percentage)}%`,
        },
        style,
      )}
    >
      <div className="ak-progress-meter-header" data-slot="progress-meter-header">
        <span data-slot="progress-meter-label" className="ak-progress-meter-label">
          {label}
        </span>
        <span id={meterId} data-slot="progress-meter-value" className="ak-progress-meter-value">
          {formatChartValue(normalizedValue, formatter)} /{" "}
          {formatChartValue(normalizedMax, formatter)}
        </span>
      </div>

      <div
        data-slot="progress-meter-track"
        className="ak-progress-meter-track"
        role="meter"
        aria-label={label}
        aria-describedby={summaryId}
        aria-valuemin={0}
        aria-valuemax={normalizedMax}
        aria-valuenow={normalizedValue}
        aria-valuetext={`${percentage}%`}
      >
        <span data-slot="progress-meter-fill" className="ak-progress-meter-fill" />
      </div>

      {description ? (
        <p data-slot="progress-meter-description" className="ak-progress-meter-description">
          {description}
        </p>
      ) : null}

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {summary ??
          `${label}. ${percentage}% complete at ${formatChartValue(normalizedValue, formatter)} out of ${formatChartValue(normalizedMax, formatter)}.`}
      </p>
    </section>
  );
}
