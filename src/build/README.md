# Catalogue compilation

## Delivery Status

Removal of baseline compatibility below is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Root output boundaries, independent stylesheet provenance and warnings for all
CSS resource-owner records below are implemented in Milestone 19 of the
[source-path removal plan](../../plans/remove-source-path-evidence.md).

Configured-only placement and shared link discovery are implemented in M28.
Generation-scoped Serve warnings and removal of the unread
`ComponentRuntime.warnings` field and its writers are implemented in M29.
The [warning contract](../../docs/protocol/mokly-build-warnings.md#watched-serve-generations)
defines producer tagging, child messages and completion without replay.

## Scope

Build and Check load consumer definitions, validate their paths and relationships,
render the selected views, and produce deterministic HTML and manifest v9. Serve,
export, publication and local component controls share the same graph and validators.
Final Markdown documents also pass `documents/safety.ts` after logical links and
final HTML composition. This independent parse5 allowlist rejects unsafe body
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
`styles/postcss_calls.ts` is the only module that uses PostCSS's parser and
processor. Its calls always pass `map: false`, so a `sourceMappingURL` comment
never loads a map or moves a diagnostic position. In every other `src/` file,
ESLint rejects value imports of `postcss`'s default export, `parse`,
`Processor`, `Input` and `fromJSON`, deep `postcss/` value imports, and
dynamic loads of `postcss`.
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

- Ignored source-map comments: `tests/build_module_source_maps.test.ts`,
  `tests/build_postcss_source_maps.test.ts` and `tests/postcss_calls.test.ts`.
  The lint guard: `tests/eslint_postcss_calls.test.ts`.
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
  Fragment render input follows the complete list and order in the
  [renderer stylesheet contract](../../docs/protocol/mokly-rendering.md#renderer-stylesheets).
  Pages still render without automatic links. `consumer_entry.ts` records the exporting entry
  independently of the helper that defined a screen or component; it never
  changes authored-source attribution or the manifest.
  `pending_generated.ts` holds HTML text, CSS text and opaque asset bytes before
  the transaction writes anything. Full and on-demand rendering validate links,
  component resources and generated routes against this pending generation;
  generated CSS URLs resolve against pending assets, never stale files on disk.
  Each on-demand generation caches parsed CSS resources across view requests;
  HTML and temporary prop edits remain fresh. A new generation has new indexes.
  Build replaces the entire generated tree, including old CSS/assets. Tracked
  Check reports missing, stale and extra files; untracked Check validates the
  compilation without disk inspection. Check reads the index. CLI Publish reads
  committed generated paths and compares their bytes with compilation. Build,
  build --watch and serve --build hold the repository writer lock through the
  whole-tree transaction. Plain Serve, export and publication read memory.
  Existing generated trees cannot contain symlinks or special files at a writer
  or tracked-check boundary. CLI Publish requires ignored derived generated
  output and a clean checkout under the upload contract.
  Imported CSS requires a portable module path even when an entry overrides
  its identity with `path`; the diagnostic names that module under the
  [imported-styles error contract](../../docs/protocol/mokly-imported-styles-errors.md).

`renderer_resources.ts` validates each asserted public file before it ignores
CSS owner records. Generated CSS uses its pending canonical route as its stable
warning identity. Authored CSS uses its validated public-file identity.
The shared public-file policy rejects symlink components before this filter.
This filter runs before the empty-component-registry check. Saved roots have
an explicit output boundary. Temporary rendered declarations feed final link
provenance directly; usage `resources` contains only non-CSS ownership. CSS
records retain their public paths in the private `ResourceSeed` channel, even
without links. Full compilation, requested views, nested generated targets and
Props capture carry those seeds into the shared closure. Watch and Serve retain
the resulting authored CSS and transitive files. No CSS owner or inserted-link
span is fabricated. Private authored declarations keep the existing component
resource error with the shared policy cause, before any ignored-owner warning.

## Consumer Graph

`config/entry_discovery.ts` walks configured roots once per compilation. Each
matched file has one root owner; overlapping root directories are allowed when
their matched file sets are disjoint. The result includes executable modules,
matched Markdown inputs, and directory folder records. `documents/load.ts` parses
file definitions and their confined resources before registry preparation. These
inputs remain protected and watched. Candidate discovery
returns a new inventory and cannot mutate an accepted runtime after a failed build.

`load_graph.ts` bundles executable modules, their imported helpers and the renderer
in one consumer React graph. React and React
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
and the renderer together and refreshes the
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
separately from the full source inventory, which also includes non-delivered
PostCSS candidates. `Compilation.deliveredStyleSources` passes this
repository-relative set to Changes; the retained runtime carries it through
child and background worker transfer without adding manifest fields.
`styles/root_graph.ts` validates direct CSS imports before a virtual
stylesheet pass, including extensionless imports, `require()` and dynamic
imports. `config/package_code.ts` excludes physically installed package code
while retaining in-repository workspace CSS/asset aliases. React and React DOM
resolve from consumer package roots, including when Mokly runs
from an npx installation. The bundle stays in memory and retains the
consumer's existing rendering/provider graph.
Changes loads Lightning CSS for read-only rule analysis. CSS Modules load their
own PostCSS plugins only when a module is imported, not during CLI module import.
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
compares raw bytes; Review, export, and Serve's controls previews
preserve them without UTF-8 round trips. The compiler now emits CSS as text
and generated image/font assets as opaque bytes, alongside textual documents.

Automatic JSX uses esbuild's development-location arguments through the private
`jsx_dev_runtime.ts` shim, forwarding to the consumer's normal JSX runtime. Only
registered component wrappers receive source metadata; it never enters rendered
attributes, material keys or instance keys. The default local instance name is the
last segment of the component's resolved path, including for index components.

## Documents and links

`consumer_entry.ts` attributes definitions to their owning modules and exposes
the public authoring API, including `resolveInstance`. Every repository-owned
importer of `@mokly/mokly` receives the attributed facade; installed packages
under `node_modules` and Mokly's own runtime receive the plain API. Registry
checks run outside the consumer bundle, so CLI-read authoring markers use
`Symbol.for` in `src/authoring/markers.ts` instead of private `Symbol()` or class
identity; both variant forbidden-field metadata and branded definition identities
must survive the boundary. `MoklyError` carries a `Symbol.for` brand and
`isMoklyError` checks that brand, a known code, and the unprefixed detail. The
facade adds the source module; `load_graph.ts` reconstructs branded errors as
CLI `MoklyError`s without double prefixes. Unrelated evaluation failures remain
bundling errors. `src/registry/manifest_validation.ts` validates current and
baseline data against one strict v9 shape. Only the canonical generated
manifest decides selection. Earlier output at that location, or root-level
earlier output produced by the base's own recipe, uses the unavailable outcome
without conversion or caching.

Every entry owns `<path>/index.html` as its logical route. Pages and documents
write that file; documents also write `index.dark.html` when dark is enabled;
screens and component variants write `index.<viewport>[.dark].html` beside it.
Flow and component parent documents are assembled by the shell.

`mock_links.ts` resolves complete paths, relative paths and definition references,
then writes portable relative links and complete-path Browse markers. Ordinary
entries use their parent folder; index entries use their own folder; variants
use their parent's base. Flow references share this rule. Final validation
checks fragments, control metadata and referenced HTML/CSS/resources.

`output_snapshot.ts` copies, validates and freezes each accepted generation's
route set in memory. Demand, Props and background workers reuse this proof and
reject undeclared routes. Capture never reads output or takes its write lock.
`output_collisions.ts` checks the candidate portable file namespace, including
case-folded and file-directory collisions. `transaction.ts` holds the writer
lock for complete generated-tree replacement and rollback. Only Build,
`build --watch` and `serve --build` write; all other consumers use memory.

Registry preparation validates component-declared public CSS, deduplicates
same-real-file declarations, and reuses configured links for declared CSS.
`render.ts` keeps configured hrefs and the shared-list marker position outside
`RenderInput`, while
`components/render.tsx` inserts links beside the
renderer-emitted configured links and records inserted-link provenance. Config
bundles use the same namespaced `Symbol.for` marker as consumer bundles.
The renderer-facing component entry omits `stylesheets`; the internal
registration still supplies declarations for linking and provenance.
The [renderer stylesheet contract](../../docs/protocol/mokly-rendering.md#renderer-stylesheets)
owns the complete `RenderInput.stylesheets` list and its order. Watched Serve
attaches its inventory watcher before evaluation, then validates registration
and extends the watch set with declared CSS before index preparation.
Component stylesheet links use the nearest present configured link, or the end
of head content when none exists, after generated imported CSS and other head
content. The renderer still receives its complete stylesheet list. Build and
on-demand Serve use this same placement input.
Mokly records private final-document full-link spans after ordinary link edits
for comparison projection. The linking pass emits no transient token.
`stylesheet_provenance.ts` keeps final inserted-link spans and declaring paths
without deriving resource owners. Ignored renderer records for any stylesheet
produce the same `BuildDiagnostic` records as configuration, registry and
link-control validation. `Compilation.diagnostics` and requested-document
`diagnostics` retain the normalized list. `build_warnings.ts` owns validation,
sorting, formatting and strict failures; `warnings.ts` owns ignored-input
producers. Non-page warnings name a typed subject instead of a route.
`warning_sink.ts` collects one invocation or watched attempt, deduplicates
streamed and completed records, and discards older envelopes. Serve flushes
before `Catalogue ready` or failure. Runtimes retain their attempt identity.
Strict commands count every producer before any output write.

## Build Warnings

`build_warnings.ts` owns the validated code, route or subject, and single-line message
record plus deterministic sorting and de-duplication. The child-control adapter
and direct document-link resolver return diagnostics beside their output;
`compile.ts` puts the normalized list on `Compilation`, while
`document_compiler.ts` retains the requested document's list without reporting
it. During exhaustive compilation, each adapter also forwards its diagnostics
through the compilation callback before logical-link rewriting and later
resource validation. Later failures therefore retain all warnings already found.
Successful results stay sorted, and the sink reports each warning once.
Diagnostics never enter generated files, the manifest, HTTP bytes, or
timing records. Authored C0/C1 controls become visible `\uXXXX` escapes before
normalization, and reporters defensively apply the same encoder.
`link_control_tiers.ts` owns the explicit ancestor and
descendant tier sets, feature precedence, and one-line element descriptions
used by both errors and warnings. See the
[build warnings contract](../../docs/protocol/mokly-build-warnings.md).

## Development

```sh
npm run build
node --import tsx --test tests/path_*.test.ts tests/entry_exports.test.ts
npm run example:build
npm run example:check
cargo xtask check
```

The example ignores generated HTML and the manifest under
`examples/basic/mokly-generated/`; authored CSS at the catalogue root remains tracked.
Historical commits with a complete, matching manifest inventory use Git
blobs; missing or stale output is rebuilt. Export and plain Serve compile in
memory without writing local output; `build --watch` and `serve --build` write
only after successful complete compilations.

- `compile.ts`, `build_warnings.ts`, `render.ts`, `document_compiler.ts`:
  exhaustive and requested-view compilation with shared validation.
- `link_control_tiers.ts`, `link_control_nodes.ts`, `link_controls.ts`: tiered
  placement validation and source-byte-preserving styled-control adaptation.
- `document_types.ts`: requested-document types. `document_components.ts`
  finalizes and validates transformed view metadata.
- `../config/stylesheet_rules.ts`: configured stylesheet validation and the
  component marker position.
- `load_graph.ts`, `consumer_entry.ts`, `consumer_resolution.ts`: one consumer
  graph, discovered through `config/entry_discovery.ts`, and its module resolution.
- `source_inventory.ts`, `output_paths.ts`, `output_snapshot.ts`: source protection and
  accepted in-memory route boundaries. `transaction_tree.ts` stages and replaces
  the complete generated tree and restores its backup if installation fails.
- `authored_links.ts`, `mock_links.ts`, `logical_records.ts`: link identity,
  portable rewriting and transformation invariants.
- `pending_generated.ts`, `html_links.ts`, `styles/links.ts`: generation-local
  resource lookup and relative encoded stylesheet delivery for every view.
- `jsx_dev_runtime.ts`, `component_source.ts`: invocation capture without output
  or input-identity changes.
- `mock_links.ts`, `mock_link_routes.ts`, `logical_records.ts`:
  identity-derived link rewriting, target resolution and final link validation.
- `source_inventory.ts`: complete private authoring inventory, separate from
  individual invocation metadata.
- `transaction.ts`, `check.ts`: safe output installation and verification.
- `output_lock.ts`, `output_lock_file.ts`: the repository writer lock that
  serializes every generated-output transaction across processes. The writer
  holds the lock through validation, replacement and cleanup; waiters reclaim
  only provably stopped holders. Nonwriting callers use accepted memory.
  Release removes only the lock file and keeps `.mokly-cache/locks/`, so it
  never races another writer that is creating its lock there. Before each
  acquisition, `config/cache_ignore.ts` creates `.mokly-cache/` and, unless it
  is a symbolic link, its `.gitignore` when they are missing, so Git ignores the
  cache.

See the [build pipeline](../../docs/architecture/build-pipeline.md),
[instance contract](../../docs/protocol/mokly-instances.md),
[manifest schema](../../docs/protocol/mokly-component-manifest.md), and
[component guide](../components/README.md).

The implemented [public closure contract](../../docs/protocol/mokly-public-closure.md)
uses one policy instance per compile for configured stylesheets, renderer seeds
and transitive links. The approved [post-render edit target](../../docs/protocol/mokly-comparison-inventory.md#post-render-offset-mapping)
will replace positional style rebinding with exact text-patch offset mapping.

`config/public_policy.ts` caches authored-file decisions for one compilation;
`config/public_denial.ts` shares lexical/current privacy with export. The
`html_links.ts` closure builder returns checked membership and watch evidence;
`public_resource.ts` parses only authorized HTML/CSS, and `resource_seeds.ts`
retains the route that declares each renderer resource. Requested documents
carry those seeds through the existing preview observation.

The approved [path/output integration](../../docs/protocol/mokly-path-output-integration.md) keeps path identity, folders,
Markdown documents and moves inside one generated tree. It introduces manifest
v9, catalogue v5 and review v6, with explicit versions for the other boundaries.
Accepted workers use immutable in-memory route sets; only writing commands
acquire the output lock. The integration plan records verification and scope.

The retained graph and consumer bundle carry parsed Markdown definitions. The
existing non-HTML `styleOutputs` inventory also carries copied document assets;
worker replay uses these accepted bytes without rereading source files. Copied resources join the exact generated inventory.

Document inputs join the graph input set before the CSS pass. A nested source
root can share an image between Markdown and imported CSS without making an
unrelated public asset private. Both aliases retain source protection.
