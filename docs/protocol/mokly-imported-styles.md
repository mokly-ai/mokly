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
without changing manifest v5. [Exact diagnostics](./mokly-imported-styles-errors.md)
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
routes cannot begin with `mokly-generated/`; only portable `styles/**.css` and
supported `assets/**` can be generated inside it, never HTML.

Reject `entries` static prefixes, `entriesDir` and `review.outDir` at or inside
the reserved tree, and local `stylesheets` (shared/light/dark) paths inside it.
Resolve existing symlink aliases for these configured path boundaries as well.
Discovery skips it like Review output; broad co-located `entries` globs remain
valid. The existing `entriesDir === mockupsDir` ban remains: otherwise every
public file becomes authored source. Reject a consumer `publicExclude` only if
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
ordering roots or recording sources. When no renderer or entry reaches CSS, skip the
stylesheet pass entirely. A CSS-only entry still has an entry root even if it
registers no view. Two entries sharing CSS each emit it in their own bundle.
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
The CLI does not eagerly load Lightning CSS: its native CommonJS module is
loaded only when CSS Modules or transformer-only CSS require a transform.
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

For `*.module.css`, call Lightning CSS `transform` with
`filename` equal to the **repository-relative POSIX** file path,
`cssModules: { pattern: "mokly_[hash]_[local]", dashedIdents: false,
animation: true, grid: false, container: false, customIdents: true,
pure: false }`, `minify: false`, and browser targets resolved per stylesheet.
Load `browserslist` using Node resolution from the consumer config directory
then `moduleResolution.packageRoots`, call it with `path` set to the physical
stylesheet and convert its result using Lightning's `browserslistToTargets`.
Cache targets per stylesheet directory within a graph load. Browserslist
environment sections follow `BROWSERSLIST_ENV` and `NODE_ENV`; results also
depend on the consumer's installed Browserslist data. If the package is absent
and a Browserslist file, nearest package `browserslist` key, or the
`BROWSERSLIST`/`BROWSERSLIST_CONFIG` environment is present, fail with the
catalogued install guidance. Without any configuration, use fixed targets
whether or not the package is installed: Chrome 109, Edge
109, Firefox 115 ESR, Safari 14 and iOS Safari 14 (major versions shifted by
16 bits for Lightning); these deliberately retain older fallback and prefix
declarations. Plain CSS is delivered as authored and never transformed with
these targets. Suppress only Browserslist's outdated-data warning while
computing targets so the example's main process and PostCSS worker stay quiet;
consumers should update their Browserslist data independently. Lightning's
filename-derived `[hash]` (not a content hash) scopes classes, IDs,
`@keyframes` names and **all** their `animation`/`animation-name` references.
It also scopes `@counter-style` and its `list-style`/`list-style-type`
references, and `view-transition-name` values; these local names appear in
the exported map. References to undefined keyframe names are also localized.
Global `var(--brand)` tokens, grid-area and container names stay unchanged.
Lightning may normalize declarations (e.g. `animation: pulse 1s` to
`animation: 1s <scoped-name>`), preserving their meaning. A collision between
distinct local identities fails rather than appending a suffix.
Do **not** enable Lightning CSS `analyzeDependencies` for CSS Modules: that
mode removes local and remote `@import` rules and rejects relative `url()` in
custom properties. Module `@import`s and custom-property `url()` values use
the same esbuild resolution, pruning, inventory and asset delivery as plain
CSS. Lightning's normal transform may turn an authored `url()` image in an
unprefixed `image-set()` option into a quoted string. Tokenize the transformed
CSS, find each unprefixed `image-set()` function, and replace a local quoted
first token of each top-level comma-separated option with `url(<unchanged
string token>)`. Preserve escapes, query/hash suffixes, comments, nested
functions, `type()` arguments, gradients, and external strings; do not rewrite
`-webkit-image-set()`. Authored local quoted image-set strings have already
failed the pre-transform guard. Run a distinct post-transform guard on any
remaining local quoted image-set source so an unhandled Lightning rewrite
cannot escape Build validation. Asset routes and resolved URL targets are
equivalent between plain and module CSS; Lightning may format declarations
differently. Transformer-only CSS analysis may still use dependency analysis
because it does not emit a stylesheet.
PostCSS runs first. Feed the identical transformed CSS to the stylesheet
pass and use Lightning's exports for JavaScript: a default plain object
whose original local names map to space-joined scoped names; recursively
expand same-file and `global` `composes` in authored order, composed names
before the owning name, deduplicating names at first occurrence. Also export
each valid, non-reserved JavaScript identifier as a named string with the
same value. Other keys (such as `foo-bar`) remain accessible on the default
object. Cross-file `composes` and cyclic local composition fail, not silently
flattened. Plain CSS imports supply no JavaScript class map.
If PostCSS and renderer pruning produce a different export map between the
graph and delivered stylesheet passes, fail before writing instead of emitting
class names with no matching rules.

`moduleResolution.loaders` reserves `.css` and `.module.css`: their only
allowed consumer value is `empty`. `.css: "empty"` opts out of **both**
plain and module CSS, `.module.css: "empty"` opts out only of modules;
set both only if desired for clarity. An opted-out module supplies an empty
default map and no named bindings or delivered CSS; its file remains in
`sourceFiles` as a graph input. Other CSS loaders fail config validation.
No extension may use the consumer `css` loader: it would produce an
undelivered sibling file. Rename a stylesheet to `.css` or choose a
JavaScript-safe loader for non-stylesheet imports.
Any other consumer `file` loader used by a JavaScript import fails Build:
Mokly never exposes the extra JavaScript graph outputs as public URLs.

## PostCSS And Dependency Inventory

See the [PostCSS and dependency inventory contract](./mokly-imported-styles-postcss.md)
for module loading, transform ordering, reported dependencies, and validation
precedence; [exact messages](./mokly-imported-styles-errors.md) apply to both.

The remaining contract is continued in [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md).
