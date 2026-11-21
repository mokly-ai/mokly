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
- Hold a write lease of the render store during render jobs, captures, and
  Changes reference probes, so its writer stays paused while Serve works.
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
from graph plans without rendering a document. It computes each detail's
content id before publishing the index that lists those ids. Every JSON response
has canonical bytes. `Publications` supplies one complete snapshot per read and
update, including its matching document backend. `FixedPublication` retains
revision 1. `SharedPublication` installs later revisions in one step and emits
each update in order. A superseded revision admits no queued live render.
Watch and Changes use these same boundaries. Shutdown fences and drains queued
publications.

Evidence revisions share the generation's assets, routes, backend, and shell.
Unchanged detail payloads and index bytes also stay shared. Source
replacements retain ready usage when its document key is equal. Public
membership reads that document's shared closure records with the
replacement's own policy. This includes a render that completes after the
replacement is prepared. `Snapshot::detail` supplies the matching revision to
typed consumers.

Rebuild, usage completion, and Changes publish details through one reuse rule.
Each snapshot keeps at most four recent records for each current path, one for
each publication kind: rebuild, usage completion, a Changes status update, and
ready Changes evidence. A record shares a typed detail, its `detailId`, and its
encoded payload. A new detail takes that id and payload only when it equals the
record apart from `detailId` and `revision`, and both details have or both
lack `revision`. A supplied id alone never proves equality. Reuse never
changes the typed `revision` that a phase stamps on its details.

