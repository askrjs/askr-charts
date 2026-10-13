# Changelog

## Unreleased

## 0.5.0 - 2026-10-12

### Breaking changes

- Reduce the root type surface from 100 names to 69 by retiring 31 low-level channel/field, descriptor, and shared primitive-prop types. Keep all 19 runtime functions and all three export keys. Use concrete mark/helper/factory contracts as described in the [complete migration guide](./docs/migration-0.5.0.md) and [API decision matrix](./docs/0.5.0-public-api.md).

### Tests

- Qualify same-instance native PNG encoding across committed data/size changes and root cleanup, comparing all decoded pixels with captured references.
- Qualify true zero-size layout transitions, finite fallback exports, latest-row recovery, and exact restored dimensions across Chromium, Firefox, and WebKit. No runtime defect was found by these probes.
- Compile every retained name and direct absence assertions for all 31 retired types against the packed package with actual TypeScript 6 and 7, and verify all runtime names, styles, and private subpath rejection.

### Development dependencies

- Refresh compatible locked development tooling without changing manifest ranges: vite-plus 0.3.3 brings oxfmt 0.68.0 and tinypool 2.1.2; source-map-js resolves to 1.2.2. This removes the confirmed tinypool and source-map-js advisories without changing runtime dependencies.

### Fixes

- Install the exact Core release peer in the packed consumer smoke through ordinary npm resolution and verify its physical installation.
- Resolve benchmark reporter types through the installed Vite+ package.

### Compatibility

- Require `@askrjs/askr` 0.5.x and use the matching Core, UI, and Vite development candidates. Upgrade first-party packages together.
