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

Only the lowercase forms of these suffixes make a file a stylesheet, as in the
project's own Vite build. A configured or declared stylesheet whose suffix is
not lowercase, such as `Action.CSS`, fails with the Vite setup row of the
[diagnostics](./mokly-imported-styles-errors.md#build-build-invalid). The
esbuild path keeps its case-insensitive `.css` rule.

Decision: the adapter matches suffixes as the project's own Vite build does,
because the adapter compiles through that build's setup. A case-insensitive
match was rejected under the adapter, because that build does not treat
`Action.CSS` as a stylesheet.

Mokly orders, bundles, delivers, and attributes the result under the
[imported stylesheet contract](./mokly-imported-styles.md), as on the esbuild
path. The files that the transform reports as dependencies are watched inputs.
Each such file also joins the source inventory of the
[source protection contract](./mokly-source-protection.md) as a protected
input, as on the esbuild path. A document that references such a file as a
public file fails with the protected-target diagnostic of the
[referenced closure](./mokly-public-closure.md). Its reason names the Vite
setup and the Tailwind exclusion, as the
[diagnostics](./mokly-imported-styles-errors.md#build-build-invalid) state.

Each file that a `composes` of a CSS Module reads is a protected input too,
even when no plugin reports it. A document that references a file that only a
`composes` reads fails with the protected-target diagnostic. Its reason is the
imported stylesheet reason, which names the CSS Module that composes from the
file, as the
[diagnostics](./mokly-imported-styles-errors.md#build-build-invalid) state.

Decision: reported files are protected inputs on both compile paths, so both
paths publish the same files. Inputs that are only watched were rejected under
the adapter, because a document could then publish a file that the esbuild
path protects. A file that a `composes` reads is protected too, because it is
a stylesheet source, and the source policy keeps stylesheet sources private.
A file that only a `composes` reads gets the imported stylesheet reason,
because a `composes` from another file imports that file. The stylesheet of
the CSS Module also delivers the CSS of that file. A new reason for this case
was rejected, because the imported stylesheet reason fits.

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
