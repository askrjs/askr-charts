import { bench, describe } from "vite-plus/test";
import { compilePlotScene } from "../../src/compiler";
import { resolvePlotViewTransform } from "../../src/controller";
import { createHitIndex } from "../../src/hit-index";
import { renderPlotScene, defaultPlotTheme } from "../../src/render";
import { appendPlotRows, trimPlotRows } from "../../src/rows";
import { createNoopCanvasContext, installPath2DStub } from "../_shared/canvas";
import {
  compileLineScene,
  lineDescriptors,
  liveBatchRows,
  liveWindowRows,
  sourceRows100k,
} from "../_shared/fixtures";
import { consume } from "../_shared/sink";

installPath2DStub();

const lineScene = compileLineScene(sourceRows100k);
const context = createNoopCanvasContext();
const transientCanvas = document.createElement("canvas");
const hitIndex = createHitIndex(lineScene.hits, {
  width: lineScene.width,
  height: lineScene.height,
  cellSize: 16,
});
let queryOffset = 0;
let viewOffset = 0;

const sampledOptions = { time: 750, iterations: 50, warmupTime: 150, warmupIterations: 10 };
const liveOptions = { time: 750, iterations: 10, warmupTime: 150, warmupIterations: 3 };

describe("tier3 runtime acceptance hot paths", () => {
  bench(
    "warm 100k scene repaint diagnostic",
    () => {
      renderPlotScene(context, lineScene, defaultPlotTheme);
    },
    sampledOptions,
  );

  bench(
    "warm pan/zoom transient frame (p99 proxy <=16.7ms)",
    () => {
      viewOffset = (viewOffset + 250) % 5_000;
      const transform = resolvePlotViewTransform(
        lineScene,
        { x: [85_000 + viewOffset, 95_000 + viewOffset] },
        "x",
      );
      transientCanvas.style.transform = transform;
      consume(transform);
    },
    sampledOptions,
  );

  bench(
    "settled pan/zoom view compile and repaint diagnostic",
    () => {
      viewOffset = (viewOffset + 250) % 5_000;
      const scene = compileLineScene(sourceRows100k, {
        x: [85_000 + viewOffset, 95_000 + viewOffset],
      });
      renderPlotScene(context, scene, defaultPlotTheme);
      consume(scene);
    },
    liveOptions,
  );

  bench(
    "100k-source spatial hit query (p99 proxy <=2ms)",
    () => {
      queryOffset = (queryOffset + 37) % lineScene.hits.length;
      const shape = lineScene.hits[queryOffset]!.shape;
      if (shape.kind !== "circle")
        throw new Error("The line scene produced a non-point hit shape.");
      consume(hitIndex.query(shape.x, shape.y));
    },
    sampledOptions,
  );

  bench(
    "append and repaint a 1k followed batch (p99 proxy <=50ms)",
    () => {
      const rows = trimPlotRows(appendPlotRows(liveWindowRows, liveBatchRows), { rows: 5_000 });
      const scene = compilePlotScene({
        rows,
        rowKey: "id",
        label: "Follow-latest latency",
        descriptors: lineDescriptors,
        width: 800,
        height: 400,
        pixelRatio: 1,
      });
      renderPlotScene(context, scene, defaultPlotTheme);
      consume(scene);
    },
    liveOptions,
  );
});
