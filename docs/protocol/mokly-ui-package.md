# Shared UI Package

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

This continues the [embeddable viewer contract](./mokly-viewer.md).

## Package And Components

`@mokly/ui` is an MIT, ESM npm package under `packages/ui`, with React and
React DOM `>=19.0.0` as its only peers. It holds every element and every style
rule of the Browse shell: the components, the theme, the reset class, the
shell layout, the rules of the embedded root, and the highlight mask. Each
component is reachable by its own subpath, such as
`@mokly/ui/appearance-selector`, and the package has no root entry.

A package component takes props and callbacks only. It reads no store, no
context, no catalogue read model type, no network, and no history. It renders
the `<iframe>` element of a preview, but it never reads the frame's document.

The highlight mask is the dimmed layer with outlined cutouts that marks
component instances over a preview. The shell draws it with a package
component, from the boxes that the [frame adapter](./mokly-frame-adapter.md)
returns, over same-origin and cross-origin frames alike. No adapter and no
script in a preview draws a mask.

## Package Boundary

`@mokly/viewer` depends on the exact released version of `@mokly/ui`. The
viewer reaches the package through its exported subpaths only. The package
never imports the viewer, the CLI, or consumer code. Decision: a separate
package, not a directory in the viewer with an import lint, because only a
package boundary stops a relative import of the viewer internals at the
resolver, and one implementation then serves the product and its
[design mockups](./mokly-design-components.md).

Every element that the viewer shows comes from a package component. The viewer
reads the shell state, the catalogue data, and the frames, and it passes them
to the package components as props and callbacks. Decision: every element, not
only the components that read no store, so that one implementation of each
view serves the product and its design mockups.

## Stylesheets

`@mokly/ui/styles.css` is the package's only stylesheet subpath. It holds
every style rule of the shell: the theme, the reset class, the component
rules, the shell layout, and the rules of the embedded root. Decision: one
stylesheet subpath, not one per component, because a component stylesheet
omits the rules of package components it renders. No consumer imports a
component stylesheet subpath.

The viewer bundles the package CSS into its own `shell.css` and `styles.css`,
so these stay the only stylesheets that a delivery or a host loads. The
[theming rules](./mokly-viewer.md#theming-and-ownership) of the viewer contract
give the cascade precedence of the package CSS. The shell font file and its
`@font-face` rule stay with the viewer, because the viewer delivers the font.
The theme names the font family with system fallbacks.

## Theme And Host Pages

The theme declares the tokens and the Light and Dark
[palette](./mokly-viewer-appearance.md#palette-and-ownership) on the viewer
root class and on the document class of the standalone stub. No package rule
declares them through a `:root`, `html`, or `body` selector. Each package
component puts the reset class on its own elements that need a reset. A reset
rule never overrides a component rule.

No package rule matches an element of a host page outside a viewer root, and
no package rule matches host slot content. The rules that style the page
around the standalone shell select the stub's document class. A host page that
imports the package stylesheet therefore keeps its own page styles, and the
embedded stylesheet needs no `@scope` rule. Decision: tokens on the root class
and a reset class on each component's own elements, as Radix Themes does, not
page rules or bare element rules under the root class. A page rule styles the
page of every host that imports it, and a bare element rule under the root
class reaches host slot content.

A page that renders package components without the viewer puts them inside an
element with the viewer root class, or declares the theme's tokens itself.
