# Imported Stylesheet PostCSS And Dependency Inventory

This is the PostCSS and inventory companion to the [imported stylesheet
contract](./mokly-imported-styles.md). [Exact diagnostics](./mokly-imported-styles-errors.md)
apply throughout.

Optional top-level `postcss` is a config-relative path to a regular `.ts`,
`.mts`, `.js`, `.mjs`, or `.cjs` module inside `repoRoot`; no discovery. Bundle
local imports with esbuild and retain them in `configSourceFiles` (private,
watched config-reload inputs), using metafile-only analysis at config load:
do not evaluate plugins until graph load. `ResolvedConfig` stores only the
absolute module path and serializable watch metadata, never plugin instances;
it crosses Serve IPC as JSON. Resolve **every bare package import** from its
importer with Node ESM `import` conditions and externalize it as an absolute
`file:` URL in the temporary bundle; plugin packages and native bindings run
unbundled from the consumer's `node_modules`. Do not change how `mokly.config`
loads. Rewrite `import.meta.url`, `import.meta.dirname`, and
`import.meta.filename` for each bundled local source to that source's own
real file location, not the temporary bundle's; reload/evaluate and instantiate
plugins in a fresh isolated worker module context once per graph load through the
PostCSS config loader; a stateful plugin package must not retain candidates
across compilations or watched rebuilds. Terminate that context after the
load, without reinstantiating plugins for each stylesheet. CommonJS modules
and local `.cts` helpers use CommonJS `require` conditions for bare packages,
retain Node built-ins, and receive `require` rooted at the real module path
plus per-file `__dirname` and `__filename`; ESM imports retain `import`
conditions. The
PostCSS module must default-export a non-array object with `plugins`
as either an ordered array of PostCSS 8-compatible plugins (instances,
uncalled creators with `postcss: true`, plain function plugins and objects
with a `postcss` factory) or an insertion-ordered
record mapping package names to plain option objects. Resolve object-form
package names with the same Node ESM conditions from the PostCSS module's
directory, instantiate with those options, and preserve declared order.
`map` is accepted but ignored; Mokly emits no source maps. Reject any other
keys, missing/invalid plugins, escaping paths and failed package resolution.
Let PostCSS normalize array elements instead of requiring `postcssPlugin`;
map normalization failures to the indexed `config-invalid` diagnostic.
The parent treats `error`, `messageerror`, and every unexpected worker exit
(including exit code 0) as permanent failure. Reject all in-flight requests
and reject later calls immediately with the worker diagnostic in the
[error catalogue](./mokly-imported-styles-errors.md); a requested `close()`
is not a worker failure. Worker death cannot leave Build or watched Serve's
serialized action queue waiting for a response.

Run the consumer's plugins in order once for each distinct effective
stylesheet input with `from` set to its physical source path, `map: false`,
**after** renderer-exclusion pruning and **before** CSS Modules naming and
esbuild CSS bundling. A plugin can inline nested local `@import`s directly
from disk, bypassing Mokly's pruning. For each processed input, walk the kept
local prelude-import tree using the stylesheet resolver, without executing
plugins. If an excluded renderer file is reachable at depth two or more through
a kept intermediate file and a plugin reports that excluded file as a
`dependency`, fail with the nested-import diagnostic before inventory checks;
do not silently duplicate it. If no plugin reports it, esbuild prunes it at
the nested file as usual. The diagnostic names the immediate intermediate
file importing the excluded file (for a deeper chain, its direct importer).
Cache by `(source path, effective pruned-import set)`
within a compilation and share that result between graph and CSS passes;
the effective set consists only of resolved local prelude imports excluded
from that file, not every file in the renderer's closure;
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
Directory-dependency watch roots on a `ResolvedConfig` are generation-scoped
watch metadata, not authored configuration: export's final input-stability
comparison omits that field from both configurations, while still comparing
the compiled output, source inventory and captured public bytes.

Interpret a plugin's `dependency.file` or `dir-dependency.dir` relative to
its stylesheet when not absolute. Translate physical paths reported by
PostCSS under a symlinked repository root to the configured logical root,
retaining real aliases for confinement and privacy checks. Ignore inputs
outside the repository's physical root and physically under `node_modules`
before normalizing; never feed
them to `normalizeSourceFiles`. For directory messages, recursively walk
regular files from the reported directory with the discovery walk's denied
directory list; do not honor `.gitignore`, but match each path relative to
the reported directory using its minimatch `glob`, or `**/*` if absent
(`dot: true`, case-sensitive). Require a reported in-repository directory to
exist and be a directory even if it currently matches no files. Skip
`node_modules`, `.mokly-cache`, `review.outDir`, denied trees and paths outside
`repoRoot`. Register allowed directories for watching additions as well as
current matching files. A reported directory may be an in-repository symlink
to an in-repository directory; preserve the logical and physical source
aliases of its matching files. Never follow symlinks encountered below the
reported directory during the walk.
Dependency walking, inventory, entry discovery and watch classification use
one reasoned path classification by both reported logical path and projected
real path: generated fragments/manifest/reserved tree, Review output, cache,
denied directory names, and physical escapes are distinct reasons. Reject
generated output, Review and cache ahead of required inputs; denied directory
names prune discovery and directory scans but cannot hide exact required inputs
or their ancestors. An explicit `dependency.file` is an exact required input:
an existing file under `dist`, `target`, `coverage`, `test-results`,
`playwright-report`, or `.context` remains inventoried and watched. Broad
directory scans still prune those trees. A symlink alias to generated output keeps
the same explicit-dependency error and committed/derived directory precedence
as its physical target; diagnostics name the reported logical path. In
committed mode scan generated trees for matching files before reporting them;
in derived mode skip those trees entirely.
Each reported glob is compiled once per report, classification is cached
within the graph load, and expanded files already checked as explicit
dependencies are not checked again. Resolve fixed logical/physical roots once
per dependency collection, compute each candidate's repository-relative path
once, sort each candidate class once, then apply generated-output, public-file,
and regular-file checks in that order. Diagnostics and inventory ordering compare
path UTF-16 code units without locale-sensitive collation.

**Validation precedence:** Explicit `dependency` naming Mokly-owned output
fails in both modes. For directory matches, committed mode fails when the
glob reaches an existing generated fragment, manifest or file below
`mokly-generated/`; derived mode skips those files. Resolve in-repository
symlink aliases before classifying generated output or otherwise-public files
under `mockupsDir`, so an alias cannot hide either class. Diagnostic `{file}`
keeps the reported logical path. Neither mode inventories Mokly output. Next,
any plugin-reported file inside `mockupsDir` that is not
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
because Tailwind did not list it individually. Dependencies physically in
`node_modules` may still affect processor output, but are not private source
inventory entries. A logical `node_modules` symlink into an in-repository
workspace package is different: its physical package source and logical alias
remain inventoried as exact required inputs, including CSS `url()` assets, and
rebuild when either authored path changes.

Tailwind v4 recursively inlines local imports even without a Tailwind directive,
reports inlined and scanned files as dependencies, and reports scanned
directories with extension globs. Its default `base` is `process.cwd()` and
default `optimize` follows `NODE_ENV === "production"`; its default
`transformAssetUrls` rebases assets from inlined files. For reproducible output,
prefer `tailwindcss({ base: import.meta.dirname, optimize: false })`, or
`@import "tailwindcss" source(none)` with explicit `@source` paths. A component
or CSS Module requiring Tailwind context (not emitted CSS) should use
`@reference` rather than `@import`; if the renderer already delivers Tailwind,
the entry's direct Tailwind import is pruned and `@apply` needs `@reference`.
