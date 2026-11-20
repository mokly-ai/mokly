# mokly-graph

`mokly-graph` plans and evaluates catalogue renders for Mokly. Depend on it
from Serve, comparison, or static output. It uses `mokly-catalogue` for
prepared definitions, `mokly-html` for composition, and `mokly-css` for
stylesheet delivery. `mokly-render` supplies the JavaScript factories. It
writes no files.

## Responsibilities

- Compute content-addressed node keys before document rendering.
- Keep rendered artifacts in a byte-bounded LRU process cache, with a compact
  tier for evicted documents.
- Encode documents losslessly for the compact tier and the comparison capture,
  and identify their exact codec input.
- Render all views through an injected worker pool.
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

Resources found during composition enter a leased dependency index. Each
recipe retains its first observed digests. Later preparations add changed
resource digests to its key. Usage completion alone keeps the published key.
A resource edit changes its consuming document keys and reuses JavaScript
fragments. Missing and denied lexical resource paths stay observable for
repair. Weak subscribers attach those paths before the background pass
completes. Key scans read template bodies and saved slots as authored HTML, so
unknown ignore-wrapper attributes do not enter document keys.
`generation_key` hashes the configuration, the document plans, the delivered
stylesheet and asset identities, and the fragment generation for the live
descriptor. A private stylesheet input that changes no delivered byte keeps it.
`public_files` reads the shared closure records of the generation's document
keys and applies its own policy to each path. An unchanged document's render
that completes after replacement preparation is visible to the replacement.
The records index both document keys and public paths. A membership request
looks up one path and tests only the keys that reached it. The last lease of
a document key removes its records from both indexes. Serve also rechecks
live eligibility at read time. Temporary closure membership stays separate
from the catalogue's reached public files.

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

`MemoryCache` implements `dyn RenderCache`. It keeps rendered artifacts in a
full tier and evicted documents in a lossless compact tier, under one total
byte bound. [Cache and retained comparison](./cache.md) gives the complete
rules of the render cache, the link index and anchor check result store of
each generation, and the document codec. It also gives the capture and
retained input methods `comparison_capture`, `comparison_usage`,
`retained_comparison_input`, and `retained_document_evidence`, the content
proof methods `comparison_identity` and `comparison_document_proof`, and the
rules for their wrappers.

`collect_comparison` streams complete side validation to an ordered
`ComparisonCollector`. Each view composes once, including when the artifact
cache retains nothing. The build head capture and the base capture use this
validation path. Validation keeps only cross-view facts between batches.
It preserves aggregate failures and warning order. Inputs stay provisional
until the final anchor and output-name checks succeed. Batches use the
generation's existing render pool and sidecar count, with at most one
transient input per render worker.

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

`schedule_comparison_tasks` runs a caller's `ComparisonTask` once for every
index on the generation's render workers. It returns when every index has run.
The caller sizes each of these calls by `comparison_parallelism`.

`schedule_comparison_stream` runs a `ComparisonTask` as one ordered stream. Its
`ComparisonConsumer` admits each index into a slot that the caller owns. The
calling thread consumes the finished indexes in index order. At most twice
`comparison_parallelism().max(1)` indexes are started and not yet consumed. Each
consumption lets one more index start. A `false` from `admit` ends the stream.
A `false` from `consume`, or a task panic, stops new admission and
consumption. The call still waits for every admitted task, and a task panic
then reaches the caller. A stream that starts on a worker of the same pool
prepares and consumes one index at a time.

In both operations, the caller keeps the results, the errors, and the
cancellation checks. `ThreadWorkers` carries the caller's tracing span,
subscriber, and `RenderClass` through one shared context for all worker
methods. So a background render keeps its class in every worker job, and
Serve can order the sidecar calls of that render. The trait
defaults have a capacity of one. They run the indexes in order on the caller,
and the stream default prepares and consumes one index at a time.

