# Imported Stylesheet Delivery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Delivery

A configured or component-declared local stylesheet, and CSS that an entry module, a stories file,
or the renderer module imports with `import "./theme.css"` or
`import styles from "./card.module.css"`, reach documents one way. Mokly
bundles each delivery root into one stylesheet on `lightningcss` in the Rust
core, resolves its `@import` chain and `url()` assets, and delivers the
stylesheet through the render cache and its assets through verified source
streams under the `static/mokly-generated/` namespace. A configured HTTP(S) URL is linked
unchanged and never fetched. The sources stay private. This contract
extends [imported CSS configuration](./mokly-configuration-imported-styles.md),
[rendering](./mokly-rendering.md), and
[source protection](./mokly-source-protection.md).
[Exact diagnostics](./mokly-imported-styles-errors.md) are normative. The
[CSS Modules](./mokly-imported-styles-modules.md),
[PostCSS](./mokly-imported-styles-postcss.md), and
[assets](./mokly-imported-styles-assets.md) pages continue it.

## Routes And Ownership

The routes are relative to the `static/mokly-generated/` namespace of the
[artifact path contract](./mokly-artifact-paths.md):
`styles/<repository-relative root module path>.css` for the bundle of a
module root, `styles/<repository-relative stylesheet path>` for the bundle
of a configured or component-declared local stylesheet, and `assets/<repository-relative asset
path>` for an asset. The module extension is kept before `.css`:
`src/home.mockup.tsx` delivers `styles/src/home.mockup.tsx.css`, and the
configured `design/base.css` delivers `styles/design/base.css`; the two
forms never collide because a module path never ends in `.css`. `styles` and
`assets` are reserved as the
first segment of document routes. Nothing is written into the repository:
Serve answers the routes through
[generation delivery](./mokly-imported-styles-assets.md#validation-and-the-render-cache),
`build` writes them into its
output directory, publish uploads that output, and the base side of a
comparison bundles the base commit's sources the same way under the
[dependency tiers](./mokly-comparison.md#sides).

A route segment starts with a letter, digit, underscore, or hyphen; later
characters may also be a dot or a tilde. Windows device-name stems and
trailing dots are invalid. A root module whose file or directory name cannot
form a route fails with the catalogued message, even when the entry declares
a valid `path`: the `path` override changes entry identity only, never the
stylesheet route. Portable module and stylesheet paths give identical routes
on every platform.

## Roots, Collection And Deduplication

The delivery roots are each configured or component-declared local stylesheet,
the configured renderer module, and every entry module and stories file that reaches CSS,
sorted by repository-relative POSIX path within each kind. There are no
other delivery roots. A local stylesheet root has that file as its only
direct stylesheet; nothing is pruned from it or by it. A module that exports
only a
folder record is still a root. Two entries that share a stylesheet each
deliver it in their own bundle. When no root reaches CSS, the catalogue has no
stylesheet node.

The sidecar's [`bundle` call](./mokly-sidecar.md#bundling) reports the module
graph. The core reads each root's stylesheet imports from it in
first-reachability depth-first order of the JavaScript imports, including
re-exports and dynamic imports, with modules and stylesheets keyed by their
resolved logical path, so one root lists a file at most once. A CSS import may resolve inside the source root or a selected dependency
root. A package stylesheet uses its stable dependency name, such as
`node_modules/pkg/style.css`, on both sides. The binary reads it from that
installation and excludes it from catalogue sources. Repository packages
use the side's mapped copy under the
[sidecar module rules](./mokly-sidecar-modules.md). An import outside all
allowed roots fails at the authored importer. A diagnostic names the logical
module and never shows a virtual module or an absolute path.

The core then resolves nested local `@import`s, quoted and `url()` forms, to
form each root's complete stylesheet closure. The renderer's closure includes
its top-level stylesheets. Before an entry root is bundled, every file of the
renderer's closure is removed from the entry's direct list and from every
depth of its `@import` tree, and an excluded nested `@import` is removed
before PostCSS runs; nothing is pruned by selector or by emitted text. Thus a
renderer that imports `tokens.css` and `dark-theme.css` never sees
`tokens.css` reappear through an entry's component CSS. The first linked root
wins across renderer and entry; within one root, JavaScript first
reachability wins, and a repeated CSS `@import` keeps CSS's last-position
rule. A file shared by two entry roots is not suppressed. Remote `@import`s,
`"https://..."` and `url("https://...")`, stay external: never fetched, never
inventoried. Prelude imports are placed at the start of the bundle in their
order; a local `@import` after a style rule fails at its authored file.

`@import` resolution prepends `style` to the consumer's conditions and main
fields, or to `main,module` when the consumer sets none, because the `style`
export condition and the `style` main field are not selected by default.
Every other module resolution setting, including aliases, package roots,
extensions, and the symlink policy, is shared with the JavaScript graph. The
stylesheet pass evaluates no consumer JavaScript.
An aliased `@import` skips relative-file lookup; a plain bare `@import` first
tries a relative URL from the importing stylesheet's directory, then Node
package lookup from that directory.

## Bundling

A root's stylesheet is one node of the render graph, keyed by its stylesheet
sources, its assets, the PostCSS module, and the resolution settings. For
each stylesheet of the closure the core reads the text from the working tree,
or from a Git blob on the base side, with package inputs read from the
selected dependency root; runs the consumer's PostCSS plugins
through the sidecar's `processCss` when the configuration names a `postcss`
module; scopes a `*.module.css` file under the
[CSS Modules contract](./mokly-imported-styles-modules.md); and then bundles
the root on `lightningcss`: `@import`s inlined in prelude order, `url()`
references rewritten to asset routes, no minification, no source maps, no
syntax lowering, no vendor prefixing, and one trailing newline. `lightningcss`
reprints the stylesheet, so an authored comment may be dropped. Repeated
builds with the same inputs and deterministic plugins give byte-identical
output; plugin determinism is the consumer's responsibility. The plain and the
module form of a stylesheet differ only in their scoped names.

Changes analyses the delivered stylesheets, not the sources, under
[CSS change attribution](./mokly-css-attribution.md); equal normalized
before and after rule tuples join copies across roots under the
[membership rule](./mokly-css-attribution-rules.md). Private CSS inputs are
rebuild inputs only.

## CSS Modules And Import Loaders

See the [CSS Modules contract](./mokly-imported-styles-modules.md) for
rename-only scoping, composition, exports, and import loaders.

## PostCSS And Dependency Inventory

See the [PostCSS contract](./mokly-imported-styles-postcss.md) for module
loading, transform order, and reported dependencies.

The contract continues in
[Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md).
