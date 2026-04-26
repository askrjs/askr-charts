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
  [key: string]: unknown;
}
