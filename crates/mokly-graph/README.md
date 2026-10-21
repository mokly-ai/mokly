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
inputs and computes document plans. It checks worker cancellation before each
entry and stylesheet root. Config-relative stylesheet paths normalize dot
segments inside `repoRoot`. A prepared generation exposes the same worker
cancellation through `check_cancelled` for callers that process views in a loop.
Preparation renders no document. Each plan carries
a route and the document node's input hash, which is the public
`documentKey`. Stylesheet dependency edits recompute their bundles. Equal
emitted CSS and asset digests preserve document keys. `dyn RenderGeneration` supports on-demand rendering, a full
build pass, resource reads, and closure queries. `render_props` validates a
complete transient props map and uses the same composition and closure path.
Its document does not replace the saved plan or catalogue props. The generation
also exposes validated PostCSS directory watches, including empty glob matches.
Resources found during composition enter a leased dependency index. Each
recipe retains its first observed digests. Later preparations add changed
resource digests to its key. Usage completion alone keeps the published key.
A resource edit changes its consuming document keys and reuses JavaScript fragments.
Missing and denied lexical resource paths stay observable for repair. Weak
subscribers attach those paths before the background pass completes.
`generation_key` hashes the complete render input set for the live descriptor.
`public_files` lists authored files reached by completed renders. Serve
rechecks their live eligibility at read time. Temporary closure membership
stays separate from the catalogue's reached public files.

Markdown document keys exclude the JavaScript generation fingerprint.
Document keys include component paths and element names. Logical links depend
on their destination routes, including use-case first steps. An unresolved link
substitution inside a component depends on the routing inventory, including
when a prop reaches it through another component.
One immutable routing inventory serves each generation. Opaque entries share
its complete key. Explicit case spellings, moved aliases, and missing targets
keep their requested identities in the document key.

`MemoryCache` implements `dyn RenderCache`. It charges document bytes, parsed
trees, and evidence. It evicts by access order. Oversized artifacts return
to the caller without retention. Plans keep recipes rather than a complete
set of parsed documents. Eviction changes work only.
Cross-view anchor checks retain successful destination renders in this same
bounded cache. Repeated links reuse those documents. Each requested fragment
is still checked in every destination view, including cache hits.
Concurrent checks of one destination wait for its active render, then check
the bounded cache again. Completed requests release their synchronization keys.
Different targets and different generations keep independent requests.
Anchor checks and JavaScript fragments use the same scoped request mechanism.
Each generation and each fragment adapter owns an independent registry.
The final active lease removes its entry even when an old mutex handle still lives.

Complete base validation can stream documents and closures to an ordered
comparison collector. Each view composes once, including when the artifact
cache retains nothing. Validation keeps only cross-view facts between batches.
It preserves aggregate failures and warning order. Inputs stay provisional
until the final anchor and output-name checks succeed.
Validated collection schedules batches through the generation's existing
render pool and sidecar count. It records each batch's validation facts before
reporting its summary charge and forwarding inputs in route order.
Each batch contains at most one transient input per render worker.

`RenderGeneration::comparison_document` composes the same tree before closure
validation. Both sides require complete, valid closures. A missing referenced
head resource is `build-invalid`. `resource_bytes` reads confined public routes
without granting access to private sources or retaining assets in the private
source snapshot. `resource_digest` hashes opaque resources through a bounded
stream. Generated document resource reads use the same rendered bytes and
digest as their views, including after cache eviction. Closure traversal still
stops at declared documents, so embedded catalogue cycles terminate.
Planning prefetches known resource paths for the whole generation and
retains only digests and reference edges. Closure checks opaque resources by
confined file identity; HTML and CSS inputs are read for their child references.
Closure evidence retains exact logical instance and referring
edge context for comparison proof. A comparison adapter can expose its existing
capture through `comparison_capture`. The comparison engine reuses that handle
instead of retaining another encoded copy of the same base. A smaller capture
budget returns to the original source recipes. Wrappers that add checks must
return `None` from `comparison_capture` so rebuilding cannot bypass their checks.
Tests exercise capture reuse; production callers supply fresh base generations.

`FilePolicy` caches accepted and rejected authored-path decisions for one
generation. `Walker` follows HTML and CSS references and renderer seeds.
Private output and package directories keep their physical identities.
Repository aliases and case aliases do not make their files public.
Private-source checks also use each file's physical identity. Watch-input
fingerprints use repository-relative POSIX names on every platform.
It stops at declared catalogue documents. The working-tree adapter implements
`mokly-source-interface::tree::SourceTree`. Historical rendering supplies the
same boundary through the comparison adapter. `mokly-render` supplies the
JavaScript factories and selected base dependencies through that path.
Serve must also apply the public policy's read-time confinement rules.

Source snapshots forward external read evidence to static admission without
replacing the witnessed bytes with a later snapshot hash. Stylesheet keys
include these versions separately from plugin declaration digests.
Source snapshots return `Arc<[u8]>` through `read_shared`. Cache hits share
storage. `digest_unretained` memoizes an opaque input hash without retaining its payload.
`SourceSnapshot::retained_bytes()` reports the retained private payload per path.
The observation excludes map metadata and other owners of the same bytes.
Opaque CSS asset preparation retains source identities and digests. A shared
asset path has one generated resource plan across stylesheet roots. Bundles,
source snapshots, and render caches retain no opaque payload for preparation.
`open_asset` supplies a `dyn AssetRead` stream. Its checked copy uses bounded
chunks and fails with `GraphError::InputsChanged` if the captured digest or
opened length differs. Consumers keep copied bytes private until verification
succeeds. Static output retains one final immutable payload; Serve streams a
verified temporary file. Parsed source snapshots have no byte eviction policy.
Asset opens report `InputsChanged` for vanished paths, stopped symbolic-link
resolution, and non-regular replacements. Other open errors keep their IO
diagnostic. Checked reads retry interruption; explicit cancellation retains
the cancelled runtime diagnostic.
Entry-source keys and binary closure validation use digest reads. HTML and
CSS closure parsing retains the bytes it needs. Resource hash reads require a
confined regular target before opening it.
Each path has its own read and digest cells, so file IO does not hold the snapshot
map lock. Preparation runs on the caller's stack. Render workers use Rayon's
default stack. Component keys, document walks, embedded-document resource
walks, and retained-tree accounting use explicit work stacks. The deep-tree
test prepares, composes, serializes, compares, and drops 20,000 levels on an
ordinary thread with cache retention disabled.

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
- [Routing inputs](./src/routing_inputs.rs) and [shared routing records](./src/routing_records.rs).
- [Generation interface](./src/types.rs), [session](./src/session.rs), and [workers](./src/workers.rs).
- [Node keys](./src/key.rs), [cache](./src/cache.rs), and [memory accounting](./src/weight.rs).
- [Public policy](./src/policy.rs), [closure](./src/closure.rs), and [Markdown links](./src/markdown_links.rs).
- [Protected locations](./src/public_locations.rs) classify requested and physical paths with the same rules.

### Related Docs

- [Render graph](../../docs/architecture/rust-core.md#render-graph).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Rendering](../../docs/protocol/mokly-rendering.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
