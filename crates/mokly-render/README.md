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
its source readers, physical input reader, sidecar pool, worker scheduler, and
byte-bounded render cache. Construction starts no sidecar. Description is serialized across clones of one
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
one location before the diagnostic code. Bundle requests name the renderer by
`ResolvedConfig::renderer`, the resolved repository-relative path under which
the module graph names it. Render input keys and stylesheet roots use the same
renderer path. PostCSS requests carry logical stylesheet paths; the worker
resolves their physical input on the chosen side. Each PostCSS request names
the PostCSS module by `ResolvedConfig::postcss`, in the same form as the
renderer. Each PostCSS context uses an owned child process in that side's
source root. Runtime allocates context ids from one process-wide sequence.
A per-context request lock keeps the sidecar requests of one context one at a
time, and equal inputs make one request. The shared PostCSS cache lock covers
only lookups, inserts, and the dependency inventory. Round trips and read
inventories therefore never wait for each other, and the stylesheet roots of
one preparation overlap that work. A failed input keeps its diagnostic for the
rest of its context. A timeout or a crash after its retry also fails every
request of the context that already waits for its turn. The cache keeps a running byte charge, so
an insert charges one record instead of recounting the cache. A context
projects and hashes each of its modules once, and its later results reuse
those late digests.
Mokly's own CSS transforms stay in the Rust core.
Relative reads and automatic Tailwind scans therefore use the historical
extraction for a base render. Its `NODE_PATH` contains the selected dependency
directories before inherited values for package resolvers that read `NODE_PATH`. Disposal kills and reaps only that context.

