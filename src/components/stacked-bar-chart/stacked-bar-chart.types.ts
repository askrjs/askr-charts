import type { ChartValueFormatter } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface StackedBarChartSegment {
  label: string;
  value: number;
  color?: string;
  description?: string;
}

export interface StackedBarChartDatum {
  label: string;
  segments: readonly StackedBarChartSegment[];
  description?: string;
}

export interface StackedBarChartProps extends ChartVisualBaseProps {
  data: readonly StackedBarChartDatum[];
  label: string;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}
