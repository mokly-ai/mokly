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
The adapter preserves control and prop declaration order for the entry detail.
Non-data inference warnings use the final entry path. Props diagnostics carry
their detail separately from the module-and-export location, so Rust prints
one location before the diagnostic code. PostCSS requests carry logical
stylesheet paths; the worker resolves their physical input on the chosen side.
Each PostCSS context uses an owned child process in that side's source root.
Runtime allocates context ids from one process-wide sequence.
A per-context request lock keeps the sidecar requests of one context one at a
time, and equal inputs make one request. The shared PostCSS cache lock covers
only lookups, inserts, and the dependency inventory. Round trips and read
inventories therefore never wait for each other, and the stylesheet roots of
one preparation overlap that work. A failed input keeps its diagnostic for the
rest of its context. A timeout or a crash after its retry also fails every
request of the context that already waits for its turn. The cache keeps a running byte charge, so
an insert charges one record instead of recounting the cache.
Mokly's own CSS transforms stay in the Rust core.
Relative reads and automatic Tailwind scans therefore use the historical
extraction for a base render. Its `NODE_PATH` contains the selected dependency
directories before inherited values for package resolvers that read `NODE_PATH`. Disposal kills and reaps only that context.

The graph installs every definition binding and uses `MemoFragments` for
screens, components, stories, and pages. A fragment key uses the render input
key of the handle's entry module: its module closure, the renderer or
Storybook preview closure, the class maps, bindings, and resolution files of
that closure, and the bundle environment. The bundle fingerprint of the
generation, binding table, and class maps stays the fallback for an unknown
module and an input of the live generation. Requests add effective entry
identity, handle, props, saved slots, view axes, and ignore scope. HTML slot content stays in the
core and enters authenticated placeholders with their reported scope. A private
adapter-output placement keeps renderer wrappers outside a component's root.
The graph's `render_props` method serves temporary previews through this path.
It validates complete props and control bounds before rendering and leaves saved
documents intact. Returned instance props pass the Rust schema validator.
Serve supplies one source snapshot to catalogue parsing and graph preparation.
Bundle reuse compares the actual module digests that the sidecar reports.
The private JavaScript generation exposes those digests so static builds can
verify their captured inputs against the bundled bytes.
HTML edits reuse bundle definitions. CSS text changes reuse JavaScript when
class maps remain equal. A changed map uses a separate evaluated lifetime.
Graph leases retain old maps, bindings, and PostCSS contexts until the final
request releases them. Final drops enqueue epoch-specific pool release and
cache cleanup without waiting for worker requests or the PostCSS cache lock.
Failed candidates release their own contexts. Bundle metadata stamps include
resolved React manifests, ancestor package and tsconfig candidates, absent
Storybook previews, and file membership in consumed-module directories.
The pool restores compatible code before evaluation-only bundles across slots
and recycling. It gives each loaded lifetime an epoch. A stale process replays
maps, describe, and bindings before rendering. Metadata invalidation still recomputes class maps before reusing
an equivalent generation.
Stylesheet reuse checks source digests, opaque asset digests and resolved
identities, plugin dependency digests, and directory-glob membership. Empty directory recipes observe later additions.
PostCSS read evidence retains observed whole-file and byte-range digests for
one generation beside late baselines. Cache hits replay the validated result
that belongs to their generation.
Both cache layers replay the original evidence to static admission. Selected
module inputs remain separate from plugin privacy and catalogue membership.
Base witnesses compare with pinned Git bytes through the shared admission
observer. They never enter the head path ledger.
Conflicting versions cannot seed cross-generation stylesheet reuse.
Range digests never replace the whole-file cache stamp. Range admission checks
one stream per path and keeps the original observations through cache hits.
File-object stamps invalidate same-byte replacements. Base identity checks
retain the extracted-file identity beside the pinned Git content proof.
Shared and generation-local stylesheet result caches each have a 64 MiB bound.
Their records share storage. Oversized results return without cache retention.
Each graph factory captures source and dependency reads in a fresh snapshot.
Evicted stylesheet text rebuilds from that generation's captured parsed inputs.
Opaque asset records contain metadata only. Delivery verifies a source stream
against the generation's digest; assets never enter the stylesheet byte cache.
Asset streams use the same selected dependency reader as CSS compilation,
including configured package roots and historical installations. Authored
public-resource reads retain their separate source confinement checks.
Secondary package roots retain their virtual dependency parent even when the
primary installation is absent. CSS and asset confinement can traverse these
logical paths without requiring an unused root `node_modules` directory.
Module stylesheet discovery uses an explicit stack and retains import order
when it crosses shared dependencies or cycles.
Definitions from the same module share one stylesheet root. A generation-wide
reachability index excludes module branches that cannot contribute CSS.

