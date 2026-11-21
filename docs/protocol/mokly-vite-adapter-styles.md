# Vite Adapter Stylesheets

Status: The Vite stylesheet transform is not available yet. The [stylesheet milestone](../../plans/storybook-support.md#milestone-16-stylesheets-through-vite) adds it.

This page continues the [Vite adapter contract](./mokly-vite-adapter.md). It
defines how the setup of the adapter transforms stylesheets.

## Stylesheet Transforms

Under the adapter, the setup transforms each local stylesheet in place of the
configured `postcss` module. The transform applies the preprocessor of the
stylesheet's language and the PostCSS config that Vite loads. It also applies
the `css` options of the setup and the stylesheet transforms of its plugins,
such as Tailwind's Vite plugin. Mokly requests each stylesheet through the
setup as an inline module.

Under the adapter, Vite's stylesheet languages are stylesheets: `.css`,
`.scss`, `.sass`, `.less`, `.styl`, `.stylus`, `.pcss`, `.postcss`, and
`.sss`. Mokly's handling of `.css` and `.module.css` imports covers each of
these languages. A `.module.` stylesheet in one of these languages is a CSS
Module. Mokly scopes it after the transform with the
[names](./mokly-imported-styles-modules.md#names) of the CSS Modules contract.
The CSS Modules settings of the setup do not apply: `css.modules`, or
`css.lightningcss.cssModules` with the lightningcss transformer.

Decision: Mokly owns CSS Modules, so both sides and both compile paths give
equal names. Vite's own CSS Modules were rejected.

Mokly orders, bundles, delivers, and attributes the result under the
[imported stylesheet contract](./mokly-imported-styles.md), as on the esbuild
path. The files that the transform reports as dependencies are watched inputs.

## Catalogues Without JavaScript

Under the adapter, every local stylesheet goes through the setup, also in a
catalogue without JavaScript. A sidecar then starts, and the base side
extracts its sources and selects an installation, as for the `postcss`
module.

Decision: the setup takes the place of the `postcss` module, so the CSS does
not change when the catalogue gets its first JavaScript file. Mokly's own
stylesheet pipeline for a catalogue without JavaScript was rejected.

## Related Docs

- [Vite adapter](./mokly-vite-adapter.md)
- [Imported CSS configuration](./mokly-configuration-imported-styles.md)
- [Imported stylesheet delivery](./mokly-imported-styles.md) and
  [diagnostics](./mokly-imported-styles-errors.md)
- [Base source and dependency preparation](./mokly-base-preparation.md)
