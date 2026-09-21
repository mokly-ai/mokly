# Catalogue Compilation

This internal module loads consumer definitions, renders every configured view,
validates the complete catalogue and produces deterministic HTML and manifest v5.
The supported external interface is `mokly build` and `mokly check`; Serve,
export and local prop controls reuse the same consumer graph and validators.

## Consumer Graph

`config/entry_discovery.ts` resolves the configured `entries` globs, or the
`entriesDir` shorthand, into one sorted set of matched modules when the
configuration loads and again here at the start of each compilation. The glob
defines the entry shape with no suffix filter; `entriesDir` expands to the
recommended `<dir>/**/*.mockup.{ts,tsx}` convention. Each glob must match at
least one entry module. Walks skip `review.outDir`, denied directory trees, and
directories whose identity or contents cannot be read; zero-match diagnostics
list only denied roots that were not searched. Every resolved module is rejected
when it sits inside `review.outDir`, `.mokly-cache/`, beneath a denied directory
relative to its glob root, or escapes `repoRoot` through a symlink.
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
