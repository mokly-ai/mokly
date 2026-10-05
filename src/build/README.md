# Catalogue compilation

Build and Check load consumer definitions, validate their paths and relationships,
render the selected views, and produce deterministic HTML and manifest v8. Serve,
export, publication and local component controls share the same graph and validators.
Final Markdown documents also pass `documents/safety.ts` after logical links and
compatibility transforms. This independent parse5 allowlist rejects unsafe body
markup while preserving the owned template and later delivery instrumentation.

Completed compilations retain private document Markdown bodies for move
similarity. They travel with the accepted generation, never with manifest or
public catalogue JSON. Resource discovery and comparison share the CSS URL
tokenizer in `src/css_references.ts`.

`move_targets.ts` accepts current authored hints for initial link diagnostics.
Later document renders can receive accepted comparison pairs tied to that runtime
generation. A known prior target produces `moved-link-target`; links never follow
it automatically. Build and Check do not infer moves from incomplete output.

Imported CSS follows the [delivery contract](../../docs/protocol/mokly-imported-styles.md).
`load_graph.ts` now collects each configured renderer and entry root's CSS
imports in JavaScript import order, traverses prelude `@import`s, and emits
one deterministic stylesheet per nonempty root. The renderer's complete CSS
closure is pruned before processing entry CSS; separate entries still share
sources independently. CSS Modules use a lazy PostCSS CSS Modules pipeline to
rename local classes, IDs and keyframes by a path-only hash and expose default
and named bindings to JavaScript. The module scoper never re-prints authored
values, imports, URLs, comments or modern syntax; ordinary CSS and modules
reach the same bundle and inventory. Consumer PostCSS still runs first.
`styles/module_scope.ts` handles real `@scope` preludes with temporary sourced
selector rules while hiding every scope-suffixed at-rule from plugin heuristics.
`styles/module_verify.ts` compares restored output with the authored PostCSS
tree and rejects any rewrite beyond documented local names before bundling.
Its selector comparison uses authored offsets for comma and outer spacing;
only a CSS Modules wrapper may move trailing-comma whitespace outward.
Empty `:global()` and `:local()` wrappers fail before the plugins run.
One CSS scanner distinguishes escape-consumed whitespace from combinators
and checks raw selectors and `@scope` preludes for unsafe escapes before
scoping. The comparison applies that scanner to output combinators too;
it reads the shipped selector or `@scope` prelude on the output side but
the cleaned text the plugins processed on the input side. Comments outside
`@scope` groups are ignored; only a comment-separated redundant whitespace
combinator is merged with its neighbor, never two explicit combinators.
An unchanged authored selector or `@scope` prelude that ships byte for byte
passes without this token comparison; changed text still takes the normal path.
Wrapper empty tails and comments follow the plugin output.

CSS Modules mutation checklist:

