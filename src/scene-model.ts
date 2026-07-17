import type { AxisOrientation, PlotKey, ScaleValue } from "./model";
import type { ResolvedScale } from "./scales";

export interface ScenePoint {
  readonly x: number;
  readonly y: number;
  readonly sourceIndex: number;
  readonly key: PlotKey;
}

export interface SceneMarkBase<Row> {
  readonly id: string;
  readonly key: PlotKey | string;
  readonly sourceKeys?: readonly PlotKey[];
  readonly sourceIndex: number;
  readonly row: Row | null;
  readonly fill: string;
  readonly stroke: string;
  readonly opacity: number;
  readonly title: string;
  readonly series: string | null;
  readonly channels: Readonly<Record<string, unknown>>;
}

export interface SceneRectMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "bar" | "cell" | "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface SceneLineMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "line";
  /** Independently rendered runs. A false `defined` value separates adjacent runs. */
  readonly segments: readonly (readonly ScenePoint[])[];
  /** Flattened rendered points retained for hit testing and scene inspection. */
  readonly points: readonly ScenePoint[];
  readonly curve: "linear" | "step" | "monotone";
  readonly strokeWidth: number;
}

export interface SceneAreaMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "area";
  readonly points: readonly ScenePoint[];
  readonly baseline: readonly ScenePoint[];
  readonly curve: "linear" | "step" | "monotone";
}

export interface ScenePointMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "point";
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly shape: "circle" | "square" | "diamond";
}

export interface SceneArcMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "arc";
  readonly cx: number;
  readonly cy: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly padAngle: number;
  readonly cornerRadius: number;
}

export interface SceneRuleMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "rule";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly strokeWidth: number;
  readonly dash: readonly number[];
}

export interface SceneTextMark<Row> extends SceneMarkBase<Row> {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
  readonly font: string | null;
}

export type SceneMark<Row> =
  | SceneRectMark<Row>
  | SceneLineMark<Row>
  | SceneAreaMark<Row>
  | ScenePointMark<Row>
  | SceneArcMark<Row>
  | SceneRuleMark<Row>
  | SceneTextMark<Row>;

export type HitShape =
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "circle";
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | {
      readonly kind: "arc";
      readonly cx: number;
      readonly cy: number;
      readonly innerRadius: number;
      readonly outerRadius: number;
      readonly startAngle: number;
      readonly endAngle: number;
    }
  | {
      readonly kind: "line";
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly tolerance: number;
    };

export interface HitRegion<Row> {
  readonly id: string;
  readonly shape: HitShape;
  readonly row: Row;
  readonly sourceIndex: number;
  readonly key: PlotKey;
  readonly mark: SceneMark<Row>["kind"];
  readonly title: string;
  readonly channels: Readonly<Record<string, unknown>>;
  readonly series: string | null;
  readonly order: number;
}

export interface SceneTick {
  readonly value: ScaleValue;
  readonly position: number;
  readonly label: string;
}

export interface SceneAxis {
  readonly id: string;
  readonly scale: string;
  readonly orientation: AxisOrientation;
  readonly label: string | null;
  readonly ticks: readonly SceneTick[];
  readonly grid: boolean;
}

export interface SceneGrid {
  readonly id: string;
  readonly scale: string;
  readonly axis: "x" | "y";
  readonly positions: readonly number[];
}

export interface SceneLegendItem {
  readonly value: string;
  readonly label: string;
  readonly color: string;
}

export interface SceneLegend {
  readonly scale: string;
  readonly label: string | null;
  readonly interactive: boolean;
  readonly position: "top" | "right" | "bottom" | "left";
  readonly items: readonly SceneLegendItem[];
}

export interface SceneInteractions {
  readonly tooltip: boolean;
  readonly tooltipChannels?: readonly string[] | null;
  readonly tooltipFormat?:
    ((record: Readonly<Record<string, unknown>>) => string) | null;
  readonly crosshair: "x" | "y" | "xy" | null;
  readonly zoom: {
    readonly axes: "x" | "y" | "xy";
    readonly min: number;
    readonly max: number;
    readonly wheel: boolean;
    readonly pinch: boolean;
    readonly pan: boolean;
  } | null;
  readonly brush: {
    readonly axis: "x" | "y" | "xy";
    readonly modifier: "shift" | "none";
  } | null;
}

export interface SceneDiagnostic {
  readonly code: "missing-channel" | "invalid-log" | "duplicate-key" | "culled";
  readonly message: string;
  readonly count: number;
}

export interface SceneExportRow<Row> {
  readonly row: Row;
  readonly key: PlotKey;
  readonly sourceIndex: number;
  /** Stable source-row identities that contributed to this transformed row. */
  readonly sourceKeys: readonly PlotKey[];
  readonly visible: boolean;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface SceneSourceRow<Row> {
  readonly row: Row;
  readonly key: PlotKey;
  readonly sourceIndex: number;
  readonly visible: boolean;
}

export interface PlotScene<Row> {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly plotArea: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  readonly scales: Readonly<Record<string, ResolvedScale>>;
  readonly axes: readonly SceneAxis[];
  readonly grids: readonly SceneGrid[];
  readonly marks: readonly SceneMark<Row>[];
  readonly hits: readonly HitRegion<Row>[];
  readonly legends: readonly SceneLegend[];
  readonly interactions: SceneInteractions;
  readonly sourceRows: readonly Row[];
  readonly sourceRowRecords: readonly SceneSourceRow<Row>[];
  readonly transformedRows: readonly SceneExportRow<Row>[];
  readonly omittedRowCount: number;
  readonly visibleRowCount: number;
  readonly diagnostics: readonly SceneDiagnostic[];
  readonly summary: string;
  readonly empty: boolean;
}
