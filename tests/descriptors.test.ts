import { Fragment, jsx, jsxs } from "@askrjs/askr/jsx-runtime";
import { describe, expect, it } from "vite-plus/test";

import {
  collectPlotDescriptors,
  createDescriptorComponent,
  getPrimitiveBrand,
} from "../src/descriptors";
import { createPlot } from "../src/factory";

describe("plot descriptor collection", () => {
  it("should flatten arrays fragments getters and conditionals given factory primitives when collecting", () => {
    const factory = Object.freeze({});
    const Scale = createDescriptorComponent<{ name: string }>(factory, "Scale");
    const Bar = createDescriptorComponent<{ x: string; y: string }>(factory, "Bar");
    const Point = createDescriptorComponent<{ x: string; y: string }>(factory, "Point");
    const children = [
      jsx(Scale, { name: "x" }),
      null,
      false,
      jsxs(Fragment, {
        children: [
          jsx(Bar, { x: "category", y: "value" }),
          () => jsx(Point, { x: "category", y: "value" }),
          true,
        ],
      }),
    ];

    const descriptors = collectPlotDescriptors(factory, children);

    expect(descriptors.map(({ kind }) => kind)).toEqual(["Scale", "Bar", "Point"]);
    expect(descriptors[0]?.props).toEqual({ name: "x" });
    expect(descriptors[1]?.props).toEqual({ x: "category", y: "value" });
    expect(Object.isFrozen(descriptors)).toBe(true);
    expect(descriptors.every(Object.isFrozen)).toBe(true);
    expect(descriptors.every(({ props }) => Object.isFrozen(props))).toBe(true);
  });

  it("should reject mixed factories given branded primitives when collecting children", () => {
    const firstFactory = Object.freeze({});
    const secondFactory = Object.freeze({});
    const FirstBar = createDescriptorComponent(firstFactory, "Bar");
    const SecondLine = createDescriptorComponent(secondFactory, "Line");

    expect(() =>
      collectPlotDescriptors(firstFactory, [jsx(FirstBar, {}), jsx(SecondLine, {})]),
    ).toThrow(/different createPlot\(\) factory/);
  });

  it("should reject unrelated elements and primitive text given foreign children when collecting", () => {
    const factory = Object.freeze({});
    const Unrelated = () => null;

    expect(() => collectPlotDescriptors(factory, jsx("div", { children: "not a plot" }))).toThrow(
      /non-plot JSX child/,
    );
    expect(() => collectPlotDescriptors(factory, jsx(Unrelated, {}))).toThrow(
      /not a plot primitive/,
    );
    expect(() => collectPlotDescriptors(factory, "not a plot")).toThrow(/must be plot primitives/);
  });

  it("should reject argument-taking getters and circular fragments given invalid child structures when collecting", () => {
    const factory = Object.freeze({});
    const circular: { type: symbol; props: { children?: unknown } } = {
      type: Fragment,
      props: {},
    };
    circular.props.children = circular;

    expect(() => collectPlotDescriptors(factory, (_row: unknown) => null)).toThrow(
      /must not require arguments/,
    );
    expect(() => collectPlotDescriptors(factory, circular)).toThrow(
      /Circular plot child structure/,
    );
  });
});

describe("plot factory descriptors", () => {
  it("should expose one frozen stable namespace given a row factory when creating primitives", () => {
    const Plot = createPlot<{ id: string; value: number }>();

    expect(Object.keys(Plot)).toEqual([
      "Root",
      "Scale",
      "Axis",
      "Grid",
      "Bar",
      "Line",
      "Area",
      "Point",
      "Arc",
      "Cell",
      "Rect",
      "Rule",
      "Text",
      "Legend",
      "Tooltip",
      "Crosshair",
      "Select",
      "Zoom",
      "Brush",
    ]);
    expect(Object.isFrozen(Plot)).toBe(true);
    expect(Plot.Bar).toBe(Plot.Bar);
    expect(getPrimitiveBrand(Plot.Bar)?.kind).toBe("Bar");
    expect(getPrimitiveBrand(Plot.Root)).toBeUndefined();
  });
});
