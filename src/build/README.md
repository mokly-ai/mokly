# Catalogue Compilation

This internal module loads consumer definitions, renders every configured view,
validates the complete catalogue and produces deterministic HTML and manifest v6.
The supported external interface is `mokly build` and `mokly check`; Serve,
export and local prop controls reuse the same consumer graph and validators.

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

Walks skip `review.outDir` and denied directory trees. Directories that vanish
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
resolved set on the config as `entryModules`. React
and React DOM resolve from consumer package roots, including when Mokly runs
from an npx installation. The bundle stays in memory and retains the
consumer's existing rendering/provider graph.

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

Registry preparation validates component-declared public CSS, deduplicates
same-real-file declarations, and reuses configured links for declared CSS.
`render.ts` keeps the shared-list marker position outside `RenderInput`, while
`components/render.tsx` inserts links beside the
renderer-emitted configured links and derives their resource owners. Config
bundles use the same namespaced `Symbol.for` marker as consumer bundles.
The renderer-facing component entry omits `stylesheets`; the internal
registration still supplies declarations for linking and ownership.
`RenderInput.stylesheets` remains the configured href list. Watched Serve
attaches its inventory watcher before evaluation, then validates registration
and extends the watch set with declared CSS before index preparation.
Component stylesheet links use the nearest present configured link, or the end
of head content when none exists. A transient marker survives a compatibility
transform on retained inserted links; Mokly removes it before writing output
and records private final-document spans for comparison projection.
`stylesheet_provenance.ts` prunes derived owners after compatibility output;
renderer owner records ignored for declared CSS are retained as structured
`BuildWarning` values on exhaustive compilations and requested documents.
Terminal reporting of those values belongs to the next warning milestone.

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
- `jsx_dev_runtime.ts`, `component_source.ts`: invocation capture without output
  or input-identity changes.
- `source_inventory.ts`: complete private authoring inventory, separate from
  individual invocation metadata.
- `transaction.ts`, `check.ts`: safe output installation and verification.

See the [build pipeline](../../docs/architecture/build-pipeline.md),
[instance contract](../../docs/protocol/mokly-instances.md),
[manifest schema](../../docs/protocol/mokly-component-manifest.md), and
[component guide](../components/README.md).
