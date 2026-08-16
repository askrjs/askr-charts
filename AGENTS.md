# AGENTS.md

Operational guide for `@askrjs/charts`, which owns typed plot declarations,
immutable scenes, Canvas rendering, interaction, and export.

## Askr North Star

Keep the path from declared data and marks to compiled scene and painted output
narratable. Enforce invalid rows, scales, descriptors, and interaction state at
the owning boundary with actionable errors. Test every new primitive's failure
modes as well as its rendered result. Keep compilation, rendering, interaction,
and export as visible seams. Prefer explicit plot declarations over inferred
chart conventions, and avoid new options without a demonstrated chart need.
Performance work must preserve this causal model.

Run `npm run check` before declaring a change ready. Run the affected benchmark
tier for compiler, renderer, interaction, or hot-path changes.

## Optimization Gate

A benchmark number is only half of an optimization's success criterion. The
change must also preserve a causal path that a human or agent can narrate in one
sentence.

Every benchmark-driven change must include:

1. the one-sentence causal description of the optimized path;
2. the exact fallback trigger and proof that optimized and fallback paths have
   identical observable behavior and error surfaces;
3. an explicit legibility-cost statement, including `none` when no new path or
   concept is introduced; and
4. evidence that a measured bottleneck in a real application justifies the
   optimization now.

Prefer making the existing single path faster. New caches, inference,
memoization, shortcuts, fast paths, or scheduler states require an explicit
legibility decision; a speedup alone does not justify them.
