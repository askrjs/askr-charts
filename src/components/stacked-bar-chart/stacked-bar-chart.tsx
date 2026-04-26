import { clampChartValue, formatChartValue, getValueChartMax } from "../../core";
import { cx } from "../_internal/classnames";
import { createChartId, mergeChartStyles, resolveValueFormatter } from "../_internal/chart-helpers";
import type { StackedBarChartProps } from "./stacked-bar-chart.types";

export function StackedBarChart({
  className,
  data,
  id,
  label,
  max,
  style,
  summary,
  valueFormatter,
  ...rest
}: StackedBarChartProps) {
  const formatter = resolveValueFormatter(valueFormatter);
  const totals = data.map((datum) =>
    datum.segments.reduce((sum, segment) => sum + clampChartValue(segment.value), 0),
  );
  const scaleMax =
    max == null
      ? getValueChartMax(
          totals.map((value, index) => ({ label: data[index]?.label ?? String(index), value })),
        )
      : getValueChartMax([], max);
  const summaryId = createChartId("stacked-bar-chart-summary", id ?? label);
  const tableId = createChartId("stacked-bar-chart-table", id ?? label);
  const peakIndex = totals.reduce(
    (bestIndex, value, index, all) => (value > (all[bestIndex] ?? 0) ? index : bestIndex),
    0,
  );
  const defaultSummary =
    data.length === 0
      ? `${label}. No stacked bar rows available.`
      : `${label}. ${data.length} rows. Largest total is ${formatChartValue(totals[peakIndex] ?? 0, formatter)} for ${data[peakIndex]?.label ?? ""}. Scale max is ${formatChartValue(scaleMax, formatter)}.`;

  return (
    <section
      {...rest}
      id={id}
      data-slot="stacked-bar-chart"
      className={cx("ak-chart", "ak-stacked-bar-chart", className)}
      style={mergeChartStyles({ "--ak-chart-max": scaleMax }, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="stacked-bar-chart-list" className="ak-stacked-bar-chart-list">
          {data.map((datum, rowIndex) => {
            const total = totals[rowIndex] ?? 0;
            return (
              <li
                key={`${datum.label}-${rowIndex}`}
                data-slot="stacked-bar-chart-item"
                className="ak-stacked-bar-chart-item"
              >
                <span data-slot="stacked-bar-chart-label" className="ak-stacked-bar-chart-label">
                  {datum.label}
                </span>
                <span data-slot="stacked-bar-chart-track" className="ak-stacked-bar-chart-track">
                  {datum.segments.map((segment, segmentIndex) => (
                    <span
                      key={`${segment.label}-${segmentIndex}`}
                      data-slot="stacked-bar-chart-segment"
                      className="ak-stacked-bar-chart-segment"
                      aria-label={`${segment.label}: ${formatChartValue(segment.value, formatter)}`}
                      style={mergeChartStyles({
                        "--ak-chart-item-color":
                          segment.color ?? `var(--ak-chart-series-${(segmentIndex % 6) + 1})`,
                        "--ak-chart-item-value": `${total > 0 ? Math.max(2, (clampChartValue(segment.value) / total) * 100) : 0}%`,
                      })}
                    />
                  ))}
                </span>
                <span data-slot="stacked-bar-chart-value" className="ak-stacked-bar-chart-value">
                  {formatChartValue(total, formatter)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p id={summaryId} data-slot="chart-summary" className="ak-chart-summary">
        {summary ?? defaultSummary}
      </p>

      <table id={tableId} data-slot="chart-table" className="ak-chart-table ak-chart-sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Segment</th>
            <th scope="col">Value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {data.flatMap((datum, rowIndex) =>
            datum.segments.map((segment, segmentIndex) => (
              <tr key={`${datum.label}-${segment.label}-${segmentIndex}`}>
                <th scope="row">{datum.label}</th>
                <td>{segment.label}</td>
                <td>{formatChartValue(segment.value, formatter)}</td>
                <td>{segment.description ?? datum.description ?? ""}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}
