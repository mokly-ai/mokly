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
Each walk takes the `ViewerFonts` permission of its document's entry: only a
Markdown document's own CSS may name the viewer's two faces, which the walk
skips like external references.
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
  `DeliveryInputs`, the sidecar-reported stylesheet metadata of a generation
  and the stores that related generations share.
- [`src/key.rs`](./src/key.rs) provides `key` and `NodeKind`, the
  content-addressed node keys.
- [`src/cache.rs`](./src/cache.rs) defines `RenderCache`, `MemoryCache`,
  `Artifact`, and `CacheStats`, the render cache with its full and compact
  tiers. `RenderCache::contains` checks every tier without a restore.

See [render graph modules](./code.md) for more entry points.

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
