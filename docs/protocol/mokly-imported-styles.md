# Imported Stylesheet Delivery

## Delivery Status

Approved target; CSS/asset compilation and stylesheet links in fragment render
input are implemented. PostCSS processing is pending.
[The plan](../../plans/imported-css-delivery.md) tracks the remaining stages.
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
running a stylesheet bundle; when no renderer or entry reaches CSS, skip the
stylesheet pass entirely. A CSS-only entry still has an entry root even if it
registers no view. Two entries sharing CSS each emit it in their own bundle.

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
esbuild places it last within that root; it hoists remote prelude imports.

## CSS Modules And Import Loaders

For `*.module.css`, call Lightning CSS `transform` with
`filename` equal to the **repository-relative POSIX** file path,
`cssModules: { pattern: "mokly_[hash]_[local]", dashedIdents: false,
animation: true, grid: false, container: false, customIdents: true,
pure: false }`, `minify: false`, and no browser targets. Lightning's
filename-derived `[hash]` (not a content hash) scopes classes, IDs,
`@keyframes` names and **all** their `animation`/`animation-name` references.
It also scopes `@counter-style` and its `list-style`/`list-style-type`
references, and `view-transition-name` values; these local names appear in
the exported map. References to undefined keyframe names are also localized.
Global `var(--brand)` tokens, grid-area and container names stay unchanged.
Lightning may normalize declarations (e.g. `animation: pulse 1s` to
`animation: 1s <scoped-name>`), preserving their meaning. A collision between
distinct local identities fails rather than appending a suffix.
PostCSS runs first. Feed the identical transformed CSS to the stylesheet
pass and use Lightning's exports for JavaScript: a default plain object
whose original local names map to space-joined scoped names; recursively
expand same-file and `global` `composes` in authored order, composed names
before the owning name, deduplicating names at first occurrence. Also export
each valid, non-reserved JavaScript identifier as a named string with the
same value. Other keys (such as `foo-bar`) remain accessible on the default
object. Cross-file `composes` and cyclic local composition fail, not silently
flattened. Plain CSS imports supply no JavaScript class map.

`moduleResolution.loaders` reserves `.css` and `.module.css`: their only
allowed consumer value is `empty`. `.css: "empty"` opts out of **both**
plain and module CSS, `.module.css: "empty"` opts out only of modules;
set both only if desired for clarity. An opted-out module supplies an empty
default map and no named bindings or delivered CSS; its file remains in
`sourceFiles` as a graph input. Other CSS loaders fail config validation.
Any other consumer `file` loader used by a JavaScript import fails Build:
Mokly never exposes the extra JavaScript graph outputs as public URLs.

## PostCSS And Dependency Inventory

See the [PostCSS and dependency inventory contract](./mokly-imported-styles-postcss.md)
for module loading, transform ordering, reported dependencies, and validation
precedence; [exact messages](./mokly-imported-styles-errors.md) apply to both.

## Assets, Links And Delivery

CSS `url()` values beginning `data:`, `http:`, `https:` (schemes matched
case-insensitively), `//` or `#` remain unchanged. A root-absolute `/...`
URL is invalid. Relative URLs resolve
against the referring CSS file; strip `?query`/`#hash` for resolution and
restore that exact suffix after esbuild rewrites the relative path. Require a
regular confined file. An asset inside `mockupsDir` that is not already an
inventoried graph source fails instead of silently making an existing public
URL private; move the imported asset outside `mockupsDir` or keep it as a
separately linked public asset. In-repository `node_modules` assets are allowed and
their full repo-relative paths are mirrored. Only `.avif`, `.bmp`, `.gif`,
`.ico`, `.jpeg`, `.jpg`, `.png`, `.svg`, `.webp`, `.eot`, `.otf`, `.ttf`,
`.woff`, `.woff2` (matched case-sensitively) use esbuild's `file` loader.
Every other extension fails.
`mokly-generated/assets/<path>` must satisfy the existing portable URL-path
rule segment by segment: `/^[A-Za-z0-9][A-Za-z0-9._~-]*$/`, no trailing
dot, and no Windows device-name stem (`aux`, `con`, `nul`, `prn`, `com1`–`9`,
`lpt1`–`9`, ignoring case). No empty, `.`, `..`, backslash, drive or colon
segments. **Only** the segment immediately after `node_modules` may instead
match `/^@[A-Za-z0-9][A-Za-z0-9._~-]*$/` (npm scope, e.g. `@fontsource`);
all other constraints remain. Esbuild emits the literal `@` in relative CSS
`url()` references; `encodeUrlPath` converts it to
`%40` for links, Serve decodes it, and export resource discovery accepts and
decodes both forms. The complete stylesheet route obeys the usual rule.

