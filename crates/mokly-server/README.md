# mokly-server

`mokly-server` delivers a local Mokly catalogue over HTTP. Depend on it from
the CLI to serve the browser shell, the public read model, graph documents,
and temporary prop previews. `mokly-graph` owns rendering and resource closure.
`mokly-model` owns public shapes, canonical JSON, and path names.
`mokly-compare` owns Changes classification and its shared projections.

## Responsibilities

- Bind IPv4 loopback and select one stable port.
- Serve one data-free stub on each declared shell route.
- Deliver an atomic index, current entry details, and live descriptor.
- Render generated documents on request through an injected graph adapter.
- Read only reached authored resources through confined file handles.
- Authenticate live prop edits and retain previews in bounded process memory.
- End client connections before ordered subsystem shutdown.

## What This Crate Does

`TokioServer` implements `dyn ServerRuntime`. It uses Axum, Tokio, and Hyper.
The transport owns each HTTP connection. Shutdown follows the
[runtime shutdown order](../../docs/protocol/mokly-runtime.md): event-stream
connections get a short grace period to flush their final chunk, then the
transport aborts the other connections, including incomplete requests, before
the watcher, render, Git, sidecar, and lock hooks run. An error in one hook
does not skip later hooks. The render-cancellation hook interrupts provider
requests before the HTTP worker pool drains them. The listener stays reserved
through sidecar shutdown and final release. The CLI reporter receives the
first accept resource failure and the recovery once per backoff period.

`Projector` implements `dyn SnapshotFactory`. It projects the initial revision
from graph plans without rendering a document. Every JSON response has
canonical bytes. `Publications` supplies one complete snapshot per read and
update, including its matching document backend. `FixedPublication` retains
revision 1. `SharedPublication` installs later revisions in one step and emits
each update in order. A superseded revision admits no queued live render.
Watch and Changes use these same boundaries. Shutdown fences and drains queued
publications.

Evidence revisions share the generation's assets, routes, backend, and shell.
Unchanged detail payloads and index bytes also stay shared. Only changed
details are validated and encoded. Source replacements retain ready usage when
its document key is equal. `Snapshot::detail` supplies the matching revision
to typed consumers.

`UsagePass` and `ChangesPass` run the background work of the
[on-demand Serve contract](../../docs/protocol/mokly-on-demand.md): current
usage first, then Changes classification against one pinned merge base. They
yield to foreground requests, publish changed evidence in one revision, and
cannot publish into a replacement. Ready state installs the generation root,
the base commit, Changes membership, moved paths, removed records, and per-view
states, ignore ids, and evidence in one revision. Included details carry
classification reasons and their base side even without a workspace.
Workspace lists stay absent until all
consumer usage is proven. One unavailable view keeps every Used by list absent
until the next generation. Failed views publish unavailable usage without
inventing empty consumers. `mokly-model` projects every status from retained
model inputs. `mokly-compare` owns Changes membership, eligibility,
workspaces, input changes, and removed metadata. Serve uses those shared
functions and the shared snapshot route builders. Watched Serve polls `HEAD`
and the base ref once per second. A changed merge base reuses the accepted
current graph. A tip change with the same merge base keeps the published
state. HTTP worker leases keep foreground priority for the whole request, and
the CLI shares those leases with base-side sidecar admission.

`MemoryComparisons` implements `dyn Comparisons`, the store of the
[selected comparison contract](../../docs/protocol/mokly-selected-comparisons.md).
Classification generations start with the removed details. Selected captures
find one screen, component, or variant in the retained review and copy only
its view closures; they hold no JSON. A variant selection captures only the
selected variant's documents. The selection route redirects to the root of the
captured generation, and a GET or HEAD of a retained root renews its idle
window with 204. Historical routes capture the removed entry from the same
pinned base. Captures preserve original document bytes. `FrozenResources`
retains document and resource hashes. It rejects changed public bytes or an
inconsistent document after cache eviction before a capture can install a
mixed generation. Its `comparison_capture` method returns `None`, so capture
creation and smaller budgets cannot bypass these checks through the wrapped
generation. The contract owns the admission, retention, and capacity limits.

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the
same document. Public authored reads require both reached closure membership
and a fresh policy check under the
[public closure contract](../../docs/protocol/mokly-public-closure.md).
`ConfinedReader` opens each directory and the final regular file without
following symlinks. Routes never fall back to repository files. Generated
opaque assets use `dyn AssetStreams`, which verifies each asset into a
temporary file under the
[CSS assets contract](../../docs/protocol/mokly-imported-styles-assets.md).
Requests for the same route do not share a capture. Worker parallelism bounds
active captures, and the opened length bounds each file. Live response files
have no aggregate byte bound. The OS temporary directory can use `tmpfs`, whose
storage consumes memory outside process RSS measurements. The built viewer's
browser manifest lists the only client modules served. The shared shell
declares the Browse brand SVG at `/mokly-viewer/client/brand.svg`, and the
asset loader serves the matching packaged icon for both Serve and static
output.

