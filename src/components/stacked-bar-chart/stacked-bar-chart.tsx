import { clampChartValue, formatChartValue, getChartSeriesColor } from "../../core";
import { cx } from "../_internal/classnames";
import {
  chartTooltipTriggerProps,
  createChartId,
  mergeChartProps,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { StackedBarChartProps } from "./stacked-bar-chart.types";

interface StackedBarTableRow {
  description: string;
  key: string;
  rowLabel: string;
  segmentLabel: string;
  value: number;
}

export function StackedBarChart({
  animate,
  animation,
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
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "grow",
  });
  const formatter = resolveValueFormatter(valueFormatter);
  const totals: number[] = [];
  totals.length = data.length;
  const normalizedExplicitMax = max == null ? undefined : clampChartValue(max);
  let detectedScaleMax = 0;
  let peakIndex = 0;
  let peakTotal = 0;

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const datum = data[rowIndex]!;
    const segments = datum.segments;
    let total = 0;

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      total += clampChartValue(segments[segmentIndex]!.value);
    }

    totals[rowIndex] = total;
    if (total > detectedScaleMax) {
      detectedScaleMax = total;
    }

    if (rowIndex === 0 || total > peakTotal) {
      peakTotal = total;
      peakIndex = rowIndex;
    }
  }

  const scaleMax =
    normalizedExplicitMax == null
      ? detectedScaleMax > 0
        ? detectedScaleMax
        : 1
      : normalizedExplicitMax > 0
        ? normalizedExplicitMax
        : 1;
  const summaryId = createChartId("stacked-bar-chart-summary", id ?? label);
  const tableId = createChartId("stacked-bar-chart-table", id ?? label);
  const defaultSummary =
    data.length === 0
      ? `${label}. No stacked bar rows available.`
      : `${label}. ${data.length} rows. Largest total is ${formatChartValue(totals[peakIndex] ?? 0, formatter)} for ${data[peakIndex]?.label ?? ""}. Scale max is ${formatChartValue(scaleMax, formatter)}.`;
  const sectionProps = mergeChartProps(rest, chartTooltipTriggerProps);
  const tableRows: StackedBarTableRow[] = [];

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const datum = data[rowIndex]!;

    for (let segmentIndex = 0; segmentIndex < datum.segments.length; segmentIndex += 1) {
      const segment = datum.segments[segmentIndex]!;

      tableRows.push({
        description: segment.description ?? datum.description ?? "",
        key: `${datum.label}-${segment.label}-${rowIndex}-${segmentIndex}`,
        rowLabel: datum.label,
        segmentLabel: segment.label,
        value: clampChartValue(segment.value),
      });
    }
  }

  return (
    <section
      {...sectionProps}
      id={id}
      {...animationAttrs}
      data-slot="stacked-bar-chart"
      className={cx("ak-chart", "ak-stacked-bar-chart", className)}
      style={mergeChartStyles({ "--ak-chart-max": scaleMax, ...animationStyle }, style)}
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
            const rowFraction = scaleMax > 0 ? Math.min(total / scaleMax, 1) : 0;

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
                  <span
                    data-slot="stacked-bar-chart-stack"
                    className="ak-stacked-bar-chart-stack"
                    style={mergeChartStyles({ "--ak-chart-row-value": `${rowFraction * 100}%` })}
                  >
                    {datum.segments.map((segment, segmentIndex) => {
                      const segmentValue = clampChartValue(segment.value);
                      const formattedSegmentValue = formatChartValue(segmentValue, formatter);

                      return (
                        <span
                          key={`${datum.label}-${segment.label}-${segmentIndex}`}
                          data-ak-chart-item="true"
                          data-ak-chart-tooltip-trigger="true"
                          data-slot="stacked-bar-chart-segment"
                          className="ak-stacked-bar-chart-segment"
                          aria-label={`${segment.label}: ${formattedSegmentValue}`}
                          tabIndex={0}
                          style={mergeChartStyles({
                            "--ak-chart-item-color": getChartSeriesColor(
                              segmentIndex,
                              segment.color,
                            ),
                            "--ak-chart-item-index": segmentIndex,
                            "--ak-chart-item-min-size": segmentValue > 0 ? "0.25rem" : 0,
                            "--ak-chart-item-value": `${total > 0 ? (segmentValue / total) * 100 : 0}%`,
                          })}
                        >
                          <span
                            data-slot="tooltip-content"
                            className="chart-tooltip"
                            role="tooltip"
                          >
                            <span className="chart-tooltip-title">
                              {datum.label}: {segment.label}
                            </span>
                            <span className="chart-tooltip-value">{formattedSegmentValue}</span>
                            {(segment.description ?? datum.description) ? (
                              <span>{segment.description ?? datum.description}</span>
                            ) : null}
                          </span>
                        </span>
                      );
                    })}
                  </span>
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
          {tableRows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.rowLabel}</th>
              <td>{row.segmentLabel}</td>
              <td>{formatChartValue(row.value, formatter)}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