A detail that matches no record serializes its
[detail identity](../../docs/protocol/mokly-catalogue-serialization.md#detail-identity)
preimage once. The hash fills only the top-level `detailId` slot, and the
detail replaces only the record of its own kind. `RevisionFile` stores the
bytes around the top-level `revision`, and each response inserts the current
publication's revision. The records drop paths that leave the catalogue. They
hold no snapshot, generation, render backend, or history. A candidate copies
them, so a rejected candidate leaves the live records unchanged.

`UsagePass` and `ChangesPass` run the background work of Serve: current usage
first, then Changes classification against one pinned merge base. The
[background work](./background.md) page holds the guidance for their window,
the lookup and the miss of each view, the `Stages` bounds and budget, the ready
state, and the write leases of the Changes reference probes.

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
generation. It forwards `comparison_parallelism`, `capture_parallelism`,
`schedule_capture_window`, `schedule_comparison_tasks`, and
`schedule_comparison_stream` to the wrapped generation. Scheduled tasks still
call its checked reads. Its capture collector wraps the
`ComparisonEncoder` of the inner collector. So each capture worker checks the
original document bytes and the digests of the closure's resources before it
encodes a view. The collector forwards `remaining`, so the waiting views keep
the same byte bound. It keeps the default `None` of
`retained_comparison_input`, because a forward could bypass these checks or
need source IO. The contract owns the admission, retention, and capacity
limits.

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the
same document. Public authored reads require both reached closure membership
and a fresh policy check under the
[public closure contract](../../docs/protocol/mokly-public-closure.md).
`ConfinedReader` opens each directory and the final regular file without
following symlinks. Routes never fall back to repository files. The built
viewer's browser manifest lists the only client modules served. The shared
shell declares the Browse brand SVG at `/mokly-viewer/client/brand.svg`, and
the asset loader serves the matching packaged icon for both Serve and static
output.

Generated opaque assets follow the
[CSS assets contract](../../docs/protocol/mokly-imported-styles-assets.md).
`GraphDocuments::asset_request` reserves the capture of a route before
foreground worker admission, without IO. `GraphDocuments` keeps a weak entry
for each route, so concurrent requests of its generation join one capture.
A request that waits for a worker already holds its capture. The first
admitted request verifies the asset through `dyn AssetStreams` into an
unnamed temporary file. The other requests wait for that result and share it.
A failure keeps its original type, so the CLI still requests a new generation
after an input change. Each response reads the shared file at its
own byte offset, with `read_at` on Unix and `seek_read` on Windows. The last
request or response that holds the capture closes the file, and no idle copy
stays. Worker parallelism bounds active captures, and the opened length bounds
each file. Live response files have no aggregate byte bound. The OS temporary
directory can use `tmpfs`, whose storage consumes memory outside process RSS
measurements.

Each `GraphDocuments` captures a `dyn RenderWarnings` hook from its owning
Serve attempt. Saved and temporary renders deliver private composition
warnings before returning their result, including retained warnings on
failure. A background render returns its warnings instead, and a failure keeps
them: `UsagePass` reports them through `Documents::report`, in catalogue
order, directly before a failure's diagnostic. The CLI owns sorting,
deduplication, and attempt fences.
HTTP bodies and public models contain no warning records.

Authored GET responses stream from the confined handle without a file-size
limit. HEAD opens the same handle and sends no bytes. Serve delivers document
and preview HTML without frame probe injection.

Temporary renders follow the
[live controls contract](../../docs/protocol/mokly-component-controls.md),
which owns the `Host`, `Origin`, and token checks and the preview store
limits. They validate the installed revision, view, controls, and complete
props. The props check uses the prepared validators that each snapshot copies
from its generation's catalogue. They use the graph's shared prop render path
outside the HTTP event
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
[Shared asset tests](./tests/shared_assets/delivery_tests.rs) send requests
to the router in process and keep response bodies open. They cover one copy
for concurrent `GET` and `HEAD` requests, its release, and separate routes and
generations.

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
- [`src/replacement.rs`](./src/replacement.rs) provides `reuse_usage` and
  `encode_details`, which retain ready usage and reuse equal details when a
  rebuild projects a new snapshot.
- [`src/evidence.rs`](./src/evidence.rs) and
  [`src/changes.rs`](./src/changes.rs) provide `complete` and `project`, which
  publish usage completion and Changes from the current snapshot.
- [`src/detail_encoding.rs`](./src/detail_encoding.rs) defines
  `DetailEncoder` and `EncodedDetails`, which hash and encode each detail that
  matches no recent record.
- [`src/detail_publication.rs`](./src/detail_publication.rs) defines
  `RecentDetails`, the bounded equality records shared by the publication paths.
- [`src/revision_file.rs`](./src/revision_file.rs) defines `RevisionFile`, the
  shared payload that each response completes with the current revision.
- [`src/backend.rs`](./src/backend.rs) defines `Documents` and
  `GraphDocuments`, the graph-backed documents and read-time confinement.
  `Documents::background_read` looks up one background view, and its default
  `Ok(None)` declines the lookup. `GraphDocuments::background` renders one view
  on the ordinary path.
- [`src/background_read.rs`](./src/background_read.rs) defines
  `BackgroundRead` and `BackgroundMiss`, the result of one lookup and the
  single-use miss that `GraphDocuments::read_background` returns.
  `BackgroundMiss::complete` takes the route's usage lock again and renders
  nothing when that usage is already settled.
- [`src/public_read.rs`](./src/public_read.rs) defines `ConfinedReader`, which
  opens authored files without following symlinks.
- [`src/asset_streams.rs`](./src/asset_streams.rs) defines `AssetStreams`,
  `TemporaryAssets`, `AssetRequest`, `AssetResult`, and `SharedAsset`, the
  verified asset copy that concurrent requests share.
- [`src/backend_assets.rs`](./src/backend_assets.rs) keeps the weak route
  entries and the shared capture result that `GraphDocuments::asset_request`
  reserves before worker admission.
- [`src/asset_response.rs`](./src/asset_response.rs) streams a verified asset,
  and each response reads the shared file at its own offset.
- [`src/background.rs`](./src/background.rs) and
  [`src/changes_background.rs`](./src/changes_background.rs) define
  `UsagePass` and `ChangesPass`, the background usage and Changes work.
  `UsagePass::fill_window` starts each view in catalogue order with its own
  `Dispatch`. `ChangesPass::activity` holds the render store's activity, and
  the private `Reference` keeps a probe result together with its lease.
  After a committed
  Ready or Unavailable completion, and after `execute` and its write lease end,
  `ChangesPass` runs the optional `ChangeSource::settled` work and waits for it.
  [`src/changes_seed.rs`](./src/changes_seed.rs) skips that work when Serve
  stops, the classification is cancelled, or the head is no longer current.
- [`src/background_batch.rs`](./src/background_batch.rs) defines `Window`, the
  bounded window of the current usage pass, which keeps catalogue order for
  starts, warnings, and failure reports. `Window::start_dispatched` adds a view
  with its `Dispatch`. The window counts only the views that have not handed
  off, and a handoff event lets it start the next view.
  [`src/background_dispatch.rs`](./src/background_dispatch.rs) defines
  `Dispatch`, the window place of one view, which its `Stage` wakes at the
  handoff. `Dispatch::new` creates it from the shared `Stages`.
- [`src/background_stage.rs`](./src/background_stage.rs) defines `Stages`, the
  batch bound, the completion bound, and the 4 MiB transient budget that every
  pass of one `UsagePass` shares, and `Stage`, the owner of one eligible miss's
  worker permit, batch place, completion place, and transient charge. `Stage`
  implements the graph's `Completion`. Its handoff takes a charge without
  waiting, then takes a completion place through the crate-private
  `Stage::enter`, also when the charge does not fit. A granted charge releases
  the worker and the batch place and wakes the window. The private
  [`src/background_admission.rs`](./src/background_admission.rs) admits each
  miss to the batch with a fresh capacity reading.
- [`src/background_capacity.rs`](./src/background_capacity.rs) defines
  `BackgroundCapacity`, the changing bound of the batch and the completion
  stage, and `FixedCapacity`.
- [`src/work.rs`](./src/work.rs) defines `Work` and `Workers`, the bounded
  render scheduler that HTTP and background renders share.
  `Work::parallelism` gives the fixed worker count that bounds the window, and
  `Work::background` runs one view with its `Dispatch`.
  `Workers::with_activity` takes the `WriteActivity` of the render store, and
  each queued or active job, native work included, holds a lease of it. A
  file response holds its lease until the file opens, and its body streams
  after that.
  [`src/work_background.rs`](./src/work_background.rs) runs the lookup job of
  one background view and, after a miss, its resumed job, in
  `RenderClass::Background`. One lease and one count of
  [`src/work_active.rs`](./src/work_active.rs) pass from the lookup job to the
  resumed job, so `Workers::stop` waits for both jobs. The
  [lookup and miss](./background.md#lookup-and-miss) guidance gives their
  order.
- [`src/comparison_store.rs`](./src/comparison_store.rs) defines `Comparisons`
  and `MemoryComparisons`, the bounded selected comparison generations.
  `MemoryComparisons::with_activity` takes the same activity, and each queued
  capture and its detached native work hold a lease.
- [`src/render_request.rs`](./src/render_request.rs) and
  [`src/preview.rs`](./src/preview.rs) validate live prop requests and define
  `PreviewStore` and `MemoryPreviews`.
- [`src/shutdown.rs`](./src/shutdown.rs) defines `Lifecycle`, the ordered
  shutdown hooks.
- [`src/assets.rs`](./src/assets.rs) defines `ViewerAssets` and
  `PackageAssets`, the built viewer inventory. The shell stub comes from
  [`mokly-model`](../mokly-model/src/shell.rs).

- [`src/comparison_collector.rs`](./src/comparison_collector.rs) defines `CheckedCollector`, whose worker-side encoder checks frozen document and resource digests before capture.
- [`src/comparison_graph.rs`](./src/comparison_graph.rs) defines
  `FrozenResources`, which checks frozen document and resource hashes for the
  generation that it wraps.
  [`src/comparison_head.rs`](./src/comparison_head.rs) gives it the head
  validation methods. It forwards `validate_head` to the wrapped generation,
  checks each `validation_document` read against the frozen document digest,
  and answers `validation_identity` for head proofs.

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md) and its
  [background pass](../../docs/protocol/mokly-on-demand-background.md).
- [Selected comparisons](../../docs/protocol/mokly-selected-comparisons.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Render store](../../docs/protocol/mokly-render-store.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