The graph installs every definition binding and uses `MemoFragments` for
screens, components, stories, and pages. A fragment key uses the render input
key of the handle's entry module: its module closure, the renderer or
Storybook preview closure, the class maps, bindings, and resolution files of
that closure, and the bundle environment. The bundle environment names each
path below the working repository root by its POSIX path relative to that
root, and the root itself as `.`. It names each path below the cache namespace
of a `BaseSide` as `cache:` and the path below that namespace. Two checkouts of
one commit with equal installations therefore get equal render input keys. Any
other absolute path stays unchanged, and a `tracing` warning lists it. The
bundle fingerprint of the
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
Bundle reuse also reads the captured reuse evidence of the compiled recipe
again through the injected `PhysicalInputs` reader, outside the side tree. A
read error rejects reuse, also for a recorded absence. Incomplete evidence
never permits reuse, with one exception in the Serve edit capture mode: a
retained state with a toolchain identity whose evidence holds the
`uncaptured` marker is reused while its module digests and metadata stamps
stay current. Its evidence can also hold the private folder files of the
[package folder reuse rules](../../docs/protocol/mokly-sidecar-folder-reuse.md).
The same reader checks them again, and one change rejects the reuse. A
captured state is tried before a marked one.
Each core `bundle` request runs in a `catalogue.bundle` span, which records the
`cache` outcome that the pool sets on the result. The request carries the
`capture` mode of the runtime: `full` by default, and `serveEdit` for each
Serve head preparation after the first published state. A `BundleLease` owns
the lifetime epoch of each result from its return. When the core serves a
retained evaluated state without a `bundle` request in the `full` mode, it
sends the pool the served-generation notice with the id and the epoch of that
state. The pool can then store that compilation in the bundle cache. Only that
direct return of a retained state sends the notice. The `serveEdit` mode sends
no notice. The head runtime of Serve also keeps the plan records of the
[Serve edit plan rules](../../docs/protocol/mokly-sidecar-plans.md). It keeps
a record from a `full` result, and it sends the plan of a current record with
each `serveEdit` request.
The pool restores compatible code before evaluation-only bundles across slots
and recycling. It gives each loaded lifetime an epoch. A stale process replays
maps, describe, and bindings before rendering. Metadata invalidation still recomputes class maps before reusing
an equivalent generation.
Stylesheet reuse checks source digests, opaque asset digests and resolved
identities, plugin dependency digests, directory-glob membership, and the
captured results of its compilation. Empty directory recipes observe later
additions.
Each stylesheet root compiles through its own recording tree, resolver, and
compiler, so roots that compile in parallel never share captured results.
Class-map preparation compiles cold plain-CSS roots in bounded parallel chunks
when both stylesheet stores are empty and no head store is live. It needs at
least two distinct roots and two available workers. The worker
bound is the available parallelism, four, or the root count, whichever is
smallest. Other cases use serial preparation. Maps, records, observations,
watch inputs, and dependency usage follow root order. A failed chunk can finish
up to three later roots, but their dependency usage and records are discarded.
The recording tree keeps each read, digest, unretained digest, and projection
of the core CSS compiler, its resolver, and the nested-import check of
PostCSS. A read keeps the digest of the returned bytes, so a `package.json`
read covers every field of that file. A projection keeps the returned node. A
read or a projection that finds nothing keeps that absence. Projections
include resolver candidates that find no file, each path part that the
confinement walk checks, and the alias check of each source and asset. The
stamp checks each captured result again before reuse. A changed package entry
or an earlier candidate that appears therefore prevents reuse. Delivery
replays the captured read results beside the PostCSS read evidence. The
capture adds digests and nodes, not file bytes. The store charges them under
its existing bound.
Serve watches each captured path as an exact input, including resolution
files and absent candidates, within the
[watch denial rules](../../docs/protocol/mokly-watch.md#denial-rules). An
edit to only a package's `style` or `exports` entry therefore starts a
rebuild, which compiles each affected stylesheet again. A record keeps these
paths as logical paths. Physical watch mapping is off by default.
`Runtime::with_stylesheet_watching` turns it on for a runtime without a
`BaseSide`, and Serve calls it for its working side. In that runtime, each
delivery, also a cache hit, maps the logical paths to their current lexical,
physical, and canonical paths. Each dependency candidate also carries the
folder that admits it: the selected dependency root, or the first
`node_modules` directory of its repository path. Mapping keeps a candidate
only inside the repository or inside that folder. A failed projection or
physical lookup skips only its candidate. A cancellation still fails the
delivery. Every other runtime, such as one for a static build or a base
preparation, maps no watch paths.
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
Each record keeps the read evidence of its own inputs. The module evidence of
a PostCSS context is kept once. When a later result of the context carries
more module evidence, its entry links to the earlier entry and keeps only the
added versions. Each entry has its own stamp and is charged once. An attempt
checks the stamp of each entry once and replays its observations once.
When the shared store removes records under its bound, or keeps a record in
its attempt because its evidence disagreed, it keeps the key and the reason.
The `css.bundle` span of the next bundle for that key records the reason.
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

A stylesheet record key holds the stylesheet root, the configuration input,
the resolved modules, and the module resolution settings. It holds the
physical paths of the selected dependency roots and of the repository roots
of its side. It also holds the effective CSS resolver settings, which the
resolver of the side uses: the configuration directory, aliases, dependency
aliases, conditions, main fields, logical dependency roots, and extensions. A
PostCSS record comes from a configuration with a PostCSS module. Its key also
holds the physical source root of its side, so only a preparation on that
root can reuse it. A plain CSS record comes from a configuration without a
PostCSS module. Its key omits that root. Its stamp names each read, candidate
probe, and absence that selected its inputs by logical path.

`Runtime::for_base` gives each base runtime its own stylesheet store and a
weak read-only reference to the stylesheet store of the original head
runtime. An original head lends its store whether or not it maps watch
paths. A base runtime that `for_base` makes from another base runtime keeps
that reference, also when it is empty or expired, so a base never reads the
store of another base. A runtime that `Runtime::new` builds with a
`BaseSide` has an empty reference, so it finds no head candidate. The
reference does not keep the head store alive. A base lookup checks its
attempt-local store, the shared store of the base runtime, and then the head
store. The base keeps no index of head records. A head candidate must pass
the same stamp and context-entry checks as a candidate of the base store, in
the base side tree. Delivery then replays its observations into the base
tree in the same way as for a record of the base. A hit keeps the same
immutable `Arc<Record>` in the attempt-local store, so it shares the storage
of the head record. That store charges the record under its own bound. The
shared store of the base runtime keeps only the records that the base
compiles. The base never writes to the head store, so it never inserts,
evicts, or rejects a record there. Its misses and rejections stay in its own
stores. When the head store is gone, the base finds no head candidate. A
base never finds a head PostCSS record, because the key of each base PostCSS
record holds the source root of the base extraction. It keeps its own
PostCSS contexts, processes, and bundle states. A hit makes no `css.bundle`
span. Each real bundle keeps its span. A candidate that fails its checks,
from either store, gives the miss reason `stamp-mismatch`. A miss without a
candidate reports the reason that the shared store of the base runtime keeps
for the key.

`BaseSide` takes the shared source lease and the complete dependency selection
from `mokly-compare`. The base source reader holds the same lease. Bundle
requests use that extraction, its selected dependencies,
and all repository mappings. `BaseSide` also carries `working_root`, the
working repository root, so both sides name their paths from the same root. Its
optional `cache_namespace` is the repository's directory in the base cache,
which holds the base leases. A caller with base files outside that cache passes
`None`, and those paths enter the keys as absolute paths.
Configuration ancestor dependency directories
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

The composition root builds one `Runtime` with the shared render cache and
consumes it through both factory traits. See the
[`mokly-graph` construction example](../mokly-graph/README.md#quick-start)
to create the cache:

```rust
use std::sync::Arc;

use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_graph::cache::RenderCache;
use mokly_graph::types::GraphFactory;
use mokly_graph::workers::RenderWorkers;
use mokly_render::physical_inputs::SystemPhysicalInputs;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

fn services(
    tree: Arc<dyn SourceTree>,
    pool: Arc<dyn SidecarPool>,
    cache: Arc<dyn RenderCache>,
    workers: Arc<dyn RenderWorkers>,
    version: String,
) -> (Arc<dyn DefinitionProvider>, Arc<dyn GraphFactory>) {
    let runtime = Arc::new(Runtime::new(
        tree.clone(),
        tree,
        Arc::new(SystemPhysicalInputs),
        pool,
        cache,
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
  physical input reader, sidecar pool, workers, and render cache. Its
  `bundle_capture` field holds the `BundleCapture` of each core `bundle`
  request: `Full` by default, and `ServeEdit` when Serve prepares its head
  after the first published state. `Runtime::with_serve_edit_plans` gives
  the head runtime of Serve its plan record owner. A base runtime never gets
  one. `Runtime::with_stylesheet_watching` turns on physical stylesheet watch
  mapping for a runtime without a `BaseSide`. Serve calls it for its working
  side. `Runtime::for_base` builds the runtime of one base preparation, which
  shares the services and the style memo of the head runtime. It starts its
  own stores and keeps watch mapping off. The `head_styles` field marks the
  origin. It is `None` in an original head. In a base, it holds a weak
  read-only reference to the stylesheet store of the original head, also
  when that reference is empty or expired.
  `Runtime::with_document_store` gives the Serve runtime its render store, and
  `Runtime::for_base` copies it, so the head and base graphs share one store.
- [`src/persistent_identity.rs`](./src/persistent_identity.rs) gives the
  JavaScript part of a render store identity: the toolchain identity and the
  metadata identity of a compilation with captured and durable reuse evidence,
  or none.
- [`src/edit_plans.rs`](./src/edit_plans.rs) defines `Records`, the plan
  record owner of a Serve head, and `Record`, which pairs a `ResolutionPlan`
  with the `ReuseEvidence` of its compilation. `Records::insert` keeps only
  captured and durable evidence, replaces the record of equal settings, and
  removes the oldest records to keep the serialized total within
  `RECORD_BYTES`. A record that it cannot keep leaves the older record in
  place.
- [`src/physical_inputs.rs`](./src/physical_inputs.rs) defines
  `PhysicalInputs`, the reader that checks the captured reuse evidence of a
  compiled recipe outside the side tree, and `SystemPhysicalInputs`, its
  filesystem implementation. Its `current` check rejects marked evidence. It
  does not read the `durable` flag of the evidence.
- [`src/side.rs`](./src/side.rs) defines `BaseSide`, the leased base
  extraction and dependency selection of a historical render.
- [`src/dependency_usage.rs`](./src/dependency_usage.rs) defines
  `DependencyUsage`, which records the dependency directories that renders
  read.
- [`src/error.rs`](./src/error.rs) defines `RenderError`, which keeps the
  source of each subsystem failure.
- [`src/graph.rs`](./src/graph.rs) resolves bindings before both sides use the
  same composition path. It gives the `Fragments` of each side that side's own
  source root, so a base graph records nothing as head, also with an equal
  generation id.
- [`src/fragments.rs`](./src/fragments.rs) defines `Fragments`, the fragment
  adapter over the pool. Its `record_served` passes a store-served request to
  `SidecarPool::record_served_render`.
  [`src/render_call.rs`](./src/render_call.rs) builds the wire call once, for a
  render and for a record.
- [`src/bundle.rs`](./src/bundle.rs) bundles only changed JavaScript and
  isolates class maps across retained graphs. It sends the served-generation
  notice only at its direct return of a retained state. Its `BundleState`
  shares the reuse evidence of the actual result through an `Arc` and keeps
  its toolchain identity. It tries retained states with captured evidence
  first, and it admits a marked state only in the `ServeEdit` mode.
- [`src/bundle_attempt.rs`](./src/bundle_attempt.rs) sends each core `bundle`
  request with the `capture` mode of the runtime in its `catalogue.bundle`
  span, gives each result's lifetime epoch to a `BundleLease`, and sends the
  served-generation notice after a core reuse, only in the `Full` mode.
  Before a `ServeEdit` request of a head runtime, it sends the plan of a
  record whose evidence `physical_inputs::current` accepts. It offers each
  `Full` result with a plan and a toolchain identity to `Records`.
- [`src/render_environment.rs`](./src/render_environment.rs) derives the inputs
  that every render input key of one side shares, and names their paths
  without the checkout folder.
- [`src/transport_values.rs`](./src/transport_values.rs) maps typed sidecar
  props, controls, owners, and source coordinates into catalogue records.
- [`src/postcss.rs`](./src/postcss.rs) runs consumer PostCSS in an explicit
  side-specific context before scoping.
- [`src/stylesheets.rs`](./src/stylesheets.rs) builds the stylesheet compiler
  of one side and the key of its records, and lists the stylesheet roots of a
  module graph. It passes the head store reference of the runtime to
  `CachedStylesheets::with_head`. Only a base runtime has one.
- [`src/stylesheet_cache.rs`](./src/stylesheet_cache.rs) defines
  `CachedStylesheets`, which serves one attempt's stylesheet bundles from its
  attempt-local store, the shared store of its runtime, and, in a base
  runtime, the head store that `CachedStylesheets::with_head` adds as the
  last read-only source. It times each real bundle as `css.bundle` with its
  miss reason.
- [`src/stylesheet_store.rs`](./src/stylesheet_store.rs) defines
  `StylesheetCache`, the byte-bounded store of records, shared context
  entries, and miss reasons.
- [`src/stylesheet_class_maps.rs`](./src/stylesheet_class_maps.rs) defines
  `ClassMapCompiler`, the bounded preparation boundary for class-map roots.
  It keeps serial preparation for warm stores, live head stores, and PostCSS.
- [`src/stylesheet_commit.rs`](./src/stylesheet_commit.rs) gives serial and
  parallel preparation one record insertion and delivery path.
- [`src/stylesheet_usage.rs`](./src/stylesheet_usage.rs) defines
  `BufferedUsage`, which retains raw dependency calls until their root's
  serial position, including the partial calls of a failing root.
- [`src/stylesheet_compiler.rs`](./src/stylesheet_compiler.rs) defines
  `RootCompiler`, which compiles one stylesheet root, and `CapturingCompiler`.
  For each root, `CapturingCompiler` makes a new recording tree, resolver, and
  compiler, and returns a `Compilation`: the bundle and its `Capture`. With
  PostCSS, it uses `PostCss::for_root`, whose nested-import check reads
  through that root's tree and resolver. The root still shares the PostCSS
  state of its attempt.
- [`src/stylesheet_capture.rs`](./src/stylesheet_capture.rs) defines
  `RecordingTree`, the source tree of one compilation, which keeps each read
  digest and projection. It also defines `Capture`, the stamp entries and the
  read evidence that the tree returns.
- [`src/stylesheet_watch.rs`](./src/stylesheet_watch.rs) maps the logical
  paths that a record captured to the exact lexical, physical, and canonical
  paths that Serve watches on the current side. It returns `WatchInputs`,
  which also holds the admitting folder of each dependency candidate.
  `SideInputs::watch_candidates` lists the candidates of one path, and
  [`watch_candidate::optional`](./src/watch_candidate.rs) ignores a failed
  projection, but it still returns a cancellation. Each delivery, also a
  cache hit, reaches it through `CapturingCompiler::watch_files`. Without
  watch mapping, that method returns no paths.
- [`src/input_stamp.rs`](./src/input_stamp.rs) defines `InputStamp`, the
  recorded input results that `InputStamp::matches` checks again before a
  record is reused.

### Related Docs

- [Sidecar protocol](../../docs/protocol/mokly-sidecar.md).
- [Compiled recipes and reuse](../../docs/protocol/mokly-sidecar-recipes.md).
- [Render store](../../docs/protocol/mokly-render-store.md).
- [Serve edit plans](../../docs/protocol/mokly-sidecar-plans.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [PostCSS contexts and evidence](../../docs/protocol/mokly-sidecar-postcss.md).
- [Stylesheet dependency retention](../../docs/protocol/mokly-imported-styles-postcss.md#dependency-retention).
- [Timing records](../../docs/protocol/mokly-timings.md#core-spans).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