- Scanner escapes, strings and Unicode spacing: `tests/css_module_css_scan.test.ts`.
- Raw escape guard and meaning-preserving advice: `tests/css_module_escape_regressions.test.ts` and `tests/browser/css_module_escape_advice.spec.ts`.
- Empty tails and exact comment boundaries: `tests/css_module_empty_tail.test.ts`.
- Output combinators after escapes: `tests/css_module_output_combinators.test.ts` and `tests/browser/css_module_escape_fuzz.spec.ts`.
- Wrapper list joins: `tests/css_module_selector_plugin_acceptance.test.ts`.
  Graph and stylesheet metafiles each resolve their physical working directory
  once for path mapping. Root-import diagnostics build edge provenance only
  when an outside-repository CSS file actually fails validation; successful
  graphs do not project every edge through the filesystem.
  CSS `url()` assets become
  byte-preserving files under `mokly-generated/assets/`, and CSS/asset inputs
  join the private source inventory in both full and inventory-only graph loads.
  An optional config-relative PostCSS module runs in a fresh isolated worker
  per graph load so plugin package caches cannot leak into the next compile.
  Unexpected worker errors, clone failures and exits reject every pending and
  later request promptly, including an exit with code zero.
  Each distinct effective stylesheet input runs once before CSS Modules naming;
  both passes share the result. Its local imports join `configSourceFiles` and trigger config
  reloads, while package imports stay unbundled to preserve plugin-native
  bindings. Only the module path, never plugin instances, crosses Serve IPC.
  Reported file dependencies join `sourceFiles`; globbed directory dependencies
  watch matching additions and newly added subdirectories, but not deletions.
  They compile their globs once per report and cache ownership classifications
  during a load; expanded files already reported explicitly are checked once.
  Logical classification also supplies the physical result when the candidate
  and all classification roots have identical physical paths.
  Candidate projections are cached within one collection and reset for the next
  collection, so ownership and public-file checks share filesystem work.
  Inventory-only graph loads run the same plugins
  and collect the same dependencies. Generated output and public mockups files
  cannot enter that inventory; nested imports that a plugin reads from disk
  cannot bypass renderer pruning silently. See the
  [PostCSS contract](../../docs/protocol/mokly-imported-styles-postcss.md) for
  validation precedence and deterministic Tailwind settings.
  PostCSS 8 normalizes plugin instances, uncalled creators, plain functions and
  objects with `postcss` factories; Mokly does not narrow accepted plugin shapes.
  `package_owned_paths.ts` classifies logical and physical paths by generated,
  Review, cache, package-code, denied-directory-name and outside reasons. Exact
  reported files inside denied-name directories remain private and watchable;
  directory scans still prune those trees. Physical paths reported by PostCSS or
  esbuild map back to a symlinked configured root before inventory and guards.
  Fragment render input now lists the
  matching authored stylesheet rule, then generated renderer CSS, then the
  exporting entry's CSS, relative to the fragment route. Pages still render
  without automatic links. `consumer_entry.ts` records the exporting entry
  independently of the helper that defined a screen or component; it never
  changes authored-source attribution or the manifest.
  `pending_generated.ts` holds HTML text, CSS text and opaque asset bytes before
  the transaction writes anything. Full and on-demand rendering validate links,
  component resources and compatibility routes against this pending generation;
  generated CSS URLs resolve against pending assets, never stale files on disk.
  Each on-demand generation scans for orphan routes once and caches parsed CSS
  resources across view requests; request-specific HTML and temporary prop edits
  remain fresh. A new accepted generation creates new validation indexes.
  The reserved directory is already package-owned: Build removes unexpected
  regular files there as orphans, and committed Check reports them. The root
  and descendants cannot be symlinks or special files; Build and committed Check
  reject them before graph inventory or output writes. Build prunes empty reserved
  directories after successful writes, without touching ordinary public files.
  Derived Check rejects every indexed file there and suggests only the directory
  `.gitignore` rule, not redundant per-file rules. Only portable stylesheet and supported asset routes may be
  written beneath it. Leading underscores and hyphens are valid route segments.
  Imported CSS still requires a portable module file path even when an entry
  overrides its identity with `path`; the diagnostic names that module. The exact diagnostics and precedence are in the
  [imported-styles error contract](../../docs/protocol/mokly-imported-styles-errors.md).
  Committed Build and Check ask Git whether each generated route is committable
  when `repoRoot` is the Git work-tree top level. Nested/non-Git fixtures skip
  the check; effective ignore rules and precise negations are reported before
  committed output is written or compared.

## Consumer Graph

`config/entry_discovery.ts` walks configured roots once per compilation. Each
matched file has one root owner; overlapping root directories are allowed when
their matched file sets are disjoint. The result includes executable modules,
matched Markdown inputs, and directory folder records. `documents/load.ts` parses
file definitions and their confined resources before registry preparation. These
inputs remain protected and watched. Candidate discovery
returns a new inventory and cannot mutate an accepted runtime after a failed build.

`load_graph.ts` bundles executable modules, their imported helpers, the renderer,
and the optional document transformer in one consumer React graph. React and React
DOM resolve from consumer package roots, including npx installations. The graph
stays in memory and retains its complete private source inventory.

`consumer_entry.ts` collects branded default and named exports, one array level,
and component registrations. Aliases of one object within a module register once;
exporting the same object from two entry modules is an error. Definitions retain
attribution to the module that created them, while identity always derives from
the discovered module that exports them. Source attribution drives ownership and
Changes evidence; it never changes the path or default slug.