`BaseSide` takes the shared source lease and the complete dependency selection
from `mokly-compare`. The base source reader holds the same lease. Bundle
requests use that extraction, its selected dependencies,
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
Core fragment spans include JavaScript calls and their transport and queue
waits. Sidecar render spans measure work inside each process.
Both sides forward identical trusted style records into the composed tree
and comparison.
Both sides use the current package version and
the same document composition code.

The fragment adapter transfers typed registry rule ownership to HTML assembly
without splitting the delivered CSS text or changing its style-block grouping.

## Quick Start

The composition root builds one `Runtime` and consumes it through both
factory traits:

```rust
use std::sync::Arc;

use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_graph::cache::MemoryCache;
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::RenderWorkers;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

fn services(
    tree: Arc<dyn SourceTree>,
    pool: Arc<dyn SidecarPool>,
    workers: Arc<dyn RenderWorkers>,
    version: String,
) -> (Arc<dyn DefinitionProvider>, Arc<dyn GraphFactory>) {
    let runtime = Arc::new(Runtime::new(
        tree.clone(),
        tree,
        pool,
        Arc::new(MemoryCache::new(256 * 1024 * 1024)),
        workers,
        version,
        None,
    ));
    (runtime.clone(), runtime)
}
```

Inject the runtime as both `Builder.definitions` and the CLI's
`CatalogueBuild.graphs`. The binary owns pool shutdown. Serve uses the same
factories for initial preparation, manual rebuilds, and authenticated
temporary prop renders. Build the packages before the real-process tests:

```bash
npm run build
cargo test -p mokly-render
```

## Development

```bash
cargo clippy -p mokly-render --all-targets -- -D warnings
```

Unit tests mock runtime boundaries with unimock. Integration tests copy the
fixture consumer to an isolated directory and start the real sidecar. They
check call order and outputs without elapsed-time assertions. The JavaScript
rebuild test retains both generations on one pool. It renders an uncached old
view after the edit and counts real process starts and hello calls.

### Key Code

- [`src/runtime.rs`](./src/runtime.rs) defines `Runtime`, which implements
  `DefinitionProvider` and `GraphFactory` over the injected source readers,
  sidecar pool, workers, and render cache.
- [`src/side.rs`](./src/side.rs) defines `BaseSide`, the leased base
  extraction and dependency selection of a historical render.
- [`src/dependency_usage.rs`](./src/dependency_usage.rs) defines
  `DependencyUsage`, which records the dependency directories that renders
  read.
- [`src/error.rs`](./src/error.rs) defines `RenderError`, which keeps the
  source of each subsystem failure.
- [`src/graph.rs`](./src/graph.rs) resolves bindings before both sides use the
  same composition path.
- [`src/bundle.rs`](./src/bundle.rs) bundles only changed JavaScript and
  isolates class maps across retained graphs.
- [`src/postcss.rs`](./src/postcss.rs) runs consumer PostCSS in an explicit
  side-specific context before scoping.

### Related Docs

- [Sidecar protocol](../../docs/protocol/mokly-sidecar.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [PostCSS contexts and evidence](../../docs/protocol/mokly-sidecar-postcss.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
