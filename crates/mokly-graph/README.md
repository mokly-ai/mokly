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

`Graph` implements `dyn RenderGraph`. It prepares a generation that Serve,
comparison, and static output can use to render documents and read resources.

The [render workers and background views](./workers.md) page covers the Serve
background pass, [comparison tasks and streams](./workers.md#comparison-tasks-and-streams),
and [wrapper forwards](./workers.md#wrapper-forwards). The
[cache and retained comparison](./cache.md) page covers caching, the render
store, and comparison proofs.

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
  `DeliveryInputs`, the supplied stylesheet and imported asset metadata of a
  generation and the stores that related generations share. `ImportedAsset`
  holds metadata for one opaque asset import.
- [`src/key.rs`](./src/key.rs) provides `key` and `NodeKind`, the
  content-addressed node keys.
- [`src/cache.rs`](./src/cache.rs) defines `RenderCache`, `MemoryCache`,
  `Artifact`, and `CacheStats`, the render cache with its full and compact
  tiers.

See [render graph modules](./code.md) for more entry points.

### Related Docs

- [Rendering and documents](./rendering.md).
- [Stylesheets, assets, and source protection](./delivery.md).
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
