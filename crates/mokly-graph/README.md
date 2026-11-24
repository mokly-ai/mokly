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
and computes document plans. Configured and declared stylesheet roots and
links name local stylesheets by `ResolvedConfig::repository_path`. Completed
JavaScript, stylesheet, PostCSS, and asset inputs populate the prepared
catalogue's dependency-directory set.
Cached bundles supply the same set. Old cache-validation reads and filename
suffixes cannot add or hide dependency usage. Preparation bundles the
stylesheet roots on the render workers, then registers the bundles in root
order. With deterministic plugins, the delivered generation, its key, and its
first error therefore do not depend on worker timing. No root starts after an
earlier root failed. Each root job checks
worker cancellation, and preparation checks it before each entry. A prepared generation exposes the same worker cancellation
through `check_cancelled` for callers that process views in a loop.

Preparation renders no document. Each plan carries a route and the document
node's input hash, which is the public `documentKey` of the
[rendering contract](../../docs/protocol/mokly-rendering.md). Stylesheet
dependency edits recompute their bundles. Equal emitted CSS and asset digests
preserve document keys. `dyn RenderGeneration` supports on-demand rendering, a
full build pass, resource reads, and closure queries. `render_props` validates
a complete transient props map with the parent's prepared validator from
`PreparedCatalogue::prop_validators`, and uses the same composition and
closure path.
Its document does not replace the saved plan or catalogue props. The
generation also exposes validated PostCSS directory watches, including empty
glob matches.

Serve reads each background view through `RenderGeneration::read_background`.
A hit finishes on a render worker, and a miss returns as a `BackgroundMiss`
without a tree. The [render workers and background views](./workers.md) page
holds the guidance for the lookup, the miss, the handoff, and the shared finish.

A JavaScript document key includes the render input keys of the definitions
that it renders, so an edit moves only the keys whose module closures it
reaches. Markdown document keys include no render input key.
Document keys include component paths and element names. Logical links depend
on their destination routes, including use-case first steps. An unresolved
link substitution inside a component depends on the routing inventory,
including when a prop reaches it through another component. One immutable
routing inventory serves each generation. Opaque entries share its complete
key. Explicit case spellings, moved aliases, and missing targets keep their
requested identities in the document key.

`RenderKeys::build_reusing_with_workers` gives the same keys as
`RenderKeys::build` and keeps compact facts about the inputs of each key. With
earlier keys as `previous`, it copies an earlier key only when every input of
that key is equal, and it calculates the other keys. With `None`, or with
earlier keys whose facts are not complete, it calculates every key and keeps
the facts of the new keys. It never waits for a seed that has not finished.
The facts live as long as their keys and keep no module graph, catalogue,
earlier keys, or lease.

`RenderKeys::build_unseeded_with_workers` calculates every key like
`RenderKeys::build_with_workers` and adds an empty fact cell to the keys.
`RenderGeneration::prepare_render_reuse` seeds that cell once. It reads the
config and catalogue that the prepared generation already holds, and it keeps
no copy of them. It changes no key and runs no key job. It does nothing when
the keys of the generation have no empty cell. Serve calls it after the
Changes of that generation complete as Ready or Unavailable.

`RenderKeys::build` and `RenderKeys::build_with_workers` keep no facts and no
cell. `RenderKeys::reuse_facts_bytes` reports the size of the cell, which
holds the facts value, and the capacities of the vectors and strings of its
facts. It leaves out allocator headers and the key map. It is zero for keys
without a cell. The `render.inputs` span records the `reused` key count and
that size as `retained_bytes`. The seed records that size in its own timing
stage, so a seed never appears as a key calculation.

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

