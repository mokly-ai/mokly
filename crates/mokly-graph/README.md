# mokly-graph

`mokly-graph` plans and evaluates catalogue renders for Mokly. Depend on it
from Serve, comparison, or static output. It uses `mokly-catalogue` for
prepared definitions, `mokly-html` for composition, and `mokly-css` for
stylesheet delivery. `mokly-render` supplies the JavaScript factories. It
writes no files.

## Responsibilities

- Compute content-addressed node keys before document rendering.
- Keep rendered artifacts in a byte-bounded LRU process cache.
- Render all views through an injected worker pool.
- Reconstruct evicted documents and stylesheet resources from their recipes.
- Validate logical anchors across destination views.
- Compute the referenced authored asset closure with one public policy.

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
a complete transient props map and uses the same composition and closure path.
Its document does not replace the saved plan or catalogue props. The
generation also exposes validated PostCSS directory watches, including empty
glob matches.

Resources found during composition enter a leased dependency index. Each
recipe retains its first observed digests. Later preparations add changed
resource digests to its key. Usage completion alone keeps the published key.
A resource edit changes its consuming document keys and reuses JavaScript
fragments. Missing and denied lexical resource paths stay observable for
repair. Weak subscribers attach those paths before the background pass
completes. Markdown links to `plans/*.md` files render as plain text. Only the
existence of such a file enters document keys, not its content. Key scans read
template bodies and saved slots as authored HTML, so unknown ignore-wrapper
attributes do not enter document keys.
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

`MemoryCache` implements `dyn RenderCache`. It charges document bytes, parsed
trees, and evidence, including registry ownership in documents and fragments.
The charge is an estimate of retained memory. Usage, instance, and slot
records count at twice their JSON length. `stats` reports the charged bytes,
the retained entries, and the hit, miss, and eviction counts.
It evicts by access order. Oversized artifacts return to the caller without
retention. Plans keep recipes rather than a complete set of parsed documents.
Eviction changes work only. Cross-view anchor checks retain successful
destination renders in this same bounded cache. Repeated links reuse those
documents. Each requested fragment is still checked in every destination view,
including cache hits. Concurrent checks of one destination share its active
render.

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

A comparison adapter can expose its existing capture through
`comparison_capture`. The comparison engine reuses that handle instead of
retaining another encoded copy of the same base. A smaller capture budget
returns to the original source recipes. Wrappers that add checks must return
`None` from `comparison_capture`, so rebuilding cannot bypass their checks.
Production callers supply fresh base generations.

`FilePolicy` is the one policy of the public closure contract for one
generation. `Walker` follows HTML and CSS references and renderer seeds.
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

let cache: &dyn RenderCache = &MemoryCache::new(1024 * 1024);
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
  `DeliveryInputs`, the sidecar-reported stylesheet metadata of a generation.
- [`src/key.rs`](./src/key.rs) provides `key` and `NodeKind`, the
  content-addressed node keys.
- [`src/cache.rs`](./src/cache.rs) defines `RenderCache`, `MemoryCache`, and
  `Artifact`, the byte-bounded LRU render cache.
- [`src/workers.rs`](./src/workers.rs) defines `RenderWorkers` and
  `ThreadWorkers`, the injected worker pool. Its `stylesheets` method runs one
  `StylesheetWorker` job for each stylesheet root, keeps the root order, and
  returns the first failure in root order.
- [`src/fragments.rs`](./src/fragments.rs) defines `MemoFragments`, which
  memoizes JavaScript fragments in the same bounded cache.
- [`src/render_inputs.rs`](./src/render_inputs.rs) defines `RenderInputs` and
  `RenderKeys`, the render input key of each entry module over its module
  closure, resolution files, bindings, and bundle environment.
- [`src/public_inputs.rs`](./src/public_inputs.rs) defines `ClosureInputs`,
  the leased closure-file records shared by equal document keys across
  generations.
- [`src/policy.rs`](./src/policy.rs) and [`src/closure.rs`](./src/closure.rs)
  define `FilePolicy` and `Walker`, the public-file policy and the referenced
  closure walk.
- [`src/collection.rs`](./src/collection.rs) defines `ComparisonCollector`,
  which consumes validated comparison inputs in route order.
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
- [Public closure](../../docs/protocol/mokly-public-closure.md).
