# Askr Charts Overview

`@askrjs/charts` provides chart-facing presentation primitives for Askr apps.

Current package layers:

- Default chart tokens and CSS entrypoints under `src/charts/default/`
- CSS-first chart components and shell primitives under `src/components/`
- Shared normalization utilities under `src/core/`
- A generator template under `templates/chart/`

The package is intentionally presentation-first. Runtime chart adapters can layer on
top of these primitives without coupling the package to one chart engine.

Current visual chart set includes bar charts, donut charts, flame graphs,
heatmaps, progress meters, sparklines, stacked bar charts, and timelines.

Animations stay CSS-first and decorative. Chart components emit animation data
attributes and CSS variables during SSR so charts remain correct without
hydration, and `prefers-reduced-motion: reduce` disables motion by default.

