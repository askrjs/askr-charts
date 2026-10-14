# Charts 0.5.0 hardening evidence

Scope: issues #62 and #63, accepted baseline `e7f428db5b8b4774e2e507e3040ccd391af16bc1`. The API change narrows the root type barrel; runtime implementations and the underlying model definitions remain intact. The boundary probes below passed the unchanged runtime in Chromium, Firefox, and WebKit. No runtime defect was confirmed and no product fix was necessary.

## New executed probes

`tests/browser/canvas-rendering.spec.ts` adds two same-instance scenarios, six passing browser cases before the type barrel changed:

| Scenario                                                       | Observable contract and outcome                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native PNG encoding pending during data replacement and resize | The real encoder's callback is held after encoding, then released after new rows and dimensions commit. All decoded RGBA pixels and original dimensions equal the initial reference. Live API/data export exposes the replacement rows; new SVG geometry and backing canvases have exact new dimensions.                  |
| Native PNG encoding pending across root cleanup                | A second captured PNG finishes after cleanup and equals the pre-cleanup reference pixel for pixel. `onApiChange` receives null, the frame disconnects, mounted canvases remain zeroed after resize/frame delivery, and animation does not resume. The encoder hook is always restored and every decoded bitmap is closed. |
| Positive layout to actual zero measurement to restored layout  | Hidden frame measurements are exactly zero. Hidden PNG/SVG retain finite positive fallback dimensions with valid geometry. Rows change while hidden; restoring a different width and height yields the latest rows and exact canvas/PNG/SVG dimensions. Cleanup releases the mounted canvases.                            |

The probes disable transitions using the supported motion token, so each raster represents one committed scene. They await native encoder completion and observable frame delivery; no arbitrary delay determines the captured-image assertions. SVG checks parse XML and inspect geometry attributes, avoiding user text when checking non-finite coordinates.

An additional focused hit-index test exercises a zero-radius point, a zero-length line at and just beyond its configured tolerance, a collapsed rectangular query, and an empty index. It keeps the geometric tolerance contract explicit without adding a minimum hit area.

```bash
vp env exec --node 24.21.0 npm exec -- playwright test tests/browser/canvas-rendering.spec.ts --grep 'preserve captured PNG|zero-size layout'
```

## Existing boundary assertions retained

The pass inspected the assertions below and retains them in the full validation suite. These are concrete tests, not claims inferred from their names.

| Invariant                                                          | Assertion owner                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty data does not erase invalid-reference errors                 | `tests/compiler.test.ts`: empty marks/legends and rejection of an explicitly unknown legend scale                                                                                                               |
| Missing/non-finite numeric inputs and extreme domains remain valid | `tests/compiler.test.ts`, `tests/scales.test.ts`: omissions/log rules, 100,000-value bounds, finite mapping/inversion/ticks over a domain wider than Number.MAX_VALUE, and tiny observations beside extremes    |
| Ordering, degenerate regression, and invalid transform rejection   | `tests/transforms.test.ts`: constant fit for duplicate x values, stable equal-key sort, retained row identity, frozen output, and rejection of foreign descriptors                                              |
| Immutable row operations retain exact boundary semantics           | `tests/rows.test.ts`: duplicate rejection, no-op identity, empty/count-zero cases, stable remove/upsert order, unordered timestamps, inclusive 8,000ms threshold at a 10,000ms clock, and invalid clocks/limits |
| Hit queries are ordered, finite, and bounded                       | `tests/hit-index.test.ts`: topmost point ordering, reversed rectangle bounds, non-finite coordinate rejection, invalid size rejection, and localized queries over 100,000 regions                               |
| Export protects serialization and instance isolation               | `tests/export.test.ts`, existing browser canvas suite: hostile SVG text/paint, forbidden XML characters, CSV formulas, JSON missing values/lineage, and independent concurrent resize/export                    |
| Animation, reduced motion, and nested teardown preserve ownership  | `tests/browser/transitions.spec.ts` and `dialog-teardown.spec.ts`: selected/exported data during animation, completion, reduced motion, root/portaled cleanup races, and canvas zeroing                         |

## Qualification boundaries

The installed artifact harness compiles the same retained-name, direct negative-name, and JSX consumer fixtures under the repository's actual TypeScript 6.0.3 and 7.0.2 binaries, with `skipLibCheck: false`. It also verifies all 19 runtime functions, stylesheet resolution, and private model/compiler/scene/descriptors subpath rejection. The immutable baseline gives exactly 31 unused absence directives under both compilers, while every retained-name positive control passes.

The installed harness resolves the exact Core release peer through ordinary npm installation and verifies a physical package directory, then exercises Charts runtime exports and declarations with TypeScript 6 and 7. Normal installation of the complete packed 0.5.0 graph, Examples/Website composition, and nested UI teardown against final Core/UI artifacts remain coordinated release gates. The user must review the final changes before publication.

Full repository validation uses `vp env exec --node 24.21.0 npm run check` and `vp env exec --node 24.21.0 npm run fmt -- --check`. A native Chromium V8 coverage replay of the exact two browser callbacks recorded six PNG captures, ten calls to each measurement function, three queued compile/paint executions, five scene installations, and two controller destructions. Source ranges confirm the hidden width/height fallback paths execute twice; the height default of 320 executes twice. The cleanup probe queues a resize immediately before destruction and verifies canvases remain zeroed after subsequent frame/resize delivery. No repository-wide coverage percentage is claimed: this repository has no configured coverage gate. Runtime code is unchanged, so no optimization or benchmark claim is made.

The complete local `check` passed: 180 unit tests, one repository check, 17 DOM tests, 66 browser/visual cases across three engines, and 18 additional visual cases, followed by source/installed typechecks, publint, and package artifact checks. Formatting and both full and production dependency audits passed with zero vulnerabilities. All 30 emitted JavaScript files are byte-identical to the accepted baseline, and all 75 retained definitions in the emitted model declaration file are unchanged; seven now-unreachable retired aliases are omitted by declaration generation.

Compatible development lock updates resolve vite-plus 0.3.3, oxfmt 0.68.0, tinypool 2.1.2, and source-map-js 1.2.2 to remove the confirmed locked-tooling advisories. Dependency ranges, runtime peer ranges, and package version remain unchanged; qualification uses a clean `npm ci` from that lockfile.
