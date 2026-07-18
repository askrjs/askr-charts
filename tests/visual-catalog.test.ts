import { describe, expect, it } from "vite-plus/test";
import {
  visualCatalog,
  visualPrimitiveCoverage,
  visualRecipeCoverage,
  visualScaleCoverage,
} from "../examples/catalog";

describe("visual catalog coverage", () => {
  it("should render every public primitive scale and documented recipe given package acceptance coverage", () => {
    const primitives = new Set(visualCatalog.flatMap((entry) => entry.primitives));
    const scales = new Set(visualCatalog.flatMap((entry) => entry.scales));
    const recipes = new Set(visualCatalog.flatMap((entry) => entry.recipes));

    expect([...primitives].sort()).toEqual([...visualPrimitiveCoverage].sort());
    expect([...scales].sort()).toEqual([...visualScaleCoverage].sort());
    expect([...recipes].sort()).toEqual([...visualRecipeCoverage].sort());
    expect(new Set(visualCatalog.map((entry) => entry.id)).size).toBe(visualCatalog.length);
  });
});
