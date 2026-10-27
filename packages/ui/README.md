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
`styles.css` holds the rules of every component; a component's own stylesheet
leaves out the components it renders, such as the change mark of the
appearance selector. The rules read the shell's colour tokens, such as
`--chrome-surface`, which the `@mokly/viewer` stylesheet declares. The viewer
bundles `styles.css` into its own `shell.css` and `styles.css`, so a delivery
or a host loads one stylesheet as before. A shell container that needs the
store stays in `@mokly/viewer` and composes a package component.

## Quick Start

```tsx
import { AppearanceSelector } from "@mokly/ui/appearance-selector";
import "@mokly/ui/styles.css";

export function Toolbar() {
  return (
    <AppearanceSelector
      value="auto"
      changed={false}
      changedId="toolbar-appearance-changed"
      changedText="Other theme changed"
      onChange={(theme) => console.log(theme)}
    />
  );
}
```

`changed` shows the change mark, and `changedId` names its wording, which the
select's `aria-describedby` points at while the control is marked.

## Development

From the repository root, `npm run build` builds this package before the
viewer. `npm run typecheck` includes it. Tests live under `tests/` and run with
`npm test -- packages/ui/tests/<file>`. A test that mounts a component imports
`tests/dom.ts` first, which registers a happy-dom window for Testing Library.
File names are kebab-case, such as `top-bar.tsx` exporting `TopBar`; a lint
holds the rule. A component imports only `react`, `react-dom`, and the other
components of this package by relative path; a lint holds that rule too.

A component lives in `src/<name>/`: `<name>.tsx`, and `<name>.css` when it has
styles. Its subpaths in the `exports` map are `./<name>`, with `types` and
`import` targets in `dist/<name>/`, and `./<name>.css`. The build copies
`<name>.css` beside the JavaScript and adds it to `styles.css` in component
name order. Each stylesheet wraps its rules in `@layer mokly.components`, so
an unlayered shell or host rule wins over them; a test holds the rule.

### Key Code

- [`src/icons/icons.tsx`](./src/icons/icons.tsx) — the shell glyphs and the
  workspace control icons, with `IconSvg` as their frame
- [`src/change-mark/change-mark.tsx`](./src/change-mark/change-mark.tsx) —
  `ChangeMark`, the dot and the screen reader wording that mark a view control
  whose other view changed
- [`src/appearance-selector/appearance-selector.tsx`](./src/appearance-selector/appearance-selector.tsx)
  — `AppearanceSelector`, the Auto, Light, and Dark control of the standalone
  shell
- [`src/comparison-toolbar/comparison-toolbar.tsx`](./src/comparison-toolbar/comparison-toolbar.tsx)
  — `ComparisonToolbar` and its `ComparisonMode`: the mode group, the Scroll
  together switch, and Refresh
- [`scripts/build.mjs`](./scripts/build.mjs) — compiles the package, copies
  each CSS file beside its JavaScript, and writes `styles.css`
- [`scripts/styles.mjs`](./scripts/styles.mjs) — finds the component
  stylesheets and orders `styles.css`
- [`tests/dom.ts`](./tests/dom.ts) — the happy-dom window, the act
  environment, and the cleanup of each DOM test
- [`tests`](./tests) — Testing Library tests on happy-dom

### Related Docs

- [Embeddable viewer contract](../../docs/protocol/mokly-viewer.md#shared-ui-package)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Design components](../../docs/protocol/mokly-design-components.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md)
