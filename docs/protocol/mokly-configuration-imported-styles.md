# Imported CSS Configuration

Continuation of [Mokly Configuration](./mokly-configuration.md). The
[imported stylesheet contract](./mokly-imported-styles.md) owns delivery and
the [error catalogue](./mokly-imported-styles-errors.md) owns diagnostics.

## Stylesheet Inputs

Three inputs supply CSS to a composed screen or component document. Mokly
bundles every local delivery root:

- configured `stylesheets` rules: local paths, config-relative, or HTTP(S)
  URLs, with the scheme-specific lists and the `$componentStylesheets` marker
  of the [configuration contract](./mokly-configuration.md#shape);
- stylesheets that entry modules and the renderer import, which the
  [sidecar](./mokly-sidecar.md#bundling) reports in the module graph and the
  core delivers under the imported stylesheet contract;
- component-declared local stylesheet roots under the
  [component stylesheets contract](./mokly-component-stylesheets.md).

A local stylesheet, its `@import` chain, and its `url()` assets are transformed by the consumer's PostCSS module when `postcss` is set, then
bundled under the [bundling rules](./mokly-imported-styles.md#bundling).
Serve answers the bundle from memory, and `build` writes it into `--out`.
Nothing is written into the repository. The
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
context per explicit PostCSS context id, with consumer plugin packages loaded unbundled
from the side's selected `node_modules`. Requests carry the source root,
repository roots, and resolution settings. Repository-owned presets use the
side's mapped source copy; installed plugin packages remain unbundled. PostCSS 8-compatible arrays include
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
JavaScript-safe loader. Configured and component-declared local stylesheets and PostCSS inputs
are protected authored sources: they are never served as files, and they
cannot escape their side's source root through symlinks. Package CSS and
JavaScript inside selected dependency roots are also allowed under the
[sidecar module rules](./mokly-sidecar-modules.md), with stable dependency
names and no catalogue source attribution.
Authored public CSS enters a document only through the
[referenced asset closure](./mokly-public-closure.md).
