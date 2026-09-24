# Imported Stylesheet Delivery

## Delivery Status

Approved target; reserved-directory safety is implemented, while CSS delivery
is pending. [The plan](../../plans/imported-css-delivery.md) tracks the stages.
Until then, link authored CSS via `stylesheets`. This contract extends
[configuration](./mokly-configuration.md),
[rendering](./mokly-rendering.md), and [source protection](./mokly-source-protection.md)
without changing manifest v5. [Exact diagnostics](./mokly-imported-styles-errors.md)
are normative.

## Routes And Ownership

`<mockupsDir>/mokly-generated/` is wholly Mokly-owned. Generated routes are
`mokly-generated/styles/<repository-relative root module path>.css` and
`mokly-generated/assets/<repository-relative asset path>`. Preserve the module
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
stylesheet route or link. A CSS-only entry still has an entry root even if it
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
instead of retaining esbuild's CSS sibling output. A second esbuild pass
bundles each nonempty root from a synthetic CSS entry with ordered `@import`s,
allowing ordinary nested imports after the exclusion above. The CSS pass uses
the same aliases, conditions, main fields, package roots, extension and
symlink policy as the graph pass; it does not evaluate consumer JavaScript.

## CSS Modules And Import Loaders

For `*.module.css`, call Lightning CSS `transform` with
`filename` equal to the **repository-relative POSIX** file path,
`cssModules: { pattern: "mokly_[hash]_[local]", dashedIdents: false,
animation: true, grid: false, container: false, customIdents: false,
pure: false }`, `minify: false`, and no browser targets. Lightning's
filename-derived `[hash]` (not a content hash) scopes only classes, IDs and
keyframes. Global `var(--brand)` tokens, grid-area and container names, and
custom identifiers stay unchanged and are not exported. A collision between
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

Optional top-level `postcss` is a config-relative path to a regular `.ts`,
`.mts`, `.js`, `.mjs`, or `.cjs` module inside `repoRoot`; no discovery. Bundle
local imports with esbuild and retain them in `configSourceFiles` (private,
watched config-reload inputs). Resolve **every bare package import** from its
importer with Node ESM `import` conditions and externalize it as an absolute
`file:` URL in the temporary bundle; plugin packages and native bindings run
unbundled from the consumer's `node_modules`. Do not change how `mokly.config`
loads. The PostCSS module must
default-export a non-array object with `plugins` as either an ordered array
of PostCSS plugin instances or an insertion-ordered record mapping package
names to plain option objects. Resolve object-form package names with the
same Node ESM conditions from the PostCSS module's directory, instantiate
with those options, and preserve declared order.
`map` is accepted but ignored; Mokly emits no source maps. Reject any other
keys, missing/invalid plugins, escaping paths and failed package resolution.

Run the consumer's plugins in order once for each distinct effective
stylesheet input with `from` set to its physical source path, `map: false`,
**after** renderer-exclusion pruning and **before** CSS Modules naming and
esbuild CSS bundling. PostCSS may inline local `@import`s (Tailwind v4 does),
so preprocessing must prune the entire local import tree before it can see
excluded content. Cache by `(source path, effective pruned-import set)`
within a compilation and share that result between graph and CSS passes;
the same file with different root-specific pruning is a distinct input and
must be processed again. Mokly supplies PostCSS, not consumer plugins or
their versions.

Inventory is the sorted, unique, repo-relative union of config/graph inputs,
entry roots, CSS-pass inputs including nested imports and `url()` assets,
transformer-only CSS closure, and PostCSS `dependency` messages and expanded
`dir-dependency` matches. Retain both logical and in-repository realpath
aliases. Inventory-only `loadConsumerGraph(config, false)` **must run the same
CSS collection/pass and dependency reporting** without evaluating renderer
callbacks; `assertFreshSourceInventory` compares this union to
`manifest.sourceFiles` for Serve and publish. No manifest schema change.

Interpret a plugin's `dependency.file` or `dir-dependency.dir` relative to
its stylesheet when not absolute. Ignore inputs outside `repoRoot` (also
physical escapes) and under `node_modules` before normalizing; never feed
them to `normalizeSourceFiles`. For directory messages, recursively walk
regular files from the reported directory with the discovery walk's denied
directory list; do not honor `.gitignore`, but match each path relative to
the reported directory using its minimatch `glob`, or `**/*` if absent
(`dot: true`, case-sensitive). Require a reported in-repository directory to
exist and be a directory even if it currently matches no files. Skip
`node_modules`, `.mokly-cache`,
`review.outDir`, denied trees and paths outside `repoRoot`. Register allowed
directories for watching additions as well as current matching files.

**Validation precedence:** Explicit `dependency` naming Mokly-owned output
fails in both modes. For directory matches, committed mode fails when the
glob reaches an existing generated fragment, manifest or file below
`mokly-generated/`; derived mode skips those files. Neither mode inventories
Mokly output. Next, any plugin-reported file inside `mockupsDir` that is not
**already a graph-inventoried source** fails (including public CSS or HTML);
this applies to explicit files and expanded directories in both modes.
Entries below `mockupsDir` already in the graph are allowed. Finally validate
the remaining in-repo regular files. An excluded generated or denied path
cannot be restored by a plugin glob or explicit watch rule. Directory reports
outside the root or inside `node_modules` are ignored; malformed in-repo
messages and missing explicit files fail as specified in the error catalogue.
For Tailwind, `@source not "<path relative to the stylesheet>"` excludes
direct scans of that directory, but an **ancestor** directory dependency
may still report a glob matching files beneath `mockupsDir`. In that case
exclude the matching reported ancestor (if safe for other authored sources),
or prefer `@import "tailwindcss" source(none)` plus `@source` for explicit
authored trees. Do not silently skip an otherwise-public matching file just
because Tailwind did not list it individually. Dependencies in `node_modules`
may still affect
the processor's output, but are not private source inventory entries.

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

Use esbuild `write: false`, `metafile: true`, `bundle: true`, `minify: false`,
`target: "esnext"`, `outbase: repoRoot`, path-mirroring
`assetNames: "../assets/[dir]/[name]"` relative to `styles/`, and no content
hashes, source maps or browser syntax lowering. Strip only esbuild-inserted
source-path comments from CSS; Mokly does not add another CSS rewrite beyond
configured PostCSS, CSS Modules and esbuild's bundling/relative URL conversion.
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
GET/HEAD, confined paths). An imported CSS, nested import, asset, config or
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
