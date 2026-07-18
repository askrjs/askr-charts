import type { PlotKey } from "./model";
import type { SceneMark, ScenePoint } from "./scene-model";

export const MAX_KEYED_TRANSITION_MARKS = 5_000;

export type SceneTransitionMode = "none" | "keyed" | "single";

/**
 * Chooses the cheapest transition that preserves per-row geometry motion.
 * Hidden series do not contribute to the visible-mark threshold.
 */
export function resolveSceneTransitionMode<Row>(
  previous: readonly SceneMark<Row>[],
  next: readonly SceneMark<Row>[],
  hiddenSeries: ReadonlySet<string>,
  reducedMotion: boolean,
): SceneTransitionMode {
  if (reducedMotion || !marksVisuallyChanged(previous, next)) return "none";
  const visibleCount = Math.max(
    countVisibleMarks(previous, hiddenSeries),
    countVisibleMarks(next, hiddenSeries),
  );
  if (visibleCount === 0) return "none";
  return visibleCount > MAX_KEYED_TRANSITION_MARKS ? "single" : "keyed";
}

/**
 * Builds an internal paint-only mark list for one keyed animation frame.
 * Compiler scenes remain immutable; the returned objects are never exposed.
 */
export function interpolateSceneMarks<Row>(
  previous: readonly SceneMark<Row>[],
  next: readonly SceneMark<Row>[],
  progress: number,
): readonly SceneMark<Row>[] {
  const amount = clamp01(progress);
  if (amount >= 1) return next;

  const previousByIdentity = markBuckets(previous);
  const used = new Set<SceneMark<Row>>();
  const result: SceneMark<Row>[] = [];

  for (const mark of next) {
    const prior = takeMatchingMark(previousByIdentity.get(markIdentity(mark)), mark, used);
    if (prior) {
      used.add(prior);
      result.push(interpolateMark(prior, mark, amount));
    } else {
      result.push(enteringMark(mark, amount));
    }
  }

  if (amount < 1) {
    for (const mark of previous) {
      if (!used.has(mark)) result.push(withOpacity(mark, mark.opacity * (1 - amount)));
    }
  }
  return result;
}

function countVisibleMarks<Row>(
  marks: readonly SceneMark<Row>[],
  hiddenSeries: ReadonlySet<string>,
): number {
  let count = 0;
  for (const mark of marks) {
    if (!mark.series || !hiddenSeries.has(mark.series)) count += geometryWeight(mark);
  }
  return count;
}

function geometryWeight<Row>(mark: SceneMark<Row>): number {
  if (mark.kind === "line")
    return Math.max(1, mark.segments.reduce((sum, segment) => sum + segment.length, 0));
  if (mark.kind === "area") return Math.max(1, mark.points.length + mark.baseline.length);
  return 1;
}

function enteringMark<Row>(mark: SceneMark<Row>, amount: number): SceneMark<Row> {
  const opacity = mark.opacity * amount;
  switch (mark.kind) {
    case "bar":
      return { ...mark, opacity, y: mark.y + mark.height * (1 - amount), height: mark.height * amount };
    case "cell":
    case "rect":
      return {
        ...mark,
        opacity,
        x: mark.x + (mark.width * (1 - amount)) / 2,
        y: mark.y + (mark.height * (1 - amount)) / 2,
        width: mark.width * amount,
        height: mark.height * amount,
      };
    case "point":
      return { ...mark, opacity, radius: mark.radius * amount };
    case "arc":
      return { ...mark, opacity, endAngle: mark.startAngle + (mark.endAngle - mark.startAngle) * amount };
    case "rule":
      return { ...mark, opacity, x2: mark.x1 + (mark.x2 - mark.x1) * amount, y2: mark.y1 + (mark.y2 - mark.y1) * amount };
    case "line": {
      const segments = mark.segments.map((segment) => segment.slice(0, Math.max(1, Math.ceil(segment.length * amount))));
      return { ...mark, opacity, segments, points: segments.flat() };
    }
    case "area": {
      const length = Math.max(1, Math.ceil(mark.points.length * amount));
      return { ...mark, opacity, points: mark.points.slice(0, length), baseline: mark.baseline.slice(0, length) };
    }
    case "text":
      return { ...mark, opacity };
  }
}

