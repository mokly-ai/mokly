# Imported Stylesheet Delivery

## Delivery Status

CSS/asset compilation, fragment stylesheet links, optional consumer PostCSS,
Serve/watch, export, publication, and Changes ship together. The
[implementation plan](../../plans/imported-css-delivery.md) records the rollout
and reviews.

## Delivery

Custom renderers must emit the supplied stylesheet links; pages link CSS
themselves. This contract extends
[configuration](./mokly-configuration.md),
[rendering](./mokly-rendering.md), and [source protection](./mokly-source-protection.md)
without changing manifest v9. [Exact diagnostics](./mokly-imported-styles-errors.md)
are normative.

## Routes And Ownership

`<mockupsDir>/mokly-generated/` is wholly Mokly-owned. Its output map uses
`styles/<repository-relative root module path>.css` and
`assets/<repository-relative asset path>`, relative to that generated root.
Pages, screen/component views and the private v9 manifest share the same tree.
Preserve the module extension before `.css`: `src/home.mockup.tsx` becomes
`styles/src/home.mockup.tsx.css`. Identical asset routes from multiple roots
must carry identical bytes; disagreeing bytes fail Build. Sources stay private.
The [unified layout](./mokly-unified-output.md#one-owned-tree) reserves `styles`
and `assets` as the first segment of generated HTML routes. Path-derived HTML routes use `<path>/index[.<axes>].html`; the generated
root prefix is not part of those routes.

Only a writer or tracked Check inspects the existing generated tree. Its root
must be a real directory and descendants must be real directories or regular
files. Reject the first sorted repo-relative symlink, FIFO, socket or device
without following it. A successful Build replaces the whole tree and removes
stale files and empty directories. Plain Serve, export, publication and
untracked Check do not inspect old output. CLI Publish separately checks the
checkout and committed generation or requires ignored derived output under the
[upload contract](./mokly-upload.md). The
[tracking rules](./mokly-generated-output.md#tracked-state-and-commands)
apply equally to generated CSS, assets, HTML and the manifest.

Reject root directories and `roots[].files` static prefixes, renderer,
package roots, PostCSS inputs, local `stylesheets` and `review.outDir` that
violate the generated-tree boundary, including physical aliases. Discovery
skips this tree; broad entry globs remain valid. Entry modules below
`mockupsDir` remain protected sources, but a root directory equal to `mockupsDir` is
invalid. `publicExclude` is removed. Other authored files become public only
through the validated [asset closure](./mokly-generated-output.md#closure-urls-and-publication).

Generated route segments allow a leading letter, digit, underscore or hyphen;
subsequent characters may also include dot and tilde. Device-name stems and
trailing dots remain invalid. A nonportable module file or directory name cannot
produce a stylesheet route, even when an entry declares a valid `path`. Build
fails with `cannot deliver imported CSS for {module}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)`,
where `{module}` is repository-relative. Entry identity and CSS delivery routes
have distinct inputs; the override changes only entry identity.

## Roots, Collection And Deduplication

Delivery roots are **only** the configured `renderer` module (the built-in
renderer has no stylesheet), followed by each resolved entry module sorted by
repository-relative POSIX path. There are no other delivery or inventory-only
consumer roots. Metafile input and output keys
are relative to esbuild's real working directory even when the configured
repository root is a symlink; map all keys back to the logical root before
ordering roots or recording sources. Resolve esbuild's working directory once
per metafile. Read each metafile input at most once per root traversal. When
no renderer or entry reaches CSS, skip the stylesheet pass entirely. A module
that exports only a folder record still has a CSS delivery root even
though it registers no view. Every entry module must export a definition. Two entries sharing CSS each emit it in their own bundle.
After the JavaScript graph build and before CSS bundling or graph inventory,
validate each delivery root's direct CSS imports against `repoRoot`. Read the
metafile edge's original specifier and importing module, including extensionless
package imports, `require()` and dynamic `import()`. The error names that
authored importer; virtual stylesheet modules and absolute resolved paths must
not appear in it. Every CSS-pass diagnostic replaces a synthetic virtual
importer with the root's authored module path; a synthetic absolute import is
displayed relative to that root rather than leaking its working directory.

Collect CSS in first-reachability depth-first traversal of each root's
JavaScript imports (including re-exports and dynamic imports esbuild bundles),
following metafile import order, with visited modules and stylesheet file
identities keyed by resolved logical paths. One root lists each CSS file at
most once at this stage. Resolve nested local CSS `@import`s (quoted and
`url()` forms), including those
that PostCSS might inline, to form each root's complete stylesheet-file
closure. The renderer's closure includes its top-level CSS files. Before
processing an entry root, remove **every** file in that closure from the
entry's direct CSS list and from every depth of its local CSS `@import` tree;
replace an excluded nested `@import` with nothing **before PostCSS runs**.
Never prune by a selector or by comparing emitted text. Thus a renderer
importing `tokens.css` then `dark-theme.css` cannot have `tokens.css` reappear
later through an entry's component CSS. The first linked root wins across
renderer/entry; within one root JavaScript first reachability wins, while
remaining repeated CSS `@import`s retain CSS's last-position semantics.
Do not suppress a shared file between two entry roots. Remote HTTP(S)
`@import "https://..."` and `@import url("https://...")` stay external:
never fetch or inventory them. For valid prelude imports, esbuild puts them
at the start of the bundled root stylesheet before local rules, preserving
their order; late imports after a rule stay there and follow CSS validity rules.

Graph pass: one in-memory JavaScript output; Mokly captures plain `.css` as
an empty side-effect module and `.module.css` as a transformed class map,
instead of retaining esbuild's CSS sibling output. A CSS pass bundles the
renderer alone and all nonempty entry roots together in a multi-entry esbuild
build, each from a distinct synthetic path with ordered `@import`s. Each
root's prelude walk and its metafile output inputs determine its inventory;
shared assets must have identical bytes across both builds. Select failures
by root order, never plugin callback order. Nested imports retain their CSS
ordering. The CSS pass uses
the same aliases, conditions, main fields, package roots, extension and
symlink policy as the graph pass; it does not evaluate consumer JavaScript.
The CLI does not eagerly load CSS Modules plugins or Lightning CSS. The
former load only when a module is scoped; Lightning remains a read-only parser
for Changes.
For CSS `@import` resolution in both the prelude scan and the CSS pass,
prepend `style` to the consumer's conditions and main fields (or esbuild's
Node defaults `main,module` when unset): neither the `style` export condition
nor the `style` main field is selected by esbuild by default. Keep all other
consumer resolution settings unchanged. Esbuild's metafile input imports
retain source order, including JavaScript re-exports and dynamic imports.
When CSS is both JavaScript-imported and imported by an earlier CSS file,
esbuild places it last within that root; it hoists remote imports even when
they appear after an authored style rule. A local `@import` after the import
prelude fails at its authored file rather than resolving against the generated
stylesheet. Remote imports remain external and are never inventoried.

## CSS Modules And Import Loaders

See the [CSS Modules contract](./mokly-imported-styles-modules.md) for
rename-only delivery, `@scope`, selector-list joins, exports, import loaders
and exact verification rules.

## PostCSS And Dependency Inventory

See the [PostCSS and dependency inventory contract](./mokly-imported-styles-postcss.md)
for module loading, transform ordering, reported dependencies, and validation
precedence; [exact messages](./mokly-imported-styles-errors.md) apply to both.

The remaining contract is continued in [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md).
