import type { HitIndex } from "../hit-index";
import type { PlotApi, PlotKey, PlotView } from "../model";
import type { PlotTheme } from "../render";
import type { HitRegion, PlotScene } from "../scene-model";
import type { PlotRuntimeConfig } from "../controller";

export interface DragState {
  readonly mode: "pan" | "brush";
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startView: PlotView;
  moved: boolean;
  currentX: number;
  currentY: number;
}

export interface ControllerState<Row> {
  host: HTMLElement;
  chromeCanvas: HTMLCanvasElement;
  marksCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  tooltip: HTMLElement | null;
  tooltipHideTimer: ReturnType<typeof setTimeout> | null;
  config: PlotRuntimeConfig<Row>;
  scene: PlotScene<Row>;
  hitIndex: HitIndex<Row>;
  theme: PlotTheme;
  internalView: PlotView | undefined;
  internalSelection: Set<PlotKey>;
  hiddenSeries: Set<string>;
  focusIndex: number;
  focusKeyToRestore: PlotKey | null;
  hover: HitRegion<Row> | null;
  hoverCohort: readonly HitRegion<Row>[];
  drag: DragState | null;
  pointers: Map<number, { x: number; y: number }>;
  pinchDistance: number | null;
  followPaused: boolean;
  frozenFollowRows: readonly Row[] | null;
  fullView: PlotView;
  transientView: PlotView | null;
  viewCommitTimer: ReturnType<typeof setTimeout> | null;
  suppressClick: boolean;
  destroyed: boolean;
  compileQueued: boolean;
  compileDeferredForGesture: boolean;
  frameHandle: number | null;
  inspectionFrameHandle: number | null;
  pendingInspectionPoint: { x: number; y: number } | null;
  pendingDataTransition: boolean;
  hasPaintedScene: boolean;
  transitionScene: PlotScene<Row> | null;
  transitionFrameHandle: number | null;
  canvasAnimation: Animation | null;
  currentApiChange: ((api: PlotApi<Row> | null) => void) | undefined;
  api: PlotApi<Row>;
  activeDiagnosticSignatures: Set<string>;
  cleanups: Array<() => void>;
}