function marksVisuallyChanged<Row>(
  previous: readonly SceneMark<Row>[],
  next: readonly SceneMark<Row>[],
): boolean {
  if (previous.length !== next.length) return true;
  for (let index = 0; index < next.length; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (!before || !after || markIdentity(before) !== markIdentity(after)) return true;
    if (!marksEqual(before, after)) return true;
  }
  return false;
}

function marksEqual<Row>(left: SceneMark<Row>, right: SceneMark<Row>): boolean {
  if (
    left.kind !== right.kind ||
    left.fill !== right.fill ||
    left.stroke !== right.stroke ||
    left.opacity !== right.opacity
  ) {
    return false;
  }
  switch (left.kind) {
    case "bar":
    case "cell":
    case "rect":
      return (
        right.kind === left.kind &&
        left.x === right.x &&
        left.y === right.y &&
        left.width === right.width &&
        left.height === right.height &&
        left.radius === right.radius
      );
    case "point":
      return (
        right.kind === "point" &&
        left.x === right.x &&
        left.y === right.y &&
        left.radius === right.radius &&
        left.shape === right.shape
      );
    case "arc":
      return (
        right.kind === "arc" &&
        left.cx === right.cx &&
        left.cy === right.cy &&
        left.innerRadius === right.innerRadius &&
        left.outerRadius === right.outerRadius &&
        left.startAngle === right.startAngle &&
        left.endAngle === right.endAngle &&
        left.padAngle === right.padAngle &&
        left.cornerRadius === right.cornerRadius
      );
    case "rule":
      return (
        right.kind === "rule" &&
        left.x1 === right.x1 &&
        left.y1 === right.y1 &&
        left.x2 === right.x2 &&
        left.y2 === right.y2 &&
        left.strokeWidth === right.strokeWidth &&
        numericArraysEqual(left.dash, right.dash)
      );
    case "text":
      return (
        right.kind === "text" &&
        left.x === right.x &&
        left.y === right.y &&
        left.text === right.text &&
        left.align === right.align &&
        left.baseline === right.baseline &&
        left.font === right.font
      );
    case "line":
      return (
        right.kind === "line" &&
        left.curve === right.curve &&
        left.strokeWidth === right.strokeWidth &&
        pointArraysEqual(left.points, right.points) &&
        segmentArraysEqual(readLineSegments(left), readLineSegments(right))
      );
    case "area":
      return (
        right.kind === "area" &&
        left.curve === right.curve &&
        pointArraysEqual(left.points, right.points) &&
        pointArraysEqual(left.baseline, right.baseline)
      );
  }
}

function markBuckets<Row>(marks: readonly SceneMark<Row>[]): Map<string, SceneMark<Row>[]> {
  const result = new Map<string, SceneMark<Row>[]>();
  for (const mark of marks) {
    const identity = markIdentity(mark);
    const bucket = result.get(identity);
    if (bucket) bucket.push(mark);
    else result.set(identity, [mark]);
  }
  return result;
}

function takeMatchingMark<Row>(
  candidates: readonly SceneMark<Row>[] | undefined,
  next: SceneMark<Row>,
  used: ReadonlySet<SceneMark<Row>>,
): SceneMark<Row> | undefined {
  return candidates?.find((candidate) => candidate.kind === next.kind && !used.has(candidate));
}

function markIdentity<Row>(mark: SceneMark<Row>): string {
  const ordinal = new RegExp(`^${mark.kind}-(\\d+)-`).exec(mark.id)?.[1] ?? mark.id;
  if (mark.kind === "line" || mark.kind === "area") {
    return `${mark.kind}:${ordinal}:${mark.series ?? ""}`;
  }
  return `${mark.kind}:${ordinal}:${keyIdentity(mark.key)}`;
}

function keyIdentity(key: PlotKey | string): string {
  return `${typeof key}:${String(key)}`;
}

