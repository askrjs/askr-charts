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

`npm run test:browser` and `npm run test:visual` run Playwright against a Vite
harness (`vite.harness.config.ts`). Locally each run starts its own harness on a
free port, so runs in parallel worktrees stay isolated. `ASKR_TEST_PORT=<port>`
pins the port. To reuse a harness you already started from this checkout
(`npx vp dev --config vite.harness.config.ts`, port 4320), set
`PW_REUSE_SERVER=1`; the run fails fast if the server on that port serves a
different checkout. CI always starts a fresh harness on port 4320.

## Changelog

Any change to the `version` field in `package.json`, whether a release,
prerelease, or patch bump, must include a matching `## <version>` section in
`CHANGELOG.md` in the same commit or pull request. Date the section and list
breaking changes (with migration notes), deprecations, additions, and fixes.
Move entries from `Unreleased` into the new version section rather than leaving
them there. If the repository has no `CHANGELOG.md` yet, create one (Keep a
Changelog style) at the next version bump. Do not publish or tag a version whose
changelog section is missing.

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
