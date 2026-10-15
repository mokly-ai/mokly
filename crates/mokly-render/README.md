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
cache. Construction starts no sidecar. An HTML-only catalogue with no renderer has
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
extraction for a base render. Disposal kills and reaps only that context.

The graph installs every definition binding and uses `MemoFragments` for
screens, components, stories, and pages. Its fingerprint includes the bundle,
binding table, and class maps. Requests add effective entry identity, handle,
props, saved slots, view axes, and ignore scope. HTML slot content stays in the
core and enters authenticated placeholders with their reported scope. A private
adapter-output placement keeps renderer wrappers outside a component's root.
The graph's `render_props` method serves temporary previews through this path.
It validates complete props and control bounds before rendering and leaves saved
documents intact. Returned instance props pass the Rust schema validator.
Each graph factory captures source and dependency reads in a fresh snapshot.
Evicted stylesheet resources rebuild from that generation's captured bytes.

`BaseSide` takes the source lease and the complete dependency selection from
`mokly-compare`. Bundle requests use that extraction, its selected dependencies,
and all repository mappings. Both sides use the current package version and
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
check call order and outputs without elapsed-time assertions.

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