function interpolateMark<Row>(
  previous: SceneMark<Row>,
  next: SceneMark<Row>,
  amount: number,
): SceneMark<Row> {
  if (previous.kind !== next.kind) return withOpacity(next, next.opacity * amount);
  const opacity = lerp(previous.opacity, next.opacity, amount);
  switch (next.kind) {
    case "bar":
    case "cell":
    case "rect": {
      if (previous.kind !== next.kind) return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        x: lerp(previous.x, next.x, amount),
        y: lerp(previous.y, next.y, amount),
        width: lerp(previous.width, next.width, amount),
        height: lerp(previous.height, next.height, amount),
        radius: lerp(previous.radius, next.radius, amount),
      };
    }
    case "point":
      if (previous.kind !== "point") return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        x: lerp(previous.x, next.x, amount),
        y: lerp(previous.y, next.y, amount),
        radius: lerp(previous.radius, next.radius, amount),
      };
    case "arc":
      if (previous.kind !== "arc") return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        cx: lerp(previous.cx, next.cx, amount),
        cy: lerp(previous.cy, next.cy, amount),
        innerRadius: lerp(previous.innerRadius, next.innerRadius, amount),
        outerRadius: lerp(previous.outerRadius, next.outerRadius, amount),
        startAngle: lerp(previous.startAngle, next.startAngle, amount),
        endAngle: lerp(previous.endAngle, next.endAngle, amount),
        padAngle: lerp(previous.padAngle, next.padAngle, amount),
        cornerRadius: lerp(previous.cornerRadius, next.cornerRadius, amount),
      };
    case "rule":
      if (previous.kind !== "rule") return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        x1: lerp(previous.x1, next.x1, amount),
        y1: lerp(previous.y1, next.y1, amount),
        x2: lerp(previous.x2, next.x2, amount),
        y2: lerp(previous.y2, next.y2, amount),
        strokeWidth: lerp(previous.strokeWidth, next.strokeWidth, amount),
        dash: interpolateNumbers(previous.dash, next.dash, amount),
      };
    case "text":
      if (previous.kind !== "text") return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        x: lerp(previous.x, next.x, amount),
        y: lerp(previous.y, next.y, amount),
      };
    case "line": {
      if (previous.kind !== "line") return withOpacity(next, opacity);
      const points = interpolatePoints(previous.points, next.points, amount);
      const previousSegments = readLineSegments(previous);
      const segments = readLineSegments(next).map((segment, index) =>
        interpolatePoints(previousSegments[index] ?? [], segment, amount),
      );
      return {
        ...next,
        opacity,
        points,
        segments,
        strokeWidth: lerp(previous.strokeWidth, next.strokeWidth, amount),
      } as SceneMark<Row>;
    }
    case "area":
      if (previous.kind !== "area") return withOpacity(next, opacity);
      return {
        ...next,
        opacity,
        points: interpolatePoints(previous.points, next.points, amount),
        baseline: interpolatePoints(previous.baseline, next.baseline, amount),
      };
  }
}

function withOpacity<Row>(mark: SceneMark<Row>, opacity: number): SceneMark<Row> {
  return { ...mark, opacity } as SceneMark<Row>;
}

function interpolatePoints(
  previous: readonly ScenePoint[],
  next: readonly ScenePoint[],
  amount: number,
): readonly ScenePoint[] {
  const previousByKey = new Map(previous.map((point) => [keyIdentity(point.key), point]));
  return next.map((point) => {
    const prior = previousByKey.get(keyIdentity(point.key));
    return prior
      ? {
          ...point,
          x: lerp(prior.x, point.x, amount),
          y: lerp(prior.y, point.y, amount),
        }
      : point;
  });
}

function interpolateNumbers(
  previous: readonly number[],
  next: readonly number[],
  amount: number,
): readonly number[] {
  return next.map((value, index) => lerp(previous[index] ?? value, value, amount));
}

function pointArraysEqual(left: readonly ScenePoint[], right: readonly ScenePoint[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      keyIdentity(point.key) === keyIdentity(other.key) &&
      point.x === other.x &&
      point.y === other.y
    );
  });
}

function segmentArraysEqual(
  left: readonly (readonly ScenePoint[])[],
  right: readonly (readonly ScenePoint[])[],
): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => pointArraysEqual(segment, right[index] ?? []))
  );
}

function numericArraysEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readLineSegments<Row>(
  mark: Extract<SceneMark<Row>, { kind: "line" }>,
): readonly (readonly ScenePoint[])[] {
  const segments = (
    mark as Extract<SceneMark<Row>, { kind: "line" }> & {
      readonly segments?: readonly (readonly ScenePoint[])[];
    }
  ).segments;
  return Array.isArray(segments) ? segments : [mark.points];
}

function lerp(start: number, stop: number, amount: number): number {
  return start + (stop - start) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}
