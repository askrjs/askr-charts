import { describe, expect, it } from "vite-plus/test";

import { validateScaleArray } from "../src/compiler/scales";

describe("compiler/scales validateScaleArray", () => {
  it("should return undefined for an undefined value", () => {
    expect(validateScaleArray(undefined, "x", "domain")).toBeUndefined();
  });

  it("should return the array unchanged when given a valid array", () => {
    const domain = [0, 10];
    expect(validateScaleArray(domain, "x", "domain")).toBe(domain);
  });

  it("should throw a TypeError when given a non-array value", () => {
    expect(() => validateScaleArray("nope", "x", "range")).toThrow(
      /Scale x range must be an array/,
    );
  });
});