Authoring metadata crosses the consumer-bundle boundary through `Symbol.for`
markers in `authoring/markers.ts`. Registry preparation derives paths, resolves
variant parents and link bases, validates both folder carriers, and snapshots
component schemas and saved data before rendering. Unknown component variant
fields are reported after the parent's final path is known.
Walks skip `review.outDir`, `mockupsDir/mokly-generated/`, and denied directory trees. Directories that vanish
or are replaced mid-walk (`ENOENT` or `ENOTDIR`) are skipped and listed with
denied paths in zero-match diagnostics. Other read or projection errors fail
with `config-invalid`, naming the repository-relative path and error code
(`unknown` if absent). A matched module that is deleted, or replaced by
something other than a regular file, between the directory listing and
validation is dropped and listed under `not searched` when its glob is then
empty. A projection or lstat failure with any code other than `ENOENT` fails
with `config-invalid`.

Normal config loading rejects `.mokly-cache/` glob roots. Direct discovery also
denies surviving cache candidates; because existence validation comes first, a
candidate that vanishes concurrently is dropped rather than denied. Every
resolved module is rejected when it sits inside `review.outDir`,
`.mokly-cache/`, beneath a denied directory relative to its glob root, or
escapes `repoRoot` through a symlink. Entries nested below `mockupsDir` remain
protected inventoried source; public reads and generated route collisions use
the same lexical and alias-aware source boundaries.
`load_graph.ts` then bundles those modules, imported helpers,
the renderer and any compatibility transformer together and refreshes the
resolved set on the config as `entryModules`. `styles/collect.ts` replaces
esbuild's discarded sibling CSS output with class bindings and records graph
imports. `styles/order.ts` walks metafile imports, while `metafile_paths.ts`
maps esbuild's physical working directory back to symlinked consumer roots.
`styles/prelude.ts` scans
valid CSS import preludes, `styles/preprocess.ts` owns the memoized post-pruning
transform seam, `styles/modules.ts` scopes local identities, `styles/bundle.ts`
orchestrates the renderer pass and one multi-entry pass for all entries;
`styles/bundle_pass.ts` owns esbuild and per-root input attribution, and
`styles/resolution.ts` validates URLs, imports and confined assets, rejecting
public stylesheet and asset aliases before they enter private inventory.
`styles/outputs.ts` strips esbuild path comments
and deduplicates shared assets by raw bytes.
`load_graph.ts` retains the delivered CSS-pass inputs and URL asset paths
separately from the full source inventory (which also includes transformer-only
CSS and non-delivered plugin candidates). `Compilation.deliveredStyleSources`
passes this repository-relative set to Changes; the retained runtime carries it
through child and background worker transfer without adding manifest fields.
`styles/transformer_inventory.ts` inventories CSS reachable only from the
compatibility transformer, including nested imports and local URL assets,
without bundling a stylesheet or evaluating consumer JavaScript. It skips
already delivered CSS and package CSS and recovers legacy syntax. React
`styles/root_graph.ts` validates direct CSS imports before a virtual
stylesheet pass, including extensionless imports, `require()` and dynamic
imports. `config/package_code.ts` excludes physically installed package code
while retaining in-repository workspace CSS/asset aliases. React and React DOM
resolve from consumer package roots, including when Mokly runs
from an npx installation. The bundle stays in memory and retains the
consumer's existing rendering/provider graph.
`styles/lightning.ts` loads Lightning CSS's native CommonJS binding only for
read-only transformer inventory; CSS Modules load their own PostCSS plugins
only when a module is imported, not during CLI module import.
The preprocessor caches by local imports actually excluded in each file,
allowing both graph and CSS passes to share unaffected transformations. The
output cleaner drops esbuild's source-path comments and their separator lines
and retains exactly one final newline.

The retained Serve runtime also carries the compiled CSS and binary assets
and the root-to-stylesheet route map. Accepted-graph recompilation reuses
these outputs without rerunning the stylesheet pass; watched-child IPC
transfers the binary bytes without treating them as UTF-8 text.

