# @mokly/ui

Status: In progress under the [shared UI package plan](../../plans/ui-package.md).

`@mokly/ui` holds the presentational components of the Mokly Browse shell and
their stylesheets. `@mokly/viewer` composes them into the shell that Serve,
the static build, and React hosts render, and the design mockup catalogue
under `examples/basic` renders the same components. Depend on this package
only when you render one of its components yourself; a host that embeds a
catalogue uses `@mokly/viewer`, which depends on this package at the exact
shared version.

## Responsibilities

- The markup, the styles, and the local interaction of each component: props
  in, callbacks out.
- One CSS file beside each component, in the `mokly.components` cascade
  layer, and `styles.css` with every component's rules.
- Nothing else. A component reads no store, no context, no catalogue read
  model type, no network, no history, and no frame. React and React DOM are
  the only peers.

## What This Package Does

Each component is a subpath export, such as `@mokly/ui/appearance-selector`,
with its CSS at the matching `.css` subpath. The package has no root entry.
The viewer bundles `styles.css` into its own `shell.css` and `styles.css`, so
a delivery or a host loads one stylesheet as before. A shell container that
needs the store stays in `@mokly/viewer` and composes a package component.

## Quick Start

```tsx
import { AppearanceSelector } from "@mokly/ui/appearance-selector";
import "@mokly/ui/appearance-selector.css";

export function Toolbar() {
  return (
    <AppearanceSelector
      idPrefix="toolbar-"
      value="auto"
      changed={false}
      onChange={(theme) => console.log(theme)}
    />
  );
}
```

## Development

From the repository root, `npm run build` builds this package before the
viewer. `npm run typecheck` includes it. Tests live under `tests/` and run with
`npm test -- packages/ui/tests/<file>`. A test that mounts a component imports
`tests/dom.ts` first, which registers a happy-dom window for Testing Library.
File names are kebab-case, such as `top-bar.tsx` exporting `TopBar`; a lint
holds the rule. A component imports only `react`, `react-dom`, and this
package; a lint holds that rule too.

### Key Code

- `src/icons/icons.tsx` — the shell glyphs, with `IconSvg` as their frame
- `src/change-mark/change-mark.tsx` — the dot that marks a control whose
  other view changed
- `src/appearance-selector/appearance-selector.tsx` — the Auto, Light, and
  Dark control of the standalone shell
- `src/comparison-toolbar/comparison-toolbar.tsx` — the comparison mode
  group, the Scroll together switch, and Refresh
- `scripts/build.mjs` — compiles the package, copies each CSS file beside its
  JavaScript, and writes `styles.css`
- `tests` — Testing Library tests on happy-dom

### Related Docs

- [Embeddable viewer contract](../../docs/protocol/mokly-viewer.md#shared-ui-package)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Design components](../../docs/protocol/mokly-design-components.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md)
