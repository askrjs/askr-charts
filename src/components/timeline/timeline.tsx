import { cx } from "../_internal/classnames";
import { createChartId, mergeChartStyles } from "../_internal/chart-helpers";
import type { TimelineProps } from "./timeline.types";

export function Timeline({ className, data, id, label, style, summary, ...rest }: TimelineProps) {
  const summaryId = createChartId("timeline-summary", id ?? label);
  const tableId = createChartId("timeline-table", id ?? label);
  const defaultSummary =
    data.length === 0
      ? `${label}. No timeline entries available.`
      : `${label}. ${data.length} milestones. First milestone is ${data[0]?.label ?? ""}. Latest milestone is ${data[data.length - 1]?.label ?? ""}.`;

  return (
    <section
      {...rest}
      id={id}
      data-slot="timeline"
      className={cx("ak-chart", "ak-timeline", className)}
      style={style}
    >
      <div
        data-slot="chart-graphic"
        className="ak-chart-graphic ak-timeline-graphic"
        role="img"
        aria-label={label}
        aria-describedby={`${summaryId} ${tableId}`}
      >
        <ol data-slot="timeline-list" className="ak-timeline-list">
          {data.map((datum, index) => (
            <li
              key={`${datum.label}-${index}`}
              data-slot="timeline-item"
              className="ak-timeline-item"
              style={
                datum.accentColor
                  ? mergeChartStyles({ "--ak-chart-item-color": datum.accentColor })
                  : undefined
              }
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
          ))}
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
          {data.map((datum, index) => (
            <tr key={`${datum.label}-${index}`}>
              <th scope="row">{datum.label}</th>
              <td>{datum.value ?? ""}</td>
              <td>{datum.description ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
