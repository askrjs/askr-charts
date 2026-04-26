import { cx } from "../_internal/classnames";
import type { ChartEmptyStateProps } from "./chart-empty-state.types";

export function ChartEmptyState({
  children,
  className,
  description,
  style,
  title,
  ...rest
}: ChartEmptyStateProps) {
  return (
    <section
      data-slot="chart-empty-state"
      className={cx("chart-empty-state", "ak-chart-empty-state", className)}
      style={style}
      {...rest}
    >
      <h3 data-slot="chart-empty-state-title" className="chart-empty-state-title">
        {title}
      </h3>
      {description ? (
        <p data-slot="chart-empty-state-description" className="chart-empty-state-description">
          {description}
        </p>
      ) : null}
      {children ? (
        <div data-slot="chart-empty-state-content" className="chart-empty-state-content">
          {children}
        </div>
      ) : null}
    </section>
  );
}
