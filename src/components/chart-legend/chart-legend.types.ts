import type { ChartBaseProps } from "../_internal/types";

export interface ChartLegendItem {
  label: string;
  value?: string;
  color?: string;
}

export interface ChartLegendProps extends ChartBaseProps {
  title?: string;
  items: ChartLegendItem[];
}
