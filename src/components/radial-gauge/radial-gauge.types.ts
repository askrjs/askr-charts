import type { ChartValueFormatter } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface RadialGaugeProps extends ChartVisualBaseProps {
  label: string;
  value: number;
  max?: number;
  summary?: string;
  valueFormatter?: ChartValueFormatter;
  description?: string;
}
