import { describe, test } from "vite-plus/test";
import { compilePlotScene } from "../../src/compiler";
import {
  compileLineScene,
  mixedDescriptors,
  sourceRows10k,
  sourceRows100k,
} from "../_shared/fixtures";
import { consume } from "../_shared/sink";

const largeOptions = { time: 0, iterations: 3, warmupTime: 0, warmupIterations: 1 };
const regularOptions = { time: 500, iterations: 10, warmupTime: 100, warmupIterations: 3 };

describe("tier2 immutable scene compiler", () => {
  test("compile a 100k line scene (250ms first compile budget)", async ({ bench }) => {
    await bench("compile a 100k line scene (250ms first compile budget)", () => {
      consume(compileLineScene(sourceRows100k));
    }).run(largeOptions);
  });

  test("compile a 100k line scene into a warm x viewport", async ({ bench }) => {
    await bench("compile a 100k line scene into a warm x viewport", () => {
      consume(compileLineScene(sourceRows100k, { x: [90_000, 100_000] }));
    }).run(largeOptions);
  });

  test("compile a 10k mixed bar, line, and point scene", async ({ bench }) => {
    await bench("compile a 10k mixed bar, line, and point scene", () => {
      consume(
        compilePlotScene({
          rows: sourceRows10k,
          rowKey: "id",
          label: "Mixed operations plot",
          descriptors: mixedDescriptors,
          width: 800,
          height: 400,
          pixelRatio: 1,
        }),
      );
    }).run(regularOptions);
  });
});