`Compilation.outputs` keeps rendered HTML and the manifest as strings while
also accepting opaque `Uint8Array` generated files. `generated_file.ts` is the
shared boundary for raw bytes, byte counts, disk comparison, guarded text
reads, and JSON-safe process transfer. The writer stages raw bytes and Check
compares raw bytes; Review, derived export, and Serve's controls previews
preserve them without UTF-8 round trips. The compiler now emits CSS as text
and generated image/font assets as opaque bytes, alongside textual documents.

Automatic JSX uses esbuild's development-location arguments through the private
`jsx_dev_runtime.ts` shim, forwarding to the consumer's normal JSX runtime. Only
registered component wrappers receive source metadata; it never enters rendered
attributes, material keys or instance keys. The default local instance name is the
last segment of the component's resolved path, including for index components.

## Documents and links

Every entry owns `<path>/index.html` as its logical route. Pages and documents
write that file; documents also write `index.dark.html` when dark is enabled;
screens and component variants write `index.<viewport>[.dark].html` beside it.
Flow and component parent documents are assembled by the shell.

`mock_links.ts` resolves complete paths, relative paths and definition references,
then writes portable relative links and complete-path Browse markers. Ordinary
entries resolve relative references from their parent folder; index entries use
their own folder; variants use their parent's base. The same rule resolves flow
steps and memberships. `logicalRoutes` supplied to a transformer is keyed by
complete entry path. Fragments, ownership markers, control metadata and all
referenced HTML/CSS/resources are validated again after transformation.

`output_snapshot.ts` validates output routes, ownership and realpaths under a
short writer-lock hold. Build captures it after rendering; live Serve captures
it during generation preparation. The retained private runtime supplies this
proof to demand, Props and background workers, so they never scan partial output
or hold a writer lock while running consumer code. Each real write still checks
the current tree under its own lock. Export snapshot waits accept cancellation.

`output_collisions.ts` checks the portable file namespace, including case-folded
public-file versus generated-directory collisions. Proven generated orphans do
not block moves. Demand compilation caches this inventory within its generation.
`transaction.ts` holds the repository writer lock across nested-directory pruning,
installation and rollback, while preserving overwrite and source guards;
it removes only output whose ownership is still proven by a resolved file,
inventoried source or matching configured root glob. Unclaimed files stay untouched.

Serve-mode live-index preparation captures repository-owned bytes inside this
Node graph's load callbacks, records each repository resolution under a stable
request identity, and seals both only after the index is accepted. Stylesheet
load callbacks record their accepted JavaScript instead of raw CSS: exact CSS
Module exports or an empty plain module. Installed-package importers also
record requests to saved stylesheet modules and captured repository-owned
files, with an `installed` identity and
a safe logical repository-relative path. Both graph builds preserve symlinks
and share the same confined path normalization, including pnpm aliases.
Installed JavaScript stays unpinned. Linked workspace targets and repository
file symlinks follow the same physical source-inventory rule. Installed records
are sealed only for modules the capture loader saved. CSS symlinks retain
separate logical identities for their path-derived class names. The Live
browser compiler in `../interactive/bundle.ts` replays that record before
filesystem resolution, uses the captured bytes and accepted `entryModules`,
and does not rediscover entries or reread a repository module. It reuses the
attributed API, module-resolution settings, loaders, and consumer React peer
lookup. Its package-owned ESM entry omits
compatibility transforms and the static renderer default, captures no
Node-based JSX source location, and reads only an optional renderer
`interactive` export. Node built-ins fail that graph with
`interactive-bundle`; the ordinary Node build graph remains unchanged. Build,
Check, Export, Publish, and off-mode Serve do not install the source-capture
hook or call the browser compiler.

