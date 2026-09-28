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

For `*.module.css`, Mokly runs its own PostCSS parser and the same rename-only
CSS Modules pipeline as css-loader and Vite's default: first
`postcss-modules-local-by-default({ mode: "local" })`, then
`postcss-modules-extract-imports()`, then
`postcss-modules-scope({ generateScopedName })`, followed by
`icss-utils.extractICSS(root)`. Load these packages lazily in the main process;
the isolated worker is only for consumer PostCSS plugins. Run after renderer
pruning and consumer PostCSS, sharing the `(source, effective pruned set)`
memo between the graph and stylesheet passes. The generated name is
`mokly_<hash>_<local>` where `<hash>` is the first **12 lowercase hex** digits
of SHA-256 over the UTF-8 repository-relative POSIX stylesheet path. It never
depends on source bytes, bundle order, process cwd or platform separators.
Distinct local identities colliding at a generated name fail Build.

`@scope` prelude localization is Mokly-owned until the CSS Modules plugins
fix their text splitting. Parse `[trivia] [(start)] [trivia] [to [trivia]
(limit)] [trivia]`; trivia is whitespace or comments, `to` is a standalone
top-level identifier (case-insensitive), and either group may be absent.
Groups are balanced through nested parentheses/brackets, quoted strings,
escapes and comments. A missing/empty group, dangling `to`, extra text or
third group fails with the catalogued prelude error at the at-rule's authored
line/column. Empty params mean no prelude. Preserve every character outside
the group interiors, including keyword case and comments. Hide all at-rules
whose names end in `scope` from the plugins; only a real `@scope` (any case)
gets temporary selector rules for its start/limit. The rules sit just before
the at-rule in its parent and carry its source location; after plugin scoping,
read their localized selectors, remove them and restore the original at-rule
name and params. Other scope-suffixed at-rules retain their params unchanged.
The prelude uses normal selector localization, including default local,
`:global(...)`, `:local(...)`, bare modes, lists, `:scope`, `&`, `:is()` and
`:not()`. Local prelude names are exported and count for identity collisions.
The temporary selector rules also make those names available as earlier
selectors for a later `composes`, including when the scope is nested in a
rule, `@media`, `@supports` or `@layer`.

After restoration, verify the scoping result against its input with parsed
PostCSS trees. Remove only input `composes`/`compose-with` declarations
(case-insensitive), then compare node counts, types and order. Comments,
declaration properties/importance and all unrelated at-rule params are exact.
Value tokens may remain identical or change one valid identifier word to
`mokly_<hash>_<word>`; `global(word)`/`local(word)` may collapse to that word
or its scoped version. Strings, functions, dividers and whitespace-token
presence otherwise stay unchanged. Selector trees may unwrap `:global` and
`:local` (including bare forms and their dropped combinator), and only class,
ID and `[class=…]` values may gain the exact module prefix. A keyframes-family
at-rule param may likewise gain that prefix after optional local/global
unwrapping. Scope params keep the same group structure and non-group bytes;
their interiors follow the selector rule. Equal selector/value text skips
tokenization; parse failure counts as a difference. Report the first
difference with the input node's file/line/column. This check does not infer
semantic animation correctness: `animation-name: ease` still passes when the
plugin leaves that local keyframe reference bare. The plugin's invalid
`animation: grow-progress auto linear` rewrite and quoted-keyframe prefix
rewrite fail Build rather than shipping invalid CSS.

Only local classes, IDs, `@keyframes` names and their `animation` and
`animation-name` references are renamed. `:global(...)` stays global and
`:local(...)` becomes a local selector. `@counter-style` names and list-style
references, `view-transition-name`, custom properties and `var(--token)`,
grid-area and container names remain global. The scoper does not optimize,
prefix, polyfill or normalize other declarations, selectors, comments,
`@import`s, `url()`s, `image-set()` options, fallbacks, media/supports/layer
conditions or modern CSS syntax. These reach esbuild as authored; plain and
module bundles differ only in the scoped names. The authored quoted-local
`image-set()` guard still runs before scoping. Lightning CSS remains a
read-only parser for Changes and transformer-only inventory, never a module
delivery transformer. Browserslist targets are the consumer's PostCSS concern,
not a Mokly CSS Modules input.

Before the plugins run, reject authored `:import(...)`, `:export` and
`@value` with the exact catalogued diagnostics. Lightning previously left
authored ICSS rules in CSS without binding them to JavaScript, and rejected
`@value`; explicit failure avoids silent changes. After the plugins, reject
generated ICSS imports as cross-file `composes` with the existing message.
Same-file `composes` may reference only a class defined **earlier** in that
file; a forward or missing name fails with the catalogued location. This is
the css-loader/Vite rule and makes local cycles impossible. `from global`
works. The default export is a plain map of sorted local keys to the plugins'
space-joined values: owning scoped name first, then composed names in authored
order, including repeats. Each valid, non-reserved JavaScript identifier is
also a named string export with the same value. Other keys remain on the
default map. Plain CSS imports supply no JavaScript class map.
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
