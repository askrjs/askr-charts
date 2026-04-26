import type { ChartValueFormatter } from "../../core";
import type { ChartVisualBaseProps } from "../_internal/types";

export interface FlameGraphDatum {
  label: string;
  value: number;
  color?: string;
  description?: string;
  children?: readonly FlameGraphDatum[];
}

export interface FlameGraphProps extends ChartVisualBaseProps {
  data: readonly FlameGraphDatum[];
  label: string;
  summary?: string;
  max?: number;
  valueFormatter?: ChartValueFormatter;
}
