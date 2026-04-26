import { For } from "@askrjs/askr";
import { cx } from "../_internal/classnames";
import { createChartId, mergeChartStyles, resolveChartAnimation } from "../_internal/chart-helpers";
import type { TimelineProps } from "./timeline.types";

export function Timeline({
  animate,
  animation,
  className,
  data,
  id,
  label,
  style,
  summary,
  ...rest
}: TimelineProps) {
  const { animationAttrs, animationStyle } = resolveChartAnimation(animate, animation, {
    type: "slide",
  });
  const items = [...data];
  const summaryId = createChartId("timeline-summary", id ?? label);
  const tableId = createChartId("timeline-table", id ?? label);
  const defaultSummary =
    items.length === 0
      ? `${label}. No timeline entries available.`
      : `${label}. ${items.length} milestones. First milestone is ${items[0]?.label ?? ""}. Latest milestone is ${items[items.length - 1]?.label ?? ""}.`;

  return (
    <section
      {...rest}
      id={id}
      {...animationAttrs}
      data-slot="timeline"
      className={cx("ak-chart", "ak-timeline", className)}
      style={mergeChartStyles(animationStyle, style)}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-timeline-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="timeline-list" className="ak-timeline-list">
          <For each={items} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum, index) => (
              <li
                data-ak-chart-item="true"
                data-slot="timeline-item"
                className="ak-timeline-item"
                style={mergeChartStyles({
                  "--ak-chart-item-color": datum.accentColor,
                  "--ak-chart-item-index": index(),
                })}
              >
                <span data-slot="timeline-marker" className="ak-timeline-marker" aria-hidden="true" />
                <div data-slot="timeline-content" className="ak-timeline-content">
                  <div data-slot="timeline-header" className="ak-timeline-header">
                    <span data-slot="timeline-label" className="ak-timeline-label">
                      {datum.label}
                    </span>
                    {datum.value ? (
                      <span data-slot="timeline-value" className="ak-timeline-value">
                        {datum.value}
                      </span>
                    ) : null}
                  </div>
                  {datum.description ? (
                    <p data-slot="timeline-description" className="ak-timeline-description">
                      {datum.description}
                    </p>
                  ) : null}
                </div>
              </li>
            )}
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
            <th scope="col">Milestone</th>
            <th scope="col">Value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <For each={items} by={(datum, index) => `${datum.label}-${index}`}>
            {(datum) => (
              <tr>
                <th scope="row">{datum.label}</th>
                <td>{datum.value ?? ""}</td>
                <td>{datum.description ?? ""}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </section>
  );
}
