# @mokly/ui

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

`@mokly/ui` holds every element and every stylesheet of the Mokly Browse
shell: its components, its theme, and its layout. `@mokly/viewer` composes
them into the shell that Serve, the static build, and React hosts render, and
the design mockup catalogue under `examples/basic` renders the same
components. Depend on this package only when you render one of its components
yourself; a host that embeds a catalogue uses `@mokly/viewer`, which depends
on this package at the exact shared version.

## Responsibilities

- Every element of the shell: the markup, the styles, and the local
  interaction of each component, with props in and callbacks out. The viewer
  renders no element of its own.
- Every style rule of the shell: the theme, the reset class, one CSS file
  beside each component, the shell layout, and the rules of the embedded root.
  Every rule stays outside every cascade layer, and `styles.css` holds them
  all.
- The highlight mask that marks component instances over a preview, drawn from
  the boxes that the viewer's frame adapters return.
- Nothing else. A component reads no store, no context, no catalogue read
  model type, no network, and no history. It renders the `<iframe>` element of
  a preview but never reads the frame's document. React and React DOM are the
  only peers.

## What This Package Does

Each component is a subpath export, such as `@mokly/ui/appearance-selector`,
and `@mokly/ui/styles.css` is the only stylesheet subpath. The package has no
root entry.
`styles.css` holds the rules of every component; a component's own stylesheet
leaves out the components it renders, such as the change mark of the
appearance selector. The viewer bundles `styles.css` into its own `shell.css`
and `styles.css`, so a delivery or a host loads one stylesheet as before. A
shell container that needs the store stays in `@mokly/viewer` and renders
package components.

The theme declares the shell's tokens, such as `--chrome-surface`, and the
Light and Dark palette on the viewer root class and on the standalone stub's
document class, never through a `:root`, `html`, or `body` selector. Each
component puts the reset class on its own elements that need a reset. No rule
reaches the host page or host slot content. A host that renders a component
outside a viewer root puts it inside an element with the viewer root class, or
declares the tokens itself, as the design catalogue's
`examples/basic/design.css` does.

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

`ComparisonToolbar` renders its modes as toggle buttons that report through
`onMode`. A host that runs no script, such as a static mockup, passes
`modeHref` to draw each mode that has an address as a link, and
`interactive={false}` to draw the other modes as inert text and Refresh as a
picture of itself. The link or the text of the shown mode is marked as the
current page. Scroll together stays a native switch in every band. The mode
group renders the package's segmented control, and the package stylesheet
gives a link and inert text the line box and centring of a button.

## Development

From the repository root, `npm run build` builds this package before the
viewer. `npm run typecheck` includes it. Tests live under `tests/` and run with
`npm test -- packages/ui/tests/<file>`. A test that mounts a component imports
`tests/dom.ts` first, which registers a happy-dom window for Testing Library.
File names are kebab-case, such as `top-bar.tsx` exporting `TopBar`. A lint
checks the rule only for the JavaScript and TypeScript files under `src/` and
`tests/` and for the directories that hold them. A component imports only
`react`, `react-dom`, and the other components of this package by relative path;
a lint holds that rule too.

The design library and the design artboards under `examples/basic/specs/design`
import each package component that they show, with its stylesheets, from
`src/` by repository path, not from `dist`: the base side of a Changes
comparison renders from Git, which holds no build output. A change here
therefore also changes their design mockups, so run the mockup check of
[`AGENTS.md`](../../AGENTS.md) after it.

A component lives in `src/<name>/`: `<name>.tsx`, and `<name>.css` when it has
styles. Its subpath in the `exports` map is `./<name>`, with `types` and
`import` targets in `dist/<name>/`. The build copies
`<name>.css` beside the JavaScript. Each stylesheet keeps its rules outside
every cascade layer, so neither an element reset nor a host layer overrides a
component rule, and a host rule competes with them by specificity and order; a
test holds the rule.

`src/styles.css` sets the order of `styles.css`. It lists the component
stylesheets with one `@import` each, in cascade order: the theme, the shared
controls, the components, then the layout and its responsive rules. The build
concatenates the stylesheets in that order. A component stylesheet that the
list omits joins the end in name order, with a build warning. Add each new
stylesheet to the list at its place in the cascade. A later rule of equal
specificity overrides an earlier one, as the narrow-width layout rules
override the desktop layout rules.

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
  together switch, and Refresh, as buttons or as the links and inert text of
  a static band
- [`scripts/build.mjs`](./scripts/build.mjs) — compiles the package, copies
  each CSS file beside its JavaScript, and writes `styles.css`
- [`scripts/styles.mjs`](./scripts/styles.mjs) — finds the component
  stylesheets and orders `styles.css`
- [`tests/dom.ts`](./tests/dom.ts) — the happy-dom window, the act
  environment, and the cleanup of each DOM test
- [`tests`](./tests) — Testing Library tests on happy-dom

### Related Docs

- [Shared UI package contract](../../docs/protocol/mokly-ui-package.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Design components](../../docs/protocol/mokly-design-components.md)
- [Viewer appearance](../../docs/protocol/mokly-viewer-appearance.md)
