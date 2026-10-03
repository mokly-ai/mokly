# Catalogue compilation

Build and Check load consumer definitions, validate their paths and relationships,
render the selected views, and produce deterministic HTML and manifest v8. Serve,
export, publication and local component controls share the same graph and validators.

## Consumer graph

`config/entry_discovery.ts` walks configured roots once per compilation. Each
matched file has one root owner; overlapping root directories are allowed when
their matched file sets are disjoint. The result includes executable modules,
matched Markdown inputs, and directory folder records. Markdown inputs remain
protected and watched until document rendering is implemented. Candidate discovery
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

Automatic JSX uses esbuild's development-location arguments through the private
`jsx_dev_runtime.ts` shim, forwarding to the consumer's normal JSX runtime. Only
registered component wrappers receive source metadata; it never enters rendered
attributes, material keys or instance keys. The default local instance name is the
last segment of the component's resolved path, including for index components.

## Documents and links

Every entry owns `<path>/index.html` as its logical route. Pages write that file;
screens and component variants write `index.<viewport>[.dark].html` beside it.
Flow and component parent documents are assembled by the shell.

`mock_links.ts` resolves complete paths, relative paths and definition references,
then writes portable relative links and complete-path Browse markers. Ordinary
entries resolve relative references from their parent folder; index entries use
their own folder; variants use their parent's base. The same rule resolves flow
steps and memberships. `logicalRoutes` supplied to a transformer is keyed by
complete entry path. Fragments, ownership markers, control metadata and all
referenced HTML/CSS/resources are validated again after transformation.

`output_collisions.ts` checks the portable file namespace, including case-folded
public-file versus generated-directory collisions. Proven generated orphans do
not block moves. Demand compilation caches this inventory within its generation. `transaction.ts` preserves overwrite, rollback and source guards;
it removes only output whose ownership is still proven by a resolved file,
inventoried source or matching configured root glob. Unclaimed files stay untouched.

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
  exports and dependency resolution.
- `source_inventory.ts`, `ownership.ts`, `previous_ownership.ts`, `output_paths.ts`: source protection and
  transactional output boundaries. `output_directories.ts` prunes empty ancestors
  after backup and restores directory changes on rollback. Directories retained
  by the new output stay in place so replacements do not create watch events.
- `authored_links.ts`, `mock_links.ts`, `logical_records.ts`: link identity,
  portable rewriting and transformation invariants.

See [paths](../../docs/protocol/mokly-paths.md),
[entry modules](../../docs/protocol/mokly-entry-modules.md),
[artifact paths](../../docs/protocol/mokly-artifact-paths.md), and the
[build pipeline](../../docs/architecture/build-pipeline.md).

Helper-backed moves retain ownership only for exact artifact paths in a validated
previous v8 manifest whose source inventory includes this configuration. The
current encoded header must match that entry's source. This permits replacement
and orphan cleanup after helper renames without treating an old source inventory
as blanket ownership. Missing, malformed, earlier or foreign manifests grant no
additional ownership. Current source and public-exclusion denials still win.
