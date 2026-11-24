# mokly-graph

`mokly-graph` plans and evaluates catalogue renders for Mokly. Depend on it
from Serve, comparison, or static output. It uses `mokly-catalogue` for
prepared definitions, `mokly-html` for composition, and `mokly-css` for
stylesheet delivery. `mokly-render` supplies the JavaScript factories. It
writes no files.

## Responsibilities

- Compute content-addressed node keys before document rendering.
- Copy an earlier render input key when all of its inputs stayed equal.
- Keep rendered artifacts in a byte-bounded LRU process cache, with a compact
  tier for evicted documents.
- Encode documents losslessly for the compact tier, the comparison capture,
  and the render store, and identify their exact codec input.
- Read stored documents after a render cache miss and offer fresh documents
  through an injected render store, without waiting for a write.
- Define the activity and memory boundaries that pause and measure the writer
  of the render store.
- Render all views through an injected worker pool. A Serve background view
  first looks up its document on a render worker, and only a miss returns for
  batch admission.
- Run complete side validation in a bounded window, and hand each view to the
  comparison collector in route order.
- Reconstruct documents and stylesheet resources that left the cache from
  their recipes.
- Validate logical anchors across destination views.
- Compute the referenced authored asset closure with one public policy.
- Prove the inputs of comparison reads with content identities.

## What This Crate Does

`Graph` implements `dyn RenderGraph`. `DeliveryInputs` supplies module CSS
roots, the bundle generation, component stylesheet lists, and exporting
modules from the sidecar adapter. Its `prepare` method reads stylesheet inputs
and computes document plans. The [rendering and documents](./rendering.md)
page holds the guidance for the document plans, the document keys, and the
render input keys. It also holds the guidance for the comparison collection
and the early renders. Its Key Code list also names the entry points of the
head validation. The [stylesheets, assets, and source protection](./delivery.md)
page holds the guidance for the stylesheet roots, the assets, the public file
policy, and the closure validation.

Serve reads each background view through `RenderGeneration::read_background`.
A hit finishes on a render worker, and a miss returns as a `BackgroundMiss`
without a tree. The [render workers and background views](./workers.md) page
holds the guidance for the lookup, the miss, the handoff, and the shared finish.

`MemoryCache` implements `dyn RenderCache`. It keeps rendered artifacts in a
full tier and evicted documents in a lossless compact tier, under one total
byte bound. The [cache and retained comparison](./cache.md) page holds the
guidance for the dependency records, the render cache, and the `DocumentStore`
render store. It also holds the guidance for the link index, the anchor check
result store, the document codec, and the `SourceSnapshot` source snapshots.
It describes the methods `generation_key`, `public_files`,
`comparison_capture`, `comparison_usage`, `retained_comparison_input`,
`retained_document_evidence`, `comparison_identity`, and
`comparison_document_proof`. It also gives the rules for wrappers of the
comparison methods.

