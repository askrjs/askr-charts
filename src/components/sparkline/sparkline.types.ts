import type { ChartValueFormatter, ValueChartDatum } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface SparklineProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatum[];
  label: string;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}