Each `GraphDocuments` captures a `dyn RenderWarnings` hook from its owning
Serve attempt. Saved, background, and temporary renders deliver private
composition warnings before returning their result, including retained
warnings on failure. The CLI owns sorting, deduplication, and attempt fences.
HTTP bodies and public models contain no warning records.

Authored GET responses stream from the confined handle without a file-size
limit. HEAD opens the same handle and sends no bytes. Serve delivers document
and preview HTML without inspector injection.

Temporary renders follow the
[live controls contract](../../docs/protocol/mokly-component-controls.md),
which owns the `Host`, `Origin`, and token checks and the preview store
limits. They validate the installed revision, view, controls, and complete
props, and use the graph's shared prop render path outside the HTTP event
loop. Body reads keep only the authorization token. Validation and render
admission take the current snapshot after the body arrives, so a stalled body
cannot retain a replaced snapshot or its comparison capture. The CLI supplies
the shared JavaScript runtime, so React entries use the same pool, cache,
renderer, PostCSS, and fragment keys as their saved views. `MemoryPreviews`
holds the preview bundles.

## Quick Start

From the workspace root, build the viewer and run an HTML catalogue:

```bash
npm run build
cargo run -p mokly-cli --bin mokly -- serve --config crates/mokly-graph/tests/fixtures/catalogue/mokly.config.json --no-watch --port 0
```

The composition root supplies `dyn Publications`, `dyn PreviewStore`,
`dyn Work`, and `dyn Diagnostics` to `Application`. Serve also supplies
`dyn Comparisons` and a Changes continuation to `UsagePass`. It reserves a
listener through `dyn ServerRuntime` and calls its `dyn BoundServer::run`
method with a stop channel and `dyn Lifecycle` hooks.

## Development

```bash
cargo test -p mokly-server
cargo clippy -p mokly-server --all-targets -- -D warnings
```

Unit tests use injected boundaries and fake time.
[Comparison route tests](./src/_tests_/comparison_expiry_tests.rs) advance the
server clock through the retention boundary. They cover HEAD renewal,
collection, and recovery of selected screen and component comparisons with
both sides' original documents and resources. Integration tests use a real
HTML graph and loopback sockets. They cover route bytes, headers, fences,
public-file replacement, encoded attacks, previews, and event-stream shutdown.

### Key Code

- [`src/runtime.rs`](./src/runtime.rs) defines `ServerRuntime`,
  `BoundServer`, and `TokioServer`, the loopback transport.
- [`src/application.rs`](./src/application.rs) defines `Application`, which
  dispatches every HTTP route over the current publication.
- [`src/publication.rs`](./src/publication.rs) defines `Publications`,
  `FixedPublication`, and `SharedPublication`, the atomic public state and its
  ordered updates.
- [`src/snapshot.rs`](./src/snapshot.rs) defines `Snapshot`,
  `SnapshotFactory`, and `Projector`, the canonical bytes of one revision.
- [`src/backend.rs`](./src/backend.rs) defines `Documents` and
  `GraphDocuments`, the graph-backed documents and read-time confinement.
- [`src/public_read.rs`](./src/public_read.rs) defines `ConfinedReader`, which
  opens authored files without following symlinks.
- [`src/background.rs`](./src/background.rs) and
  [`src/changes_background.rs`](./src/changes_background.rs) define
  `UsagePass` and `ChangesPass`, the background usage and Changes work.
- [`src/comparison_store.rs`](./src/comparison_store.rs) defines `Comparisons`
  and `MemoryComparisons`, the bounded selected comparison generations.
- [`src/render_request.rs`](./src/render_request.rs) and
  [`src/preview.rs`](./src/preview.rs) validate live prop requests and define
  `PreviewStore` and `MemoryPreviews`.
- [`src/shutdown.rs`](./src/shutdown.rs) defines `Lifecycle`, the ordered
  shutdown hooks.
- [`src/assets.rs`](./src/assets.rs) defines `ViewerAssets` and
  `PackageAssets`, the built viewer inventory. The shell stub comes from
  [`mokly-model`](../mokly-model/src/shell.rs).

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md).
- [Selected comparisons](../../docs/protocol/mokly-selected-comparisons.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