Browser-only installed importers and importers outside `repoRoot` have no
recorded requests. Their existing fallback can load a saved stylesheet blob
after normal resolution; an absent blob fails with `source-not-captured`.
Unrecorded package-name requests can fail resolution after target deletion.
Imported-style processing rejects stylesheets outside the root. An `empty`
opt-out can accept an extensionless outside stylesheet, but Live still lacks
its blob and fails. Installed JavaScript and
metadata remain unpinned. Unrecorded requests that resolve to repository source
fail with the typed diagnostic, even when a blob exists through another
importer. This includes installed modules only the browser build selects and
outside-root importers. Live caches directory entries and symlink projections
for these ownership checks; it needs no per-module installed-file realpath.
`../interactive/source_load_filter.ts` supplies the Go filter that excludes
ordinary installed modules but admits every captured alias and symlink subtree.
Its per-build link scan covers nested file links and unknown browser-only inputs.
Windows and metadata failures use conservative checks. See
the [source-pinning contract](../../docs/protocol/mokly-interactive-source-pinning.md)
for the exact importer, IPC and unrecorded-request boundaries.

The retained `ComponentRuntime` records resolved per-entry Live eligibility
separately from the publishable manifest. Runtime compaction and watched-child
IPC carry that map so controls, demand rendering, and later interactive services
cannot turn an authored `interactive: false` back on.

## Development

```sh
npm run build
node --import tsx --test tests/path_*.test.ts tests/entry_exports.test.ts
npm run example:build
npm run example:check
cargo xtask check
```

- `compile.ts`, `render.ts`, `document_compiler.ts`: exhaustive and requested-view
  compilation with shared validation.
- `load_graph.ts`, `consumer_entry.ts`, `consumer_resolution.ts`: consumer graph,
  exports, browser projection and dependency resolution.
- `source_inventory.ts`, `ownership.ts`, `previous_ownership.ts`, `output_paths.ts`: source protection and
  transactional output boundaries. `output_directories.ts` prunes empty ancestors
  after backup and restores directory changes on rollback. Directories retained
  by the new output stay in place so replacements do not create watch events.
- `authored_links.ts`, `mock_links.ts`, `logical_records.ts`: link identity,
  portable rewriting and transformation invariants.
- `pending_generated.ts`, `html_links.ts`, `styles/links.ts`: generation-local
  resource lookup and relative encoded stylesheet delivery for every view.
- `jsx_dev_runtime.ts`, `component_source.ts`: invocation capture without output
  or input-identity changes.
- `interactive_source_capture.ts`: accepted Serve-generation repository bytes
  and their logical/physical paths.
- `interactive_source_paths.ts`: shared logical stylesheet and installed-importer
  identities for Node capture and browser replay.
- `interactive_source_resolution.ts`: normalized, bounded source request
  identities shared by capture, browser replay, and watched IPC.
- `transaction.ts`, `check.ts`: safe output installation and verification.
- `output_lock.ts`, `output_lock_file.ts`: the repository writer lock that
  serializes every generated-output transaction across processes. Callers that
  must read the tree they wrote use `withOutputLock` with
  `writeLockedCompilation`; waiters reclaim only provably stopped holders.
  Release removes only the lock file and keeps `.mokly-cache/locks/`, so it
  never races another writer that is creating its lock there.

See [paths](../../docs/protocol/mokly-paths.md),
[entry modules](../../docs/protocol/mokly-entry-modules.md),
[artifact paths](../../docs/protocol/mokly-artifact-paths.md), and the
[build pipeline](../../docs/architecture/build-pipeline.md).

`ownership.ts` accepts only the current canonical-base64 Mokly header with LF
or CRLF. Plain Mokly and all Mokabook headers grant no ownership to replacement,
orphan cleanup, Check, frame adaptation or indexed-output checks. Earlier output
must be removed manually; ordinary authored HTML is not claimed by its comment.

Helper-backed moves retain ownership only for exact artifact paths in a validated
previous v8 manifest whose source inventory includes this configuration. The
current encoded header must match that entry's source. This permits replacement
and orphan cleanup after helper renames without treating an old source inventory
as blanket ownership. Missing, malformed, earlier or foreign manifests grant no
additional ownership. Current source and public-exclusion denials still win.

The retained graph and consumer bundle carry parsed Markdown definitions. The
existing non-HTML `styleOutputs` inventory also carries copied document assets;
worker replay uses these accepted bytes without rereading source files. Copied
resource ownership comes from exact routes in the previous validated manifest.

Document inputs join the graph input set before the CSS pass. A nested source
root can share an image between Markdown and imported CSS without making an
unrelated public asset private. Both aliases retain source protection.
