# Canvas engine benchmark acceptance

The benchmark tiers separate algorithm cost from browser integration so a regression identifies its owning layer.

| Tier | Runtime  | Owner                                                                                            |
| ---- | -------- | ------------------------------------------------------------------------------------------------ |
| 1    | Node     | Scales, transforms, paths, and immutable row helpers                                             |
| 2    | jsdom    | DOM-free scene compilation, including the 100,000-row line workload                              |
| 3    | jsdom    | Transient pan/zoom frames, settled scene compilation, spatial queries, and followed live batches |
| 4    | Chromium | Mounted first compile/paint and warm real Canvas 2D painting                                     |

Release-candidate evidence is three consecutive `npm run bench` executions on the same Chromium host. The scripts set `NODE_ENV=production` so development diagnostics are not charged to the shipped render path. The acceptance rows are:

- Tier 4 100,000-row line mount, compile, and paint: at most 250 ms.
- Tier 4 warm real-canvas 100,000-row scene repaint: p95 at most 16.7 ms.
- Tier 3 warm pan/zoom transient frame: p95 at most 16.7 ms.
- Tier 3 spatial hit query for the culled 100,000-source-row scene: p95 at most 2 ms.
- Tier 3 append, follow-window trim, compile, and repaint of 1,000 rows: p95 at most 50 ms.

The Vitest/Tinybench table exposes p99 rather than p95. Treat its p99 as the conservative acceptance proxy: passing p99 necessarily passes p95. The Tier 3 and Tier 4 configurations enforce the acceptance rows through a threshold reporter, so a breach or a missing/renamed acceptance row exits nonzero while retaining Vitest's default benchmark table. During a gesture the mounted controller applies a compositor transform and settles the compiled scene after input pauses, so the Tier 3 transient-frame row owns the frame budget while the settled compile row remains diagnostic. Tier 3's no-op context isolates compiler and scene-traversal cost; the separate Tier 4 repaint row is the authority for actual Canvas rasterization cost.

Benchmarks are performance evidence, not smoke tests. Functional correctness remains owned by `npm run check`.
