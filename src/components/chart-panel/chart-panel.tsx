import { cx } from "../_internal/classnames";
import type { ChartPanelProps } from "./chart-panel.types";

export function ChartPanel({
  children,
  className,
  description,
  style,
  title,
  ...rest
}: ChartPanelProps) {
  return (
    <article
      data-slot="chart-panel"
      className={cx("chart-panel", "ak-chart-panel", className)}
      style={style}
      {...rest}
    >
      {title || description ? (
        <header data-slot="chart-panel-header" className="chart-panel-header">
          {title ? (
            <h3 data-slot="chart-panel-title" className="chart-panel-title">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p data-slot="chart-panel-description" className="chart-panel-description">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}

      <div data-slot="chart-panel-body" className="chart-panel-body">
        {children}
      </div>
    </article>
  );
}
