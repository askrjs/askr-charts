import { describe, expect, it } from "vite-plus/test";

import { arcPath, segmentedLinePath } from "../src/paths";

describe("mark paths", () => {
  it("should emit a fresh move command given each defined line segment", () => {
    const path = segmentedLinePath(
      [
        [
          { x: 0, y: 1 },
          { x: 10, y: 2 },
        ],
        [
          { x: 30, y: 4 },
          { x: 40, y: 5 },
        ],
      ],
      "linear",
    );

    expect(path).toBe("M0,1L10,2M30,4L40,5");
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it("should round annular sector corners without changing the requested winding", () => {
    const rounded = arcPath({
      cx: 50,
      cy: 50,
      innerRadius: 20,
      outerRadius: 40,
      startAngle: 0,
      endAngle: -Math.PI / 2,
      cornerRadius: 6,
    });
    const sharp = arcPath({
      cx: 50,
      cy: 50,
      innerRadius: 20,
      outerRadius: 40,
      startAngle: 0,
      endAngle: -Math.PI / 2,
      cornerRadius: 0,
    });

    expect(rounded).toContain("Q");
    expect(rounded).toContain(" 0 0 ");
    expect(rounded).not.toContain("NaN");
    expect(rounded).not.toBe(sharp);
    expect(sharp).not.toContain("Q");
  });

  it("should clamp oversized corners given a narrow pie sector", () => {
    const path = arcPath({
      cx: 0,
      cy: 0,
      innerRadius: 0,
      outerRadius: 20,
      startAngle: 0,
      endAngle: 0.04,
      cornerRadius: 100,
    });

    expect(path).toContain("Q");
    expect(path).not.toContain("NaN");
    expect(path.endsWith("Z")).toBe(true);
  });
});
