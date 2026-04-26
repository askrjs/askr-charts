# Askr Charts Overview

`@askrjs/askr-charts` provides chart-facing presentation primitives for Askr apps.

Current package layers:

- Default chart tokens and CSS entrypoints under `src/charts/default/`
- CSS-first chart components and shell primitives under `src/components/`
- Shared normalization utilities under `src/core/`
- A generator template under `templates/chart/`

The package is intentionally presentation-first. Runtime chart adapters can layer on
top of these primitives without coupling the package to one chart engine.
