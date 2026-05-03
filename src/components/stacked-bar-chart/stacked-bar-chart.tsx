import { For } from "@askrjs/askr";
import { clampChartValue, formatChartValue, getValueChartMax } from "../../core";
import { cx } from "../_internal/classnames";
import {
  createChartId,
  mergeChartStyles,
  resolveChartAnimation,
  resolveValueFormatter,
} from "../_internal/chart-helpers";
import type { StackedBarChartProps } from "./stacked-bar-chart.types";

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
  const rows = data.map((datum) => ({
    ...datum,
    segments: [...datum.segments],
  }));
  const formatter = resolveValueFormatter(valueFormatter);
  const totals = rows.map((datum) =>
    datum.segments.reduce((sum, segment) => sum + clampChartValue(segment.value), 0),
  );
  const scaleMax =
    max == null
      ? getValueChartMax(
          totals.map((value, index) => ({ label: rows[index]?.label ?? String(index), value })),
        )
      : getValueChartMax([], max);
  const summaryId = createChartId("stacked-bar-chart-summary", id ?? label);
  const tableId = createChartId("stacked-bar-chart-table", id ?? label);
  const peakIndex = totals.reduce(
    (bestIndex, value, index, all) => (value > (all[bestIndex] ?? 0) ? index : bestIndex),
    0,
  );
  const defaultSummary =
    rows.length === 0
      ? `${label}. No stacked bar rows available.`
      : `${label}. ${rows.length} rows. Largest total is ${formatChartValue(totals[peakIndex] ?? 0, formatter)} for ${rows[peakIndex]?.label ?? ""}. Scale max is ${formatChartValue(scaleMax, formatter)}.`;

  return (
    <section
      {...rest}
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
          <For each={rows} by={(datum, rowIndex) => `${datum.label}-${rowIndex}`}>
            {(datum, rowIndex) => {
              const total = totals[rowIndex()] ?? 0;
              return (
                <li data-slot="stacked-bar-chart-item" className="ak-stacked-bar-chart-item">
                  <span data-slot="stacked-bar-chart-label" className="ak-stacked-bar-chart-label">
                    {datum.label}
                  </span>
                  <span data-slot="stacked-bar-chart-track" className="ak-stacked-bar-chart-track">
                    <For
                      each={datum.segments}
                      by={(segment, segmentIndex) => `${segment.label}-${segmentIndex}`}
                    >
                      {(segment, segmentIndex) => (
                        <span
                          data-ak-chart-item="true"
                          data-ak-chart-tooltip-trigger="true"
                          data-slot="stacked-bar-chart-segment"
                          className="ak-stacked-bar-chart-segment"
                          aria-label={`${segment.label}: ${formatChartValue(segment.value, formatter)}`}
                          tabIndex={0}
                          style={mergeChartStyles({
                            "--ak-chart-item-color":
                              segment.color ?? `var(--ak-chart-series-${(segmentIndex() % 6) + 1})`,
                            "--ak-chart-item-index": segmentIndex(),
                            "--ak-chart-item-min-size": segment.value > 0 ? "0.25rem" : 0,
                            "--ak-chart-item-value": `${total > 0 ? (clampChartValue(segment.value) / total) * 100 : 0}%`,
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
                            <span className="chart-tooltip-value">
                              {formatChartValue(segment.value, formatter)}
                            </span>
                            {(segment.description ?? datum.description) ? (
                              <span>{segment.description ?? datum.description}</span>
                            ) : null}
                          </span>
                        </span>
                      )}
                    </For>
                  </span>
                  <span data-slot="stacked-bar-chart-value" className="ak-stacked-bar-chart-value">
                    {formatChartValue(total, formatter)}
                  </span>
                </li>
              );
            }}
          </For>
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
          <For each={rows} by={(datum, rowIndex) => `${datum.label}-${rowIndex}`}>
            {(datum) => (
              <For
                each={datum.segments}
                by={(segment, segmentIndex) => `${datum.label}-${segment.label}-${segmentIndex}`}
              >
                {(segment) => (
                  <tr>
                    <th scope="row">{datum.label}</th>
                    <td>{segment.label}</td>
                    <td>{formatChartValue(segment.value, formatter)}</td>
                    <td>{segment.description ?? datum.description ?? ""}</td>
                  </tr>
                )}
              </For>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}
