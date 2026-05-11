import type { ChartValueFormatter } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export type ProgressMeterVariant = "default" | "success" | "warning" | "danger";

export interface ProgressMeterProps extends ChartVisualBaseProps {
  label: string;
  value: number;
  max?: number;
  summary?: string;
  valueFormatter?: ChartValueFormatter;
  description?: string;
  variant?: ProgressMeterVariant;
  color?: string;
}
