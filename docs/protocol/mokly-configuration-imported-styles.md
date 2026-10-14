# Imported CSS Configuration

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Mokly Configuration](./mokly-configuration.md). The
[imported stylesheet contract](./mokly-imported-styles.md) owns delivery and
the [error catalogue](./mokly-imported-styles-errors.md) owns diagnostics.

## Stylesheet Inputs

Three inputs supply CSS to a composed screen or component document, and the
Rust core bundles them all:

- configured `stylesheets` rules: local paths, config-relative, or HTTP(S)
  URLs, with the scheme-specific lists and the `$componentStylesheets` marker
  of the [configuration contract](./mokly-configuration.md#shape);
- stylesheets that entry modules and the renderer import, which the
  [sidecar](./mokly-sidecar.md#bundling) reports in the module graph and the
  core delivers under the imported stylesheet contract;
- component-declared stylesheets under the
  [component stylesheets contract](./mokly-component-stylesheets.md).

A local stylesheet, its `@import` chain, and its `url()` assets are transformed by the consumer's PostCSS module when `postcss` is set, then
bundled on `lightningcss`. The bundle is a node of the render graph, keyed by its sources, assets,
PostCSS module, and resolution settings; it is kept in the render cache,
served from there, and written by `build` into `--out`. Nothing is written
into the repository. The
[renderer stylesheet contract](./mokly-rendering.md#renderer-stylesheets)
owns the complete stylesheet list of a document and its order, including
delivery without a configured rule and how pages link CSS. The styles a
sidecar render produces are not stylesheet inputs; they enter the document
head as owned style elements under the
[comparison contract](./mokly-comparison.md#style-ownership).

## PostCSS Module

`postcss` optionally names a config-relative local module inside `repoRoot`.
The core inventories its local imports as watched stylesheet inputs. The
module runs in the sidecar's `processCss` call, in a fresh isolated module
context per bundle generation, with consumer plugin packages loaded unbundled
from the consumer's `node_modules`. PostCSS 8-compatible arrays include
instances, uncalled creators, plain functions and `{ postcss: fn }` objects;
ordered package-name records are also accepted. ESM imports and CommonJS
`require()` use their respective Node resolution conditions. The call returns
the transformed text and the plugin-reported file and directory dependencies,
which the core watches. The complete module format, loading, transform and
dependency contract is
[Imported Stylesheet PostCSS](./mokly-imported-styles-postcss.md).

## Loader Boundaries

Mokly owns `.css` and `.module.css` handling. At those keys,
`moduleResolution.loaders` accepts only `"empty"`: `.css` skips both plain
and module CSS, while `.module.css` skips only module CSS and its class map.
Opted-out CSS stays inventoried as a watched source. A `file` loader on
another JavaScript-imported asset fails `build`. A consumer `css` loader on any
extension is rejected at config validation because it would emit an
undelivered sibling stylesheet; rename the input to `.css` or use a
JavaScript-safe loader. Local configured stylesheet paths and PostCSS inputs
are protected authored sources: they are never served as files, and they
cannot resolve outside `repoRoot`, including through symlink aliases.
Authored public CSS enters a document only through the
[referenced asset closure](./mokly-public-closure.md).