Wrappers forward `comparison_parallelism`, `schedule_comparison`,
`schedule_comparison_tasks`, and `schedule_comparison_stream` to their inner
generation. `RenderWorkers` wrappers forward `comparison_parallelism`,
`comparison`, `comparison_tasks`, and `comparison_stream` in the same way.
Without these forwards, the comparison runs one view at a time. A scheduled
task still calls the wrapper's own methods, so the wrapper's checks stay
active. `RenderKeys::build_with_workers` also runs one key job for each
exporting module through `comparison_tasks` on the shared render workers.
Without the `comparison_tasks` forward, the key calculation runs one module at
a time.

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

`SourceSnapshot` forwards external read evidence to static admission without
replacing the witnessed bytes with a later snapshot hash. Stylesheet keys
include these versions separately from plugin declaration digests. Source
snapshots return `Arc<[u8]>` through `read_shared`, and cache hits share
storage. `digest_unretained` memoizes an opaque input hash without retaining
its payload. `SourceSnapshot::retained_bytes()` reports the retained private
payload per path. Parsed source snapshots have no byte eviction policy.

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
  static output call.
- [`src/graph.rs`](./src/graph.rs) defines `Graph`, which prepares one
  immutable render generation from the injected services.
- [`src/delivery_inputs.rs`](./src/delivery_inputs.rs) defines
  `DeliveryInputs`, the sidecar-reported stylesheet metadata of a generation
  and the stores that related generations share.
- [`src/key.rs`](./src/key.rs) provides `key` and `NodeKind`, the
  content-addressed node keys.
- [`src/cache.rs`](./src/cache.rs) defines `RenderCache`, `MemoryCache`,
  `Artifact`, and `CacheStats`, the render cache with its full and compact
  tiers.
- [`src/document_codec.rs`](./src/document_codec.rs) defines `EncodedView`,
  the lossless compact document that the compact tier and the comparison
  capture share. Its `encode_identified` and `comparison_identity` hash the
  complete codec input. The private `document_identity` and
  `document_metadata` modules hold that hash and the retained metadata.
- [`src/workers.rs`](./src/workers.rs) defines `RenderWorkers` and
  `ThreadWorkers`, the injected worker pool, and `ComparisonTask`, one indexed
  job. Its `stylesheets` method runs one `StylesheetWorker` job for
  each stylesheet root, keeps the root order, and returns the first failure in
  root order. Its `comparison_tasks` method runs every index of a
  `ComparisonTask` once and returns when all of them have run. Its
  `comparison_stream` method runs a `ComparisonTask` as an ordered stream, with
  at most twice the pool size started and not yet consumed.
- [`src/render_class.rs`](./src/render_class.rs) defines `RenderClass`, the
  scheduling class of a blocking render, `Foreground` by default.
  `RenderClass::in_scope` sets a class for one operation and restores the
  earlier class. `RenderClass::current` reads it. The private `WorkerContext`
  captures it with the tracing span for each worker job.
- [`src/fragments.rs`](./src/fragments.rs) defines `MemoFragments`, which
  memoizes JavaScript fragments in the same bounded cache.
- [`src/render_inputs.rs`](./src/render_inputs.rs) defines `RenderInputs` and
  `RenderKeys`, the render input key of each entry module over its module
  closure, resolution files, bindings, and bundle environment.
  `RenderKeys::build_with_workers` calculates the same keys as
  `RenderKeys::build` on injected `RenderWorkers`.
- [`src/public_inputs.rs`](./src/public_inputs.rs) defines `ClosureInputs`,
  the leased closure-file records shared by equal document keys across
  generations.
- [`src/policy.rs`](./src/policy.rs) and [`src/closure.rs`](./src/closure.rs)
  define `FilePolicy` and `Walker`, the public-file policy and the referenced
  closure walk.
- [`src/reference_index.rs`](./src/reference_index.rs) defines
  `ReferenceIndex` and `MemoryReferenceIndex`, the reference edges of each
  referenced file of one generation and its reads of the style memo.
- [`src/collection.rs`](./src/collection.rs) defines `ComparisonCollector`,
  which consumes validated comparison inputs in route order.
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
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [Final logical link validation](../../docs/protocol/mokly-link-validation.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Proven view reuse](../../docs/protocol/mokly-changes-serving.md#proven-view-reuse).
