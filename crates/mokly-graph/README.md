# mokly-graph

`mokly-graph` plans and evaluates catalogue renders for Mokly. Depend on it
from Serve, comparison, or static output. It uses `mokly-catalogue` for
prepared definitions, `mokly-html` for composition, and `mokly-css` for
stylesheet delivery. It writes no files.

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
modules from the sidecar adapter. Its `prepare` method reads stylesheet
inputs and computes document plans. It renders no document. Each plan carries
a route and the document node's input hash, which is the public
`documentKey`. `dyn RenderGeneration` supports on-demand rendering, a full
build pass, resource reads, and closure queries.

`MemoryCache` implements `dyn RenderCache`. It charges document bytes, parsed
trees, and evidence. It evicts by access order. Oversized artifacts return
to the caller without retention. Plans keep recipes rather than a complete
set of parsed documents. Eviction changes work only.

`RenderGeneration::comparison_document` composes the same tree before closure
validation. Both sides require complete, valid closures. A missing referenced
head resource is `build-invalid`. `resource_bytes` reads confined public routes
without granting access to private sources or retaining assets in the private
source snapshot. Closure evidence retains exact logical instance and referring
edge context for comparison proof.

`FilePolicy` caches accepted and rejected authored-path decisions for one
generation. `Walker` follows HTML and CSS references and renderer seeds.
It stops at declared catalogue documents. The working-tree adapter and the
Git-tree adapter both implement `mokly-source-interface::tree::SourceTree`.
Serve must also apply the public policy's read-time confinement rules.

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
imports and assets, portable links, repeated slots, and cache eviction.

### Key Code

- [Graph preparation](./src/graph.rs) and [document planning](./src/planning.rs).
- [Generation interface](./src/types.rs), [session](./src/session.rs), and [workers](./src/workers.rs).
- [Node keys](./src/key.rs), [cache](./src/cache.rs), and [memory accounting](./src/weight.rs).
- [Public policy](./src/policy.rs), [closure](./src/closure.rs), and [Markdown links](./src/markdown_links.rs).

### Related Docs

- [Render graph](../../docs/architecture/rust-core.md#render-graph).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
