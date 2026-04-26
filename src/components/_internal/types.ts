import type { ChartAnimation } from "../../core";

export type ChartBaseProps = {
  id?: string;
  className?: string;
  style?: string | Record<string, string | number | undefined>;
  children?: unknown;
} & Record<string, unknown>;

export interface ChartVisualBaseProps {
  id?: string;
  className?: string;
  style?: string | Record<string, string | number | undefined>;
  animate?: boolean;
  animation?: ChartAnimation;
  [key: string]: unknown;
}
