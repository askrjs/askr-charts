import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const askrRoot = resolve(repositoryRoot, "node_modules/@askrjs/askr");
const typescriptCli = resolve(repositoryRoot, "node_modules/typescript/bin/tsc");
const temporaryRoot = mkdtempSync(join(tmpdir(), "askr-charts-installed-"));

function run(executable, arguments_, cwd) {
  return execFileSync(executable, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

try {
  const packDirectory = join(temporaryRoot, "pack");
  const consumerDirectory = join(temporaryRoot, "consumer");
  mkdirSync(packDirectory);
  mkdirSync(consumerDirectory);

  const packResult = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", packDirectory],
      repositoryRoot,
    ),
  );
  assert.equal(packResult.length, 1, "npm pack should produce exactly one tarball");
  const tarball = join(packDirectory, packResult[0].filename);

  writeFileSync(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: { "@askrjs/charts": `file:${tarball}` },
      },
      null,
      2,
    )}\n`,
  );

  // The tarball has no runtime dependencies. Ignore automatic peer installation so this smoke
  // stays offline, then provide the versioned peer installed by this package's clean lockfile.
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-audit",
      "--no-fund",
      "--legacy-peer-deps",
    ],
    consumerDirectory,
  );
  const askrScope = join(consumerDirectory, "node_modules/@askrjs");
  mkdirSync(askrScope, { recursive: true });
  symlinkSync(askrRoot, join(askrScope, "askr"), "dir");

  writeFileSync(
    join(consumerDirectory, "runtime-smoke.mjs"),
    `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { appendPlotRows, constant, createPlot } from "@askrjs/charts";

const Plot = createPlot();
assert.equal(Object.isFrozen(Plot), true);
assert.deepEqual(Object.keys(Plot), [
  "Root", "Scale", "Axis", "Grid", "Bar", "Line", "Area", "Point", "Arc",
  "Cell", "Rect", "Rule", "Text", "Legend", "Tooltip", "Crosshair", "Zoom", "Brush",
]);

const original = Object.freeze([{ id: "a", value: 1 }]);
const appended = appendPlotRows(original, { id: "b", value: 2 });
assert.equal(original.length, 1);
assert.equal(appended.length, 2);
assert.equal(Object.isFrozen(appended), true);
assert.equal(constant("#2563eb").kind, "constant");

const require = createRequire(import.meta.url);
const stylesPath = require.resolve("@askrjs/charts/styles");
const styles = readFileSync(stylesPath, "utf8");
assert.match(styles, /--ak-chart-background:/);
assert.match(styles, /\\.ak-plot-root/);
`,
  );
  run(process.execPath, ["runtime-smoke.mjs"], consumerDirectory);

  writeFileSync(
    join(consumerDirectory, "type-smoke.tsx"),
    `import { constant, createPlot, movingAverage, type PlotApi } from "@askrjs/charts";

interface Row {
  id: string;
  timestamp: Date;
  latency: number;
  outcome: "ok" | "error";
}

const Plot = createPlot<Row>();
const rows = [] as readonly Row[];
const apiRef = { current: null as PlotApi<Row> | null };

const plot = (
  <Plot.Root data={rows} rowKey="id" label="Installed declaration smoke" apiRef={apiRef}>
    <Plot.Line
      x="timestamp"
      y={movingAverage("latency", { window: 3 })}
      stroke={constant("#2563eb")}
    />
    <Plot.Point x={(row) => row.timestamp} y={(row) => row.latency} fill="outcome" />
  </Plot.Root>
);

void plot;
`,
  );
  writeFileSync(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          jsxImportSource: "@askrjs/askr",
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ["type-smoke.tsx"],
      },
      null,
      2,
    )}\n`,
  );
  run(process.execPath, [typescriptCli, "-p", "tsconfig.json", "--pretty", "false"], consumerDirectory);

  const packedManifest = packResult[0];
  assert.equal(packedManifest.version, "0.1.0");
  assert.match(packedManifest.filename, /askrjs-charts-0\.1\.0\.tgz$/);
  assert.equal(packedManifest.size > 0, true);
  assert.equal(packedManifest.unpackedSize > 0, true);
  console.log(`installed tarball smoke passed: ${packedManifest.filename}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
