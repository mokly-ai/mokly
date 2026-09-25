# Catalogue Compilation

This internal module loads consumer definitions, renders every configured view,
validates the complete catalogue and produces deterministic HTML and manifest v5.
The supported external interface is `mokly build` and `mokly check`; Serve,
export and local prop controls reuse the same consumer graph and validators.

Imported CSS follows the [delivery contract](../../docs/protocol/mokly-imported-styles.md).
`load_graph.ts` now collects each configured renderer and entry root's CSS
imports in JavaScript import order, traverses prelude `@import`s, and emits
one deterministic stylesheet per nonempty root. The renderer's complete CSS
closure is pruned before processing entry CSS; separate entries still share
sources independently. CSS Modules use path-stable Lightning CSS names and
expose default and named bindings to JavaScript. CSS `url()` assets become
byte-preserving files under `mokly-generated/assets/`, and CSS/asset inputs
join the private source inventory in both full and inventory-only graph loads.
An optional config-relative PostCSS module runs in a fresh isolated worker
per graph load so plugin package caches cannot leak into the next compile.
Each distinct effective stylesheet input runs once before CSS Modules naming;
both passes share the result. Its local imports join `configSourceFiles` and trigger config
reloads, while package imports stay unbundled to preserve plugin-native
bindings. Only the module path, never plugin instances, crosses Serve IPC.
Reported file dependencies join `sourceFiles`; globbed directory dependencies
also watch matching additions. Inventory-only graph loads run the same plugins
and collect the same dependencies. Generated output and public mockups files
cannot enter that inventory; nested imports that a plugin reads from disk
cannot bypass renderer pruning silently. See the
[PostCSS contract](../../docs/protocol/mokly-imported-styles-postcss.md) for
validation precedence and deterministic Tailwind settings.
PostCSS 8 normalizes plugin instances, uncalled creators, plain functions and
objects with `postcss` factories; Mokly does not narrow accepted plugin shapes.
`package_owned_paths.ts` classifies logical and physical paths by generated,
Review, cache, denied-directory-name and outside reasons. Exact required
inputs inside denied-name directories remain watchable; output never does.
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
Derived Check rejects every indexed file there and suggests the directory
`.gitignore` rule. Only portable stylesheet and supported asset routes may be
written beneath it. The exact diagnostics and precedence are in the
[imported-styles error contract](../../docs/protocol/mokly-imported-styles-errors.md).

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
and React DOM resolve from consumer package roots, including when Mokly runs
from an npx installation. The bundle stays in memory and retains the
consumer's existing rendering/provider graph.
`styles/lightning.ts` loads Lightning CSS's native CommonJS binding only on
the first CSS transformation, not during CLI module import.
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
validation and `ownership.ts` accept an attributed owner only when it is a
resolved entry module or an inventoried source file. Ownership headers and
tracked output additionally trust repository-relative owners that match an
entry glob, so deleted matched sources still leave removable orphans. A
repository-root glob trusts every matching path and no other path through this
branch. Committed Check lists Mokly-headered HTML outside the resolved,
inventoried, and glob-matched sets as unclaimed without changing it.
Export and Review boundaries continue to use directories that hold resolved
entry modules. Source locations do not enter instance keys, props keys, slot
identities, or Changes projections.

## Development

```sh
npm run build
node --import tsx --test --test-concurrency=2 tests/component_*.test.ts
npm run example:build
npm run example:check
cargo xtask check
```

The example uses derived output: generation writes local ignored HTML and a
manifest; authored public CSS remains tracked. Committed output and historical
manifest compatibility are tested with isolated consumers.

- `compile.ts`, `render.ts`, `document_compiler.ts`: exhaustive and requested-view
  compilation using the same validation boundary.
- `load_graph.ts`, `consumer_entry.ts`, `consumer_resolution.ts`: one consumer
  graph, discovered through `config/entry_discovery.ts`, and its module
  resolution.
- `pending_generated.ts`, `html_links.ts`, `styles/links.ts`: generation-local
  resource lookup and relative encoded stylesheet delivery for every view.
- `jsx_dev_runtime.ts`, `component_source.ts`: invocation capture without output
  or input-identity changes.
- `source_inventory.ts`: complete private authoring inventory, separate from
  individual invocation metadata.
- `transaction.ts`, `check.ts`: safe output installation and verification.

See the [build pipeline](../../docs/architecture/build-pipeline.md),
[instance contract](../../docs/protocol/mokly-instances.md),
[manifest schema](../../docs/protocol/mokly-component-manifest.md), and
[component guide](../components/README.md).
