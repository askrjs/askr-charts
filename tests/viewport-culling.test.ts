import { describe, expect, it } from "vite-plus/test";
import { compilePlotScene } from "../src/compiler";
import type { PlotDescriptor } from "../src/descriptors";

interface Row {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly low: number;
}

const rows = Object.freeze(
  Array.from({ length: 101 }, (_, id): Row => ({ id, x: id, y: 20 + (id % 9), low: 10 })),
);
const descriptors: readonly PlotDescriptor[] = Object.freeze([
  Object.freeze({ kind: "Line", props: Object.freeze({ x: "x", y: "y" }) }),
  Object.freeze({ kind: "Area", props: Object.freeze({ x: "x", y: "y", y2: "low" }) }),
]);

describe("viewport scene culling", () => {
  it("should retain only immutable in-view line and area geometry given an explicit x view", () => {
    const scene = compilePlotScene({
      rows,
      rowKey: "id",
      label: "Viewport",
      descriptors,
      width: 800,
      height: 400,
      view: { x: [40, 60] },
    });
    const left = scene.plotArea.x;
    const right = left + scene.plotArea.width;
    const line = scene.marks.find((mark) => mark.kind === "line");
    const area = scene.marks.find((mark) => mark.kind === "area");

    expect(line?.kind).toBe("line");
    expect(area?.kind).toBe("area");
    if (line?.kind !== "line" || area?.kind !== "area") return;

    expect(line.points).toHaveLength(21);
    expect(area.points).toHaveLength(21);
    expect(area.baseline).toHaveLength(21);
    expect(line.points.every((point) => point.x >= left && point.x <= right)).toBe(true);
    expect(area.points.every((point) => point.x >= left && point.x <= right)).toBe(true);
    expect(scene.hits.every((hit) => hit.shape.kind !== "circle" || hit.shape.x >= left)).toBe(
      true,
    );
    expect(Object.isFrozen(line.points)).toBe(true);
    expect(Object.isFrozen(area.points)).toBe(true);
    expect(Object.isFrozen(area.baseline)).toBe(true);
    expect(Object.isFrozen(scene.hits)).toBe(true);
  });
});
