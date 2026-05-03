import type { ChartValueFormatter, ValueChartDatumInput } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface AreaChartProps extends ChartVisualBaseProps {
  data: readonly ValueChartDatumInput[];
  label: string;
  min?: number;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}
