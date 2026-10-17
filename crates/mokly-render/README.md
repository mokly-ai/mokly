# mokly-render

`mokly-render` connects the optional Node sidecar to Mokly's Rust catalogue,
CSS pipeline, and document graph. Depend on its `Runtime` factories for a
JavaScript or mixed catalogue. HTML composition stays in `mokly-html`.

## Responsibilities

- Bundle discovered JavaScript and install CSS Modules before evaluation.
- Supply typed definitions to the catalogue's Rust schema validator.
- Install the resolved handle table before rendering.
- Convert authenticated markers and logical usage drafts into core fragments.
- Share the bounded fragment cache across composed documents.
- Process consumer PostCSS in an explicit source and dependency context.
- Keep base extraction and dependency leases with the rendering services.

## What This Crate Does

`Runtime` implements `DefinitionProvider` and `GraphFactory`. The CLI injects
its source readers, sidecar pool, worker scheduler, and byte-bounded render
cache. Construction starts no sidecar. Description is serialized across clones of one
runtime. Each attempt has fresh source and dependency snapshots. An HTML-only catalogue with no renderer has
no bundle, class-map exchange, description, or render request. A configured
renderer is bundled and inventoried even without JavaScript entries. Consumer PostCSS can run
without a JavaScript bundle.

Catalogue preparation resolves paths, variants, controls, schemas, props,
slots, and component elements in Rust. The adapter retains handles separately
from defining-module attribution. A stories file supplies one component with
an inferred schema and story variants. Its `argTypes` supply control hints.
Non-data inference warnings use the final entry path. Props diagnostics carry
their detail separately from the module-and-export location, so Rust prints
one location before the diagnostic code. PostCSS requests carry logical
stylesheet paths; the worker resolves their physical input on the chosen side.
Each PostCSS context uses an owned child process in that side's source root.
Relative reads and automatic Tailwind scans therefore use the historical
extraction for a base render. Its `NODE_PATH` contains the selected dependency
directories before inherited values for package resolvers that read `NODE_PATH`. Disposal kills and reaps only that context.

The graph installs every definition binding and uses `MemoFragments` for
screens, components, stories, and pages. Its fingerprint includes the bundle,
binding table, and class maps. Requests add effective entry identity, handle,
props, saved slots, view axes, and ignore scope. HTML slot content stays in the
core and enters authenticated placeholders with their reported scope. A private
adapter-output placement keeps renderer wrappers outside a component's root.
The graph's `render_props` method serves temporary previews through this path.
It validates complete props and control bounds before rendering and leaves saved
documents intact. Returned instance props pass the Rust schema validator.
Serve supplies one source snapshot to catalogue parsing and graph preparation.
Bundle reuse compares the actual module digests that the sidecar reports.
HTML edits reuse bundle definitions. CSS text changes reuse JavaScript when
class maps remain equal. A changed map uses a separate evaluated lifetime.
Graph leases retain old maps, bindings, and PostCSS contexts until the final
request releases them. Final drops enqueue epoch-specific pool release and
cache cleanup without waiting for worker requests or the PostCSS cache lock.
Failed candidates release their own contexts. Bundle metadata stamps include
resolved React manifests, ancestor package and tsconfig candidates, absent
Storybook previews, and file membership in consumed-module directories.
The pool restores compatible code before evaluation-only bundles across slots
and recycling. Metadata invalidation still recomputes class maps before reusing
an equivalent generation.
Stylesheet reuse checks source digests, plugin dependency digests, and
directory-glob membership. Empty directory recipes observe later additions.
Shared and generation-local stylesheet result caches each have a 64 MiB bound.
Their records share storage. Oversized results return without cache retention.
Each graph factory captures source and dependency reads in a fresh snapshot.
Evicted stylesheet resources rebuild from that generation's captured bytes.

`BaseSide` takes the source lease and the complete dependency selection from
`mokly-compare`. Bundle requests use that extraction, its selected dependencies,
and all repository mappings. Configuration ancestor dependency directories
retain Node's lookup order on each side, for JavaScript and CSS. The runtime
records the directories actually used by head JavaScript, CSS, and PostCSS
package loads for base fallback checks. Repository-relative importer directories,
including package-manager links into a root store, map through the selected
dependency repository. Only directories outside that mapping need lookup fallback. Nested dependency
JavaScript and CSS keep the same logical paths on both sides. Compiled recipes
retain that usage across worker restoration and evaluation reuse. Selected
logical roots take precedence over source-root names in nested CSS exclusion
checks.
Tracked base files beneath `node_modules` supply their Git bytes and keep
their dependency classification. Installation lookup metadata uses private
names so tracked directories cannot hide installed package membership.
Each sidecar worker keeps one source working directory. Head and base module
evaluation and render callbacks use their own files through `process.cwd()`.
Both sides forward identical trusted style records into the composed tree
and comparison.
Both sides use the current package version and
the same document composition code.

## Quick Start

Build the packages before real-process tests:

```bash
npm run build
cargo test -p mokly-render
```

Inject one `Arc<Runtime>` as both `Builder.definitions` and
`CatalogueBuild.graphs`. Consume each factory through its trait. The binary
owns pool shutdown. Serve uses the same factories for initial preparation,
manual rebuilds, and authenticated temporary prop renders.

## Development

```bash
cargo test -p mokly-render
cargo clippy -p mokly-render --all-targets -- -D warnings
```

Unit tests mock runtime boundaries with unimock. Integration tests copy the
fixture consumer to an isolated directory and start the real sidecar. They
check call order and outputs without elapsed-time assertions. The JavaScript
rebuild test retains both generations on one pool. It renders an uncached old
view after the edit and counts real process starts and hello calls.

### Key Code

- [Runtime factories](./src/runtime.rs) and [base inputs](./src/side.rs).
- [Bundle order](./src/bundle.rs) and [definition conversion](./src/definition_input.rs).
- [Graph composition](./src/graph.rs) and [fragment records](./src/fragments.rs).
- [PostCSS](./src/postcss.rs) and [dependency inventory](./src/postcss_inventory.rs).

### Related Docs

- [Sidecar protocol](../../docs/protocol/mokly-sidecar.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
