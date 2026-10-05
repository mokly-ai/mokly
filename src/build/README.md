# Catalogue Compilation

This internal module loads consumer definitions, renders every configured view,
validates the complete catalogue and produces deterministic HTML and manifest v8.
The supported external interface is `mokly build` and `mokly check`; Serve,
export and local prop controls reuse the same consumer graph and validators.

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
  component resources and generated routes against this pending generation;
  generated CSS URLs resolve against pending assets, never stale files on disk.
  Each on-demand generation caches parsed CSS resources across view requests;
  HTML and temporary prop edits remain fresh. A new generation has new indexes.
  Build replaces the entire generated tree, including old CSS/assets. Tracked
  Check reports missing, stale and extra files; untracked Check validates the
  compilation without disk inspection. Only Check reads the index. Build,
  build --watch and serve --build hold the repository writer lock through the
  whole-tree transaction. Plain Serve, export and publication read memory.
  Existing generated trees cannot contain symlinks or special files at a writer
  or tracked-check boundary. No command checks Git-ignore committability.

## Consumer Graph

`config/entry_discovery.ts` resolves the configured `entries` globs, or the
`entriesDir` shorthand, into one sorted set of matched modules when the
configuration loads and again here at the start of each compilation. The glob
defines the entry shape with no suffix filter; `entriesDir` expands to the
recommended `<dir>/**/*.mockup.{ts,tsx}` convention.

Before walking, discovery projects the repository and every distinct glob root
once per pass. A shared-root failure is therefore reported before any per-glob
module denial, even when the failed root belongs to a later glob. Review output
is projected once with a lexical fallback. Walks then run in declared glob
order. They validate a candidate when it is first encountered, while an
accepted candidate still counts for each overlapping glob. A denied candidate
under an earlier glob precedes a later zero-match failure; reversing those globs
reverses that diagnostic precedence. Each glob must retain a module so another
valid glob cannot hide a typo or omission.

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

Automatic JSX uses esbuild's `jsxDev` location arguments. `consumer_resolution.ts`
resolves `react/jsx-dev-runtime` to a private shim exporting the consumer's
`Fragment` and a `jsxDEV` function. The shim forwards to the consumer's
`react/jsx-runtime` `jsx` or `jsxs`, preserving the supplied key and static/dynamic
children. No import of React's `react/jsx-dev-runtime` reaches the consumer
bundle, and the generated markup stays unchanged.

Only `defineComponent` wrappers receive invocation metadata. `component_source.ts`
resolves bundler filenames relative to the configuration directory, checks both
lexical and symlink confinement to `repoRoot`, and emits repository-relative
POSIX paths with positive, 1-based line and column. Absolute bundler filenames
inside the root are converted to relative paths; serialized absolute paths,
escapes, backslashes and invalid coordinates are rejected. Missing invocation
information is omitted. Ordinary components and intrinsic elements receive no
added prop. The wrapper strips the reserved `__moklySource` field before calling
consumer code; the collector retains it only as optional manifest metadata.

`consumer_entry.ts` attributes definitions to their owning modules and exposes
the public authoring API, including `resolveInstance`. Every repository-owned
importer of `@mokly/mokly` receives the attributed facade; installed packages
under `node_modules` and Mokly's own runtime receive the plain API. Registry
checks run outside the consumer bundle, so CLI-read authoring markers use
`Symbol.for` in `src/authoring/markers.ts` instead of private `Symbol()` or class
identity; both variant forbidden-field metadata and nested authored-path facts
must survive the boundary. `MoklyError` carries a `Symbol.for` brand and
`isMoklyError` checks that brand, a known code, and the unprefixed detail. The
facade adds the source module; `load_graph.ts` reconstructs branded errors as
CLI `MoklyError`s without double prefixes. Unrelated evaluation failures remain
bundling errors. `src/registry/manifest_validation.ts` applies the strict v8
baseline boundary before comparison. `mock_links.ts` rewrites id links while
`mock_link_routes.ts` resolves the identity-derived target artifact and relative
destination. `document_links.ts` adapts child controls and resolves portable
links for full builds and on-demand documents. A use case without a screen
as its first step is an invalid registry invariant. Registry
validation accepts attributed sources only from resolved entries or the source
inventory. The plain first-line marker is not an ownership proof. The v8
manifest inventories every generated file and exact byte hash; only its
`mokly-generated/` tree is replaceable. Authored closure assets remain in place.

## Development

```sh
npm run build
node --import tsx --test --test-concurrency=2 tests/component_*.test.ts
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

- `compile.ts`, `render.ts`, `document_compiler.ts`: exhaustive and requested-view
  compilation using the same validation boundary.
- `load_graph.ts`, `consumer_entry.ts`, `consumer_resolution.ts`: one consumer
  graph, discovered through `config/entry_discovery.ts`, and its module
  resolution.
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

See the [build pipeline](../../docs/architecture/build-pipeline.md),
[instance contract](../../docs/protocol/mokly-instances.md),
[manifest schema](../../docs/protocol/mokly-component-manifest.md), and
[component guide](../components/README.md).

The implemented [public closure contract](../../docs/protocol/mokly-public-closure.md)
uses one policy instance per compile for configured stylesheets, renderer seeds
and transitive links. The [post-render edit contract](../../docs/protocol/mokly-comparison-inventory.md#post-render-offset-mapping)
maps style ownership through exact text patches rather than style positions.

`config/public_policy.ts` caches authored-file decisions for one compilation;
`config/public_denial.ts` shares lexical/current privacy with export. The
`html_links.ts` closure builder returns checked membership and watch evidence;
`public_resource.ts` parses only authorized HTML/CSS, and `resource_seeds.ts`
retains the route that declares each renderer resource. Requested documents
carry those seeds through the existing preview observation.
