import { describe, expect, it } from "vite-plus/test";
import type { SceneLineMark, SceneMark, ScenePoint, ScenePointMark } from "../src/scene-model";
import {
  interpolateSceneMarks,
  MAX_KEYED_TRANSITION_MARKS,
  resolveSceneTransitionMode,
} from "../src/transitions";

interface Row {
  id: string;
  value: number;
}

describe("canvas scene transitions", () => {
  it("should interpolate geometry by typed stable row key given reordered mark indices", () => {
    const previous = [point("point-0-a-0", "a", 0, 10), point("point-0-old-1", "old", 30, 30)];
    const next = [point("point-0-a-4", "a", 100, 50), point("point-0-new-5", "new", 60, 70)];

    const halfway = interpolateSceneMarks(previous, next, 0.5);
    const stable = halfway.find((mark) => mark.key === "a");
    const entering = halfway.find((mark) => mark.key === "new");
    const exiting = halfway.find((mark) => mark.key === "old");

    expect(stable).toMatchObject({ kind: "point", x: 50, y: 30, opacity: 1 });
    expect(entering).toMatchObject({ kind: "point", x: 60, y: 70, opacity: 0.5 });
    expect(exiting).toMatchObject({ kind: "point", x: 30, y: 30, opacity: 0.5 });
  });

  it("should preserve the low-cost cutoff given more than five thousand visible marks", () => {
    const previous = Array.from({ length: MAX_KEYED_TRANSITION_MARKS + 1 }, (_, index) =>
      point(`point-0-${index}-${index}`, index, index, 0),
    );
    const next = previous.map((mark) => ({ ...mark, x: mark.x + 1 }));

    expect(resolveSceneTransitionMode(previous, next, new Set(), false)).toBe("single");
    expect(
      resolveSceneTransitionMode(
        previous.slice(0, MAX_KEYED_TRANSITION_MARKS),
        next.slice(0, MAX_KEYED_TRANSITION_MARKS),
        new Set(),
        false,
      ),
    ).toBe("keyed");
    expect(resolveSceneTransitionMode(previous, next, new Set(), true)).toBe("none");
  });

  it("should retain defined line gaps given stable points across keyed frames", () => {
    const previous = line("line-0-a-0", [[scenePoint("a", 0, 10)], [scenePoint("b", 100, 20)]]);
    const next = line("line-0-a-7", [[scenePoint("a", 20, 30)], [scenePoint("b", 140, 40)]]);

    const halfway = interpolateSceneMarks([previous], [next], 0.5)[0] as SceneLineMark<Row>;

    expect(halfway.segments).toHaveLength(2);
    expect(halfway.segments.map((segment) => segment[0]?.x)).toEqual([10, 120]);
    expect(halfway.points.map(({ key }) => key)).toEqual(["a", "b"]);
  });

  it("should count path vertices as weighted geometry units given the keyed transition cutoff", () => {
    const points = Array.from({ length: MAX_KEYED_TRANSITION_MARKS + 1 }, (_, index) =>
      scenePoint(String(index), index, index % 10),
    );
    const previous = line("line-0-series-0", [points]);
    const next = line("line-0-series-1", [points.map((point) => ({ ...point, y: point.y + 1 }))]);

    expect(resolveSceneTransitionMode([previous], [next], new Set(), false)).toBe("single");
  });
});

function point(id: string, key: string | number, x: number, y: number): ScenePointMark<Row> {
  return {
    id,
    key,
    sourceIndex: 0,
    row: { id: String(key), value: y },
    kind: "point",
    fill: "#2563eb",
    stroke: "none",
    opacity: 1,
    title: String(key),
    series: null,
    channels: {},
    x,
    y,
    radius: 3,
    shape: "circle",
  } satisfies SceneMark<Row>;
}

function line(id: string, segments: readonly (readonly ScenePoint[])[]): SceneLineMark<Row> {
  return {
    id,
    key: "a",
    sourceIndex: 0,
    row: { id: "a", value: 1 },
    kind: "line",
    fill: "none",
    stroke: "#2563eb",
    opacity: 1,
    title: "series",
    series: null,
    channels: {},
    segments,
    points: segments.flat(),
    curve: "linear",
    strokeWidth: 2,
  };
}

function scenePoint(key: string, x: number, y: number): ScenePoint {
  return { key, x, y, sourceIndex: 0 };
}
