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
Module.

Mokly orders, bundles, delivers, and attributes the result under the
[imported stylesheet contract](./mokly-imported-styles.md), as on the esbuild
path. The files that the transform reports as dependencies are watched inputs.

## Imports Inside Stylesheets

The setup resolves and inlines every import inside a stylesheet. The
renderer's stylesheets are the files of the renderer's closure. Under the
adapter, that closure holds the renderer's top-level stylesheets and each file
that their transform reports as a dependency. Mokly removes each renderer
stylesheet only from the stylesheets that JavaScript imports. A renderer
stylesheet that an entry stylesheet imports comes back after the renderer's
CSS, as in the project's own Vite build. The
[nested-import diagnostic](./mokly-imported-styles-postcss.md#transform) does
not apply under the adapter.

Decision: the setup resolves these imports, as in the project's own Vite
build, and a shared Sass partial causes no false failure. Pruning at every
depth was rejected under the adapter, because it would stop the setup's own
inlining, which a transform of a whole import chain, such as Tailwind's,
needs.

## CSS Modules

Under the adapter, Vite's own CSS Modules scope each CSS Module, on both of
Vite's CSS transformers. The CSS Modules settings of the setup apply:
`css.modules`, or `css.lightningcss.cssModules` with the lightningcss
transformer. Mokly sets only the scoped names:

- On the default transformer, each scoped name follows the
  [naming rule](./mokly-imported-styles-modules.md#names) of the CSS Modules
  contract: `mokly_<hash>_<local>`. These names equal the names of the esbuild
  path.
- On the lightningcss transformer, each scoped name follows the pattern
  `mokly_[hash]_[local]`. Its hash is lightningcss's own hash of the
  stylesheet path. Both comparison sides give the same names. These names
  differ from the names of the esbuild path and of the default transformer.

The class map of a CSS Module comes from the result of Vite's CSS Modules.
Mokly's scoper and its checks do not run under the adapter. The
[input rules](./mokly-vite-adapter-inputs.md#inputs-and-serve) cover each file
that a `composes` reads.

Decision: Vite's own CSS Modules give the keys and the scoping of the
project's own Vite build, and each scoped name depends only on the stylesheet
path and the local name. Mokly's own scoper and the setup's own scoped names
were rejected under the adapter.

## Catalogues Without JavaScript

Under the adapter, every local stylesheet goes through the setup, also in a
catalogue without JavaScript. A sidecar then starts, and the base side
extracts its sources and selects an installation, as for the `postcss`
module.

Decision: the setup takes the place of the `postcss` module, so the CSS does
not change when the catalogue gets its first JavaScript file. Mokly's own
stylesheet pipeline for a catalogue without JavaScript was rejected.

## Related Docs

- [Vite adapter](./mokly-vite-adapter.md) and
  [Vite adapter inputs](./mokly-vite-adapter-inputs.md)
- [Imported CSS configuration](./mokly-configuration-imported-styles.md)
- [Imported stylesheet delivery](./mokly-imported-styles.md),
  [CSS Modules](./mokly-imported-styles-modules.md), and
  [diagnostics](./mokly-imported-styles-errors.md)
- [Base source and dependency preparation](./mokly-base-preparation.md)
