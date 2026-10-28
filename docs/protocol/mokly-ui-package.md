# Shared UI Package

This continues the [embeddable viewer contract](./mokly-viewer.md).

## Package And Components

`@mokly/ui` is an MIT, ESM npm package under `packages/ui`, with React and
React DOM `>=19.0.0` as its only peers. It holds presentational components of
the Browse shell and their stylesheets as CSS files. Each component is
reachable by its own subpath, such as `@mokly/ui/appearance-selector`, and the
package has no root entry.

A package component takes props and callbacks only. It reads no store, no
context, no catalogue read model type, no network, no history, and no frame.

## Package Boundary

`@mokly/viewer` depends on the exact released version of `@mokly/ui`. The
viewer reaches the package through its exported subpaths only. The package
never imports the viewer, the CLI, or consumer code. Decision: a separate
package, not a directory in the viewer with an import lint, because only a
package boundary stops a relative import of the viewer internals at the
resolver, and one implementation then serves the product and its
[design mockups](./mokly-design-components.md).

## Stylesheets

The viewer bundles the package CSS into its own `shell.css` and `styles.css`,
so these stay the only stylesheets that a delivery or a host loads. The
[theming rules](./mokly-viewer.md#theming-and-ownership) of the viewer contract
give the cascade precedence of the package CSS.
