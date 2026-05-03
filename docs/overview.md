# Askr Charts Overview

`@askrjs/charts` provides chart-facing presentation primitives for Askr apps.
It is a sibling package to `@askrjs/themes`, not a replacement for the app
shell theme system or a full charting engine.

Current package layers:

- Default chart tokens and CSS entrypoints under `src/charts/default/`
- CSS-first chart components and shell primitives under `src/components/`
- Shared normalization utilities under `src/core/`
- A generator template under `templates/chart/`

The package is intentionally presentation-first. Runtime chart adapters can layer on
top of these primitives without coupling the package to one chart engine.

Current visual chart set includes area charts, bar charts, donut charts, flame
graphs, heatmaps, line charts, progress meters, radial gauges, sparklines,
stacked bar charts, and timelines.

The line and area forms are intentionally discrete CSS approximations for
simple trend snapshots, and the radial gauge is a compact single-value dial.
That keeps the package lightweight while still covering the visuals CSS can do
well.

Animations stay CSS-first and decorative. Chart components emit animation data
attributes and CSS variables during SSR so charts remain correct without
hydration, and `prefers-reduced-motion: reduce` disables motion by default.
