# Imported Stylesheet Delivery

## Delivery

CSS/asset compilation, fragment stylesheet links, optional consumer PostCSS,
Serve/watch, export, publication, and Changes ship together. The
[implementation plan](../../plans/imported-css-delivery.md) records the rollout
and reviews.
Custom renderers must emit the supplied stylesheet links; pages link CSS
themselves. This contract extends
[configuration](./mokly-configuration.md),
[rendering](./mokly-rendering.md), and [source protection](./mokly-source-protection.md)
without changing manifest v8. [Exact diagnostics](./mokly-imported-styles-errors.md)
are normative.

## Routes And Ownership

`<mockupsDir>/mokly-generated/` is wholly Mokly-owned. Generated routes are
`mokly-generated/styles/<repository-relative root module path>.css` and
`mokly-generated/assets/<repository-relative asset path>`. Identical asset routes
from multiple roots must carry identical bytes; disagreeing bytes fail Build.
Preserve the module
extension before `.css`: `src/home.mockup.tsx` becomes
`mokly-generated/styles/src/home.mockup.tsx.css`. Shared assets have one route
and identical bytes. Sources stay private. Every file in the reserved tree is
owned output, including unknown orphans, for Check and public classification.
Graph loading checks the tree before inventory (including the graph load that
precedes derived Check); committed Check checks again before output comparison:
the root must be a real directory, descendants real directories/files; reject the first
sorted repo-relative symlink (even dangling), FIFO, socket or device without
following it. Derived Check uses Git tracking for output ownership after its
graph load. Successful Build prunes empty
directories beneath the root (including it), never during rollback. Catalogue
paths cannot have a first segment equal to `mokly-generated`, compared
case-insensitively; only portable `styles/**.css` and
supported `assets/**` can be generated inside it, never HTML.

Generated route segments allow a leading letter, digit, underscore or hyphen;
subsequent characters may also include dot and tilde. Device-name stems and
trailing dots remain invalid. A nonportable module file or directory name cannot
produce a stylesheet route, even when an entry declares a valid `path`. Build
fails with `cannot deliver imported CSS for {module}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)`,
where `{module}` is repository-relative. Entry identity and CSS delivery routes
have distinct inputs; the override changes only entry identity.

Reject root directories and `roots[].files` static prefixes, and `review.outDir`,
at or inside the reserved tree, and local `stylesheets` (shared/light/dark) paths
inside it. Resolve existing symlink aliases for these configured path boundaries.
Discovery skips it like Review output; broad roots and file globs remain valid.
A root directory cannot equal `mockupsDir`: otherwise every public file could
become authored source. Reject a consumer `publicExclude` only if
a brace-expanded alternative's first segment is literally `mokly-generated`.
Build rejects generated stylesheet/asset routes matching **any** exclusion,
defaults included, naming the route and glob. Reject authored inputs through
logical/physical reserved aliases and generated routes colliding with sources;
public files elsewhere under `mockupsDir` remain consumer-owned.

## Roots, Collection And Deduplication

Delivery roots are **only** the configured `renderer` module (the built-in
renderer has no stylesheet), followed by each resolved entry module sorted by
repository-relative POSIX path. A compatibility transformer still participates
in the JavaScript graph: CSS it imports is inventoried, including its local
`@import` closure and local `url()` assets, but transformer-only CSS has no
stylesheet route or link. Analyze transformer-only CSS imports and URLs without
running a stylesheet bundle; when a stylesheet is already delivered by a root,
do not parse it again for the transformer. For transformer-only syntax
use parser recovery, and never parse or inventory package CSS under
`node_modules` solely for the transformer. Metafile input and output keys
are relative to esbuild's real working directory even when the configured
repository root is a symlink; map all keys back to the logical root before
ordering roots or recording sources. The path mapper resolves the working
directory a fixed number of times per mapper, also when it is a symlink.
It maps physical keys to logical paths without resolving the working directory
again. A source inventory resolves `repoRoot` a fixed number of times per
call. The number of root resolutions does not
grow with the number of inputs or edges, including when the working directory
equals `repoRoot`. Read each metafile input at most once per root traversal. When
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
for Changes and transformer-only inventory.
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