`RenderInput.stylesheets` is: first matching rule's shared paths, then its
scheme-specific paths, then configured renderer stylesheet if present, then
entry stylesheet if present; generated links exist even without a configured
rule. Resolve/encode local paths relative to each fragment route, e.g. from
`app/home.mobile.html` to `mokly-generated/styles/src/home.mockup.tsx.css`
is `../mokly-generated/styles/src/home.mockup.tsx.css`. Same order for dark,
component variants and saved viewports. The consumer renderer decides whether
to emit links; Mokly does not inject link tags. Pages receive no render input
or automatic link; they still cause an entry stylesheet to be generated and
can link it themselves with a relative URL. Pending generated routes are
valid link/resource targets before the transaction writes them.

The owning entry root is the **resolved entry module whose `mockups` or
default export yielded the definition** (including re-exports and flattened
nested definitions), not the module where its `define*` call ran. Record it
in memory during graph evaluation and propagate it through registry preparation
without adding a manifest field. Two entries may import the same helper but
link their own independent entry bundles.

Validation uses one generation-local pending set of HTML text, CSS text and
opaque asset bytes, seeded with all style outputs before rendering. On-demand
documents add HTML lazily to that same set; never decode asset bytes. Validate
generated CSS `url()` references recursively as CSS resources, and binary
assets by existence only. Pending generated routes satisfy stylesheet and
component resource checks; compatibility `availableRoutes` includes them.
The internal manifest is not a public pending resource, even though it is a
generated text output; links and component resources naming it retain the
existing internal-metadata rejection before the manifest exists on disk.
Ownership/orphan checks use the complete pending public set plus the internal
manifest output, not just HTML routes.
Never read a reserved route from disk during compilation: absent pending
reserved bytes mean a missing target even if an old file exists. On-demand
Serve responds to `/static/` generated CSS and assets from the accepted
generation's bytes, not on-disk files.
Full compilation continues to walk and validate transitive references in linked
authored public HTML; on-demand validation reads only the requested view and
resources it must validate for that request.
One accepted on-demand generation computes its pending orphan set once from
the complete route index and parses each generated CSS file at most once.
Subsequent view requests reuse both indexes while HTML and edited component
props remain request-specific. A new accepted generation owns fresh indexes;
the public validation rules and diagnostic order do not change.

Use esbuild `write: false`, `metafile: true`, `bundle: true`, `minify: false`,
`target: "esnext"`, `outbase: repoRoot`, path-mirroring
`assetNames: "../assets/[dir]/[name]"` relative to `styles/`, and no content
hashes, source maps or browser syntax lowering. Strip only esbuild-inserted
source-path comments and their separator blank lines, and end CSS with one
newline; Mokly does not otherwise rewrite PostCSS/CSS Modules/esbuild output.
Esbuild itself may drop ordinary authored comments or move legal comments,
even without minification. Repeated builds with the same
inputs and deterministic plugins yield byte-identical output; plugin
determinism is the consumer's responsibility.

`Compilation.outputs` carries text or raw bytes; compare, stage, roll back,
read and export by bytes. Build replaces only owned outputs transactionally
and removes stale files under the reserved directory. Committed Check compares
every compiled byte and reports extra files in that directory as orphans;
derived Check accepts missing/mismatched local output but rejects any
Git-tracked reserved-directory file with `git rm --cached` and one
`/<mockupsDir-relative-from-repoRoot>/mokly-generated/` `.gitignore` rule.
Serve `/static/<encoded-route>` and transient previews prefer this generation's
compiled stylesheet/asset bytes over old disk files (correct content types,
GET/HEAD, confined paths). Retained Serve runtimes carry per-root stylesheet
routes and the CSS/asset outputs as raw bytes through the worker and watched
child IPC boundaries. Recompiling an accepted JavaScript graph reuses those
outputs without rescanning CSS; runtime transfer may not lose the route map
or decode assets as UTF-8. An imported CSS, nested import, asset, config or
plugin-dependency edit rebuilds; new matching files in watched dependency
directories also rebuild. Ordinary linked authored public CSS changes still
reload. Committed export/publication capture checked disk bytes; derived
export/publication and Changes capture validated compilation bytes, including
binary assets, and keep imported sources private. Generated linked stylesheets
are public resources analyzed by [CSS change attribution](./mokly-css-attribution.md);
their original private CSS inputs are dependency evidence, not independently
analyzed public sheets. The first derived baseline using the older toolchain
lacks these links, so affected views show a one-time Changes jump; later
baselines settle on the new output.