`schedule_comparison_tasks` and `schedule_comparison_stream` run indexed
comparison work on the generation's render workers. The
[render workers](./workers.md#comparison-tasks-and-streams) guidance holds
their rules, the `RenderClass` that `ThreadWorkers` carries, and the
[forwards](./workers.md#wrapper-forwards) that wrappers of these methods need.
`RenderKeys::build_with_workers` runs one key job for each exporting module
that gets its own key, through `comparison_tasks` on the shared render workers.
`RenderKeys::build_reusing_with_workers` runs a job only for each such module
whose key it does not copy. Without the `comparison_tasks` forward, the key
calculation runs one module at a time.

## Quick Start

```rust
use std::sync::Arc;
use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::key::{NodeKind, key};

let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(16 * 1024 * 1024, 4 * 1024 * 1024));
let key = key(NodeKind::Document, &[b"entry-source", b"light"]);
cache.insert(key.clone(), Arc::new(Artifact {
    bytes: b"<!doctype html>".to_vec(),
    document: None,
    fragment: None,
    content_type: "text/html; charset=utf-8".into(),
}));
assert!(cache.get(&key).is_some());
```

## Development

```bash
cargo test -p mokly-graph
cargo clippy -p mokly-graph --all-targets -- -D warnings
```

Tests assert operation order and byte charges without clock assertions.
The integration fixture covers HTML template rules, Markdown, stylesheet
imports and assets, portable links, repeated slots, and cache eviction. Tests
exercise comparison capture reuse. The deep-tree test prepares, composes,
serializes, compares, and drops 20,000 levels on an ordinary thread with cache
retention disabled.

### Key Code

The [rendering and documents](./rendering.md#key-code) page and the
[stylesheets, assets, and source protection](./delivery.md#key-code) page
name the entry points of their topics.

- [`src/types.rs`](./src/types.rs) defines `GraphFactory`, `RenderGraph`, and
  `RenderGeneration`, the boundaries that the CLI, Serve, comparison, and
  static output call. `RenderGeneration::read_background` looks up one Serve
  background view, and its default `Ok(None)` declines the lookup.
  `RenderGeneration::uncached_documents` lists routes absent from all cache tiers
  and the prepared render-store index. `RenderGeneration::prefetch_comparison`
  starts their early renders. `RenderGeneration::schedule_capture_window` runs
  the capture window with the limit of `RenderGeneration::capture_parallelism`.
- [`src/graph.rs`](./src/graph.rs) defines `Graph`, which prepares one
  immutable render generation from the injected services.
- [`src/delivery_inputs.rs`](./src/delivery_inputs.rs) defines
  `DeliveryInputs`, the supplied stylesheet and imported asset metadata of a
  generation and the stores that related generations share. `ImportedAsset`
  holds metadata for one opaque asset import.
- [`src/key.rs`](./src/key.rs) provides `key` and `NodeKind`, the
  content-addressed node keys.
- [`src/cache.rs`](./src/cache.rs) defines `RenderCache`, `MemoryCache`,
  `Artifact`, and `CacheStats`, the render cache with its full and compact
  tiers. `RenderCache::contains` checks every tier without a restore.
- [`src/background.rs`](./src/background.rs) defines `BackgroundRead`, a hit
  that its worker finished or a `BackgroundMiss`, the single-use continuation
  of a miss, and `BackgroundWorker`, the lookup that `RenderWorkers::background`
  runs. Its `Completion` is the completion place and dispatch release of a miss
  with a prepared root. `Completion::handoff`, the only way into the completion
  place, receives the byte charge of that root.
- [`src/background_render.rs`](./src/background_render.rs) runs the lookup of
  one Serve background view on the render workers. Its private miss keeps the
  store key, the root eligibility, and the view's span, and no tree.
  `BackgroundMiss::complete` can prepare the own root, hands it off, and
  finishes the view on the render workers without a second lookup. A
  background finish of a view with a viewport keeps the walk record of the
  view. A page or a Markdown document keeps none.
- [`src/fragment_weight.rs`](./src/fragment_weight.rs) computes the capacity
  charge of a prepared root fragment without JSON encoding.
- [`src/document_codec.rs`](./src/document_codec.rs) defines `EncodedView`,
  the lossless compact document that the compact tier and the comparison
  capture share. Its `encode_identified` and `comparison_identity` hash the
  complete codec input. The private `document_identity` and
  `document_metadata` modules hold that hash and the retained metadata.
- [`src/document_store.rs`](./src/document_store.rs) defines `DocumentStore`,
  the optional render store boundary, with `Persistence`, `StoreKey`,
  `ReadOutcome`, `OfferOutcome`, `EntryFault`, and `StoreStats`.
  [`src/session_persistence.rs`](./src/session_persistence.rs) builds the
  `StoreKey` of a route and offers a fresh document after its checks.
  [`src/session_lookup.rs`](./src/session_lookup.rs) holds `Session::raw_lookup`,
  the one counted cache read and store load of every view, and
  `Session::compose_miss`, which composes a miss without a second lookup. The
  shared `Session::finish_artifact` of
  [`src/session_render.rs`](./src/session_render.rs) checks and inserts every
  document and offers each fresh one.
- [`src/write_activity.rs`](./src/write_activity.rs) defines `WriteReadiness`,
  `WriteActivity`, and `WriteLease`, the boundary that pauses the writer while
  Serve is busy.
- [`src/store_memory.rs`](./src/store_memory.rs) defines `StoreMemory`, the
  known buffer capacities and the separate charges of the writer.
- [`src/cache_export.rs`](./src/cache_export.rs) defines `EncodedConsumer` and
  `CacheOperation`, the writer work that `RenderCache::with_encoded` and
  `RenderCache::with_workspace` run inside the transit headroom.
  [`src/export_memory.rs`](./src/export_memory.rs) defines `ExportObserver` and
  `ExportBuffer`, which observe the scratch buffers of an export.
- [`src/document_persistence.rs`](./src/document_persistence.rs) and
  [`src/document_store_metadata.rs`](./src/document_store_metadata.rs) write
  the bounded stored record of a document into a fixed buffer through
  `EncodedView::write_stored` and restore it through `EncodedView::from_stored`.
  The private `document_export`, `document_capacity`, and
  `document_node_capacity` modules measure the visible scratch capacities of an
  export.
- [`src/workers.rs`](./src/workers.rs) defines `RenderWorkers` and
  `ThreadWorkers`, the injected worker pool, and `ComparisonTask`, one indexed
  job. Its `stylesheets` method runs one `StylesheetWorker` job for
  each stylesheet root, keeps the root order, and returns the first failure in
  root order. Its `comparison_tasks` method runs every index of a
  `ComparisonTask` once and returns when all of them have run. Its
  `comparison_stream` method runs a `ComparisonTask` as an ordered stream, with
  at most twice the pool size started and not yet consumed. Its `background`
  method runs one `BackgroundWorker` lookup on the pool. Its `capture_window`
  method runs a bounded capture window and joins every admitted task before it
  returns. Its `capture_parallelism` method gives the window limit, which
  includes the sidecar bound of the runtime.
- [`src/render_class.rs`](./src/render_class.rs) defines `RenderClass`, the
  scheduling class of a blocking render, `Foreground` by default.
  `RenderClass::in_scope` sets a class for one operation and restores the
  earlier class. `RenderClass::current` reads it. The private `WorkerContext`
  captures it with the tracing span for each worker job.
- [`src/fragments.rs`](./src/fragments.rs) defines `MemoFragments`, which
  memoizes JavaScript fragments in the same bounded cache. Its
  `record_served` forwards a store-served request to its renderer without a
  memo lookup.
- [`src/public_inputs.rs`](./src/public_inputs.rs) defines `ClosureInputs`,
  the leased closure-file records shared by equal document keys across
  generations.
- [`src/comparison_input.rs`](./src/comparison_input.rs) defines
  `RetainedComparisonInput` and `ComparisonFallback`, a retained comparison
  input and the deferred source read of a failed restore, and
  `RetainedDocumentEvidence`, the codec identity and closure of a retained
  view.
- [`src/comparison_stream.rs`](./src/comparison_stream.rs) defines
  `ComparisonConsumer`, which admits each index of an ordered comparison
  stream and consumes the finished indexes in order.
- [`src/comparison_proof.rs`](./src/comparison_proof.rs) defines
  `ComparisonRead`, `ProofMode`, `ContentIdentity`, and `DocumentProof`, the
  content proofs of comparison reads.
  [`src/session_proof.rs`](./src/session_proof.rs) answers them for a
  prepared generation.
- [`src/source_snapshot.rs`](./src/source_snapshot.rs) defines
  `SourceSnapshot`, the generation-scoped source reader.
- [`src/error.rs`](./src/error.rs) defines `GraphError`, which keeps the
  failure of each subsystem.

### Related Docs

- [Render graph](../../docs/architecture/rust-core.md#render-graph).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md) and its
  [background pass](../../docs/protocol/mokly-on-demand-background.md).
- [Render store](../../docs/protocol/mokly-render-store.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [Render input keys in Serve](../../docs/protocol/mokly-watch.md#invalidation-through-the-render-graph).
- [Final logical link validation](../../docs/protocol/mokly-link-validation.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Proven view reuse](../../docs/protocol/mokly-changes-serving.md#proven-view-reuse).
- [Base and head capture](../../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