`collect_comparison` streams complete side validation to an ordered
`ComparisonCollector`. Each view composes once, including when the artifact
cache retains nothing. The build head capture and the base capture use this
validation path. It renders the views through
`RenderGeneration::schedule_capture_window`, in the sliding window of the
[capture rules](../../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
That method runs `RenderWorkers::capture_window` on the generation's render
workers, with the limit from `RenderGeneration::capture_parallelism`. This
crate owns the window and the hand-off in route order. A worker encodes
each finished view with the `ComparisonEncoder` from
`ComparisonCollector::encoder`, and then it releases the decoded input. The
result is an `EncodedComparisonDocument`. The collector in `mokly-compare` owns
the capture bound, and `ComparisonCollector::remaining` gives the bytes that
the bound has left. Encoded views that wait for their turn share those bytes.
The window's `CaptureConsumer` frees the slot of a finished view only when the
view fits them, so a view that does not fit keeps its place until its turn. A
waiting view never changes which earlier views the collector keeps. Validation
keeps only cross-view facts, and it records them, the warnings, and the
aggregate failures at each view's turn. Inputs stay provisional until the final
anchor and output-name checks succeed. Apart from the capture bound, the window
holds at most one transient input or finished view for each render worker.

`RenderGeneration::uncached_documents` lists the routes whose document keys no
cache tier or prepared render-store index holds. Its store probe uses the full
native and JavaScript build identity and restores no document. `RenderGeneration::prefetch_comparison` starts their early
renders on the workers of the capture window, and it returns a `PrefetchGuard`.
Each early render enters the render cache. A capture read of the same route waits for an
early render that still runs, and it takes over one that has not started. When
the guard drops, it stops new early renders and waits for every running one.

`RenderGeneration::comparison_document` composes the same tree before closure
validation. Both sides validate reached resources under the
[public closure contract](../../docs/protocol/mokly-public-closure.md).
Historical checkout failures keep a `base-conversion` warning in the closure
and omit that file from delivery. `ResourceUnavailable` preserves this state
through resource byte and digest access. Other closure work continues.
`resource_bytes` reads confined public routes without granting access to
private sources or retaining assets in the private source snapshot.
`resource_digest` hashes opaque resources through a bounded stream. Generated
document resource reads use the same rendered bytes and digest as their views,
including after cache eviction. Closure traversal stops at declared documents,
so embedded catalogue cycles terminate. Closure evidence retains exact logical
instance and referring edge context for comparison proof.

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

`FilePolicy` is the one policy of the public closure contract for one
generation. `Walker` follows HTML and CSS references and renderer seeds.
Each `MemoryReferenceIndex` reads the inline style scans of the walk through
the style memo that `DeliveryInputs` passes in. The render runtime passes one
memo to all its generations, so an equal inline style text reuses a scan that
the bounded memo still holds.
Package directories come from the normalized `ResolvedConfig::package_roots`.
Repository aliases and case aliases do not make their files public.
Watch-input fingerprints use repository-relative POSIX names on every
platform. The working-tree adapter implements `mokly_source_interface::tree::SourceTree`. Historical rendering
supplies the same boundary through the comparison adapter. `mokly-render`
supplies the JavaScript factories and selected base dependencies through that
path. Serve must also apply the public policy's read-time confinement rules.

Opaque CSS asset preparation retains source identities and digests. A shared
asset path has one generated resource plan across stylesheet roots. Bundles,
source snapshots, and render caches retain no opaque payload for preparation.
Callers can also supply imported assets through `DeliveryInputs`. These
assets join the same resource plans before document validation, including
assets that no document references. They share routes with stylesheet assets
at the same logical path. Each input supplies its confined source identity,
digest, aliases, and importing module. Each comparison side uses its own inputs.
Final document composition rewrites asset tokens whose paths are portable.
It creates document-relative URLs beside logical links before URL and closure
checks. Collected style text and attribution records receive the same URLs.
Rule ownership stays unchanged. Replacement does not depend on asset membership.
A reference to an undelivered asset fails the existing
closure check as a missing target. Asset membership does not enter document
keys, so equal render inputs share cached documents across generations and sides.
`open_asset` supplies a `dyn AssetRead` stream. Its checked copy fails with
`GraphError::InputsChanged` if the captured digest or opened length differs.
Consumers keep copied bytes private until verification succeeds. Static output
retains one final immutable payload. Serve streams a verified temporary file.
Asset opens report `InputsChanged` for vanished paths, stopped symbolic-link
resolution, and non-regular replacements. Other open errors keep their IO
diagnostic. Explicit cancellation retains the cancelled runtime diagnostic.

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
- [`src/imported_assets.rs`](./src/imported_assets.rs) checks imported route
  portability and registers shared asset plans and protected source inputs.
- [`src/asset_tokens.rs`](./src/asset_tokens.rs) rewrites portable asset
  tokens for each document route with the shared stylesheet path rule. It
  keeps rule text equal between collected CSS and its attribution records.
- [`src/styles.rs`](./src/styles.rs) provides `local_roots`, the roots of the
  local stylesheets that the configuration and component declarations name.
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
- [`src/capture_window.rs`](./src/capture_window.rs) defines `CaptureConsumer`,
  which admits each route index of a capture window and frees the slot of a
  finished view only when its queued bytes fit.
- [`src/render_class.rs`](./src/render_class.rs) defines `RenderClass`, the
  scheduling class of a blocking render, `Foreground` by default.
  `RenderClass::in_scope` sets a class for one operation and restores the
  earlier class. `RenderClass::current` reads it. The private `WorkerContext`
  captures it with the tracing span for each worker job.
- [`src/fragments.rs`](./src/fragments.rs) defines `MemoFragments`, which
  memoizes JavaScript fragments in the same bounded cache. Its
  `record_served` forwards a store-served request to its renderer without a
  memo lookup.
- [`src/render_inputs.rs`](./src/render_inputs.rs) defines `RenderInputs` and
  `RenderKeys`, the render input key of each entry module over its module
  closure, resolution files, bindings, and bundle environment.
  `RenderKeys::build_with_workers` calculates the same keys as
  `RenderKeys::build` on injected `RenderWorkers`.
  `RenderKeys::build_unseeded_with_workers` also adds an empty fact cell for a
  later seed. `RenderKeys::build_reusing_with_workers` keeps reuse facts and
  copies each unchanged key from the `previous` keys.
  `RenderKeys::reuse_facts_bytes` reports the bytes of the cell and its facts.
  The private `render_preparation` module encodes the records of every builder,
  and the private `render_reuse` module compares the facts and finds the keys
  to calculate again.
- [`src/public_inputs.rs`](./src/public_inputs.rs) defines `ClosureInputs`,
  the leased closure-file records shared by equal document keys across
  generations.
- [`src/policy.rs`](./src/policy.rs) and [`src/closure.rs`](./src/closure.rs)
  define `FilePolicy` and `Walker`, the public-file policy and the referenced
  closure walk. `FilePolicy` gives a reported stylesheet input the
  `PublicDenial::Vite` reason of [`src/public_denial.rs`](./src/public_denial.rs)
  under the Vite adapter, and the `PublicDenial::Postcss` reason otherwise.
- `ClosureBuilder::collect_recorded` reports each input of the walk to a
  `ValidationRecorder`. Its default marks the walk unknown, so a builder that
  cannot record its inputs keeps no facts. The private
  [`src/closure_walk.rs`](./src/closure_walk.rs) holds the one walk that
  `Walker::collect` and `Walker::collect_recorded` run.
- [`src/head_validation.rs`](./src/head_validation.rs) defines
  `HeadValidation`, `HeadProof`, `ClosureProof`, `ClosureFacts`,
  `DocumentChecks`, `ValidationRecorder`, and `ValidationRead`.
  `RenderGeneration::validate_head` runs complete head validation over every
  view with a caller's `HeadValidation`. `HeadValidation::kept` can prove a
  view from the caller's kept facts with no document read. For any other view
  the caller supplies the checked document, and either proven closure facts,
  the background walk of the same generation, or a recorded walk.
  `HeadValidation::validated` lets the caller keep the outputs of a view read
  from its document. The default calls `render_all`.
  `RenderGeneration::validation_document` and
  `RenderGeneration::validation_identity` give the checked head read and the
  proof of one walk or link input. `RenderGeneration::validation_checks`
  exports the checks of a checked read, and
  `RenderGeneration::adopt_validation` adopts them for a proven document
  instead of a read. Their defaults read `comparison_document`, prove nothing,
  export nothing, and decline. The caller's `HeadValidation` reads documents
  and inputs through the outermost generation. So a checking wrapper can
  forward `validate_head`, and it keeps its checks in these four methods. The
  private [`src/session_head.rs`](./src/session_head.rs) runs the pass for a
  prepared generation. A view proven from kept facts replays their observer
  calls and takes its anchors, links, and warnings from them. Its adoption
  reads the render cache once, as the checked read's lookup does, and a
  document that the cache does not hold takes the checked read. Any other view
  takes its anchors, links, and document warnings from its current document.
  Every ordered and global check still runs over all views. The private
  [`src/head_links.rs`](./src/head_links.rs) answers the `LinkTarget` read:
  the destination, a use case's first screen, and the route and document key
  of each view that the link check of one target reads.
- [`src/head_walks.rs`](./src/head_walks.rs) defines `WalkRecord` and
  `WalkStep`. A Serve background read records the read set of its closure walk
  through the same recorder calls as a validation walk. The generation keeps
  one record for each view with a viewport that its background reads walked,
  within two MiB, and its head validation takes each record once. A page or a
  Markdown document keeps no record, because the pass reads it again after
  each edit, also when its document did not change. A record ends with that
  validation or with its generation.
- [`src/reference_index.rs`](./src/reference_index.rs) defines
  `ReferenceIndex` and `MemoryReferenceIndex`, the reference edges of each
  referenced file of one generation and its reads of the style memo.
- [`src/collection.rs`](./src/collection.rs) defines `ComparisonCollector`,
  which consumes encoded comparison inputs in route order. Its `encoder`
  method gives the encoder that the workers use, and its `remaining` method
  gives the capture bytes that waiting views can use.
- [`src/collection_input.rs`](./src/collection_input.rs) defines
  `ComparisonEncoder`, the encoding boundary that a collector or a checking
  wrapper supplies. It returns the encoded view and its codec identity.
  `EncodedComparisonDocument` holds one encoded view, its identity, and its
  closure while the view waits for its turn.
- [`src/prefetch.rs`](./src/prefetch.rs) defines `PrefetchGuard`, which stops
  the early renders of one classification and waits for them when it drops.
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
- [`src/asset_delivery.rs`](./src/asset_delivery.rs) defines `AssetRead`, the
  digest-checked opaque asset stream.
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
