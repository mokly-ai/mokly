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
- Compress JSON for clients that accept gzip.
- Revalidate stylesheets and assets with strong `ETag` values.
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
lack `revision`. A supplied id alone never proves equality.

A detail that a publication builds or changes takes the revision of that
publication. A detail that a publication shares keeps the typed `revision` of
the publication that built it, so this value can be older than the revision of
the snapshot. No response serves the older value, because every served detail
takes the current revision from `RevisionFile`. The `detailId` and the payload
do not depend on the typed value, because the detail identity preimage sets
`revision` to `0`. Three readers use the typed value, and each stays correct:

- [`detail_validation.rs`](../mokly-model/src/detail_validation.rs) in
  `mokly-model` checks only that a current detail has a revision and a removed
  detail has none, and that the revision is at most 9,007,199,254,740,991. An
  older revision meets both rules.
- The rebuild path in [`src/replacement.rs`](./src/replacement.rs) copies the
  revision of an equivalent previous detail into the rebuilt detail. The two
  details are then equal, so the snapshot shares the previous detail. No
  response serves the copied value.
- The current detail fence of
  [`detail_context.rs`](../mokly-model/src/detail_context.rs) in `mokly-model`
  requires the revision of the index. Give it a served detail or the result of
  `Snapshot::detail`, not a stored detail.

A detail that matches no record serializes its
[detail identity](../../docs/protocol/mokly-catalogue-serialization.md#detail-identity)
preimage once. The hash fills only the top-level `detailId` slot, and the
detail replaces only the record of its own kind. `RevisionFile` stores the
bytes around the top-level `revision`, and each response inserts the current
publication's revision. The records drop paths that leave the catalogue. They
hold no snapshot, generation, render backend, or history. A candidate copies
them, so a rejected candidate leaves the live records unchanged.

`UsagePass` and `ChangesPass` run the background work of Serve: current usage
first, then Changes classification against one pinned merge base. A Changes
continuation can also give the pass the base preparation that its command
started early, as a `PendingChanges`. The pass owns that work until its
Changes work ends, so a replaced pass cancels it and waits for it. The
[background work](./background.md) page holds the guidance for their window,
their start order, the lookup and the miss of each view, the `Stages` bounds
and budget, the ready state, and the write leases of the Changes reference
probes.

The [HTTP delivery](./delivery.md) page holds the guidance for the routes, the
generated and authored assets, the cache headers, JSON compression, the
comparison generations, and the temporary previews.

Each `GraphDocuments` captures a `dyn RenderWarnings` hook from its owning
Serve attempt. Saved and temporary renders deliver private composition
warnings before returning their result, including retained warnings on
failure. A background render returns its warnings instead, and a failure keeps
them: `UsagePass` reports them through `Documents::report`, in catalogue
order, directly before a failure's diagnostic. The CLI owns sorting,
deduplication, and attempt fences.
HTTP bodies and public models contain no warning records.

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
[JSON delivery tests](./src/_tests_/json_delivery_tests.rs) cover gzip
negotiation, HEAD parity, and one shared encoding for each publication file and
each comparison generation file.
[Cache tests](./tests/shared_assets/cache_tests.rs) cover the `ETag` and 304
answers of stylesheets and assets, also after a stylesheet or an authored file
changes at the same URL.
[JSON cache tests](./tests/shared_assets/json_cache_tests.rs) cover the gzip
copy of an authored JSON file and its own `ETag`.
[Comparison cache tests](./src/_tests_/comparison_cache_tests.rs) cover the
immutable generation files and the `no-store` root and selection.
[Request order tests](./src/_tests_/background_batch/request_order_tests.rs)
cover the start order of a rebuilt pass and its catalogue-ordered reports and
publication.

### Key Code

- [`src/runtime.rs`](./src/runtime.rs) defines `ServerRuntime`,
  `BoundServer`, and `TokioServer`, the loopback transport.
- [`src/application.rs`](./src/application.rs) defines `Application`, which
  dispatches every HTTP route over the current publication.
- [`src/publication.rs`](./src/publication.rs) defines `Publications`,
  `FixedPublication`, and `SharedPublication`, the atomic public state and its
  ordered updates, and `Delivery`, the snapshot of one publication with its
  gzip bodies. The default `Publications::delivery` keeps no gzip bodies
  between requests.
- [`src/shared_publication.rs`](./src/shared_publication.rs) implements
  `Publications` for `SharedPublication`, with the request record that sets the
  [start order](./background.md#usage-pass) of the next pass.
- [`src/requested_routes.rs`](./src/requested_routes.rs) defines
  `RequestedRoutes`, the request record, which `RequestedRoutes::rebuild`
  hands to the next catalogue.
- [`src/snapshot.rs`](./src/snapshot.rs) defines `Snapshot`,
  `SnapshotFactory`, and `Projector`, the canonical bytes of one revision.
- [`src/replacement.rs`](./src/replacement.rs) provides `reuse_usage` and
  `encode_details`, which retain ready usage and reuse equal details when a
  rebuild projects a new snapshot.
- [`src/evidence.rs`](./src/evidence.rs) and
  [`src/changes.rs`](./src/changes.rs) provide `complete` and `project`, which
  publish usage completion and Changes from the current snapshot.
  [`src/changes_detail.rs`](./src/changes_detail.rs) projects and publishes
  the entry details of one Changes publication.
- [`src/detail_encoding.rs`](./src/detail_encoding.rs) defines
  `DetailEncoder` and `EncodedDetails`, which hash and encode each detail that
  matches no recent record.
- [`src/detail_publication.rs`](./src/detail_publication.rs) defines
  `RecentDetails`, the bounded equality records shared by the publication paths.
- [`src/revision_file.rs`](./src/revision_file.rs) defines `RevisionFile`, the
  shared payload that each response completes with the current revision.
  `RevisionFile::body` gives the payload and the revision as a `JsonBody`.
- [`src/json_delivery.rs`](./src/json_delivery.rs) defines `JsonBody`,
  `GzipFiles`, and `Gzip`, the negotiation and the shared encoding of
  [JSON compression](./delivery.md#json-compression). `accepts_gzip` reads
  every `Accept-Encoding` line. An explicit `gzip;q=0` refuses gzip, also when
  `*` accepts it.
- [`src/backend.rs`](./src/backend.rs) defines `Documents` and
  `GraphDocuments`, the graph-backed documents and read-time confinement.
  `Documents::stylesheet` reads a generated stylesheet with its `ETag`, and
  `Documents::authored` returns the capture of an authored file.
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
- [`src/authored_assets.rs`](./src/authored_assets.rs) defines
  `AuthoredAssets`, the [authored file](./delivery.md#authored-files) captures
  of one generation, which `AuthoredAssets::open` reuses or replaces.
- [`src/validator.rs`](./src/validator.rs) computes the strong SHA-256 `ETag`
  of a resource, and `validator::deliver` answers a matching `If-None-Match`
  with 304. A `*` or the weak form of the tag also matches.
- [`src/asset_streams.rs`](./src/asset_streams.rs) defines `AssetStreams`,
  `TemporaryAssets`, `AssetRequest`, `AssetResult`, and `SharedAsset`, the
  captured asset that concurrent responses share. Its `AssetVersion` holds one
  captured file, its `ETag`, and the gzip copy of a JSON file.
- [`src/backend_assets.rs`](./src/backend_assets.rs) keeps the weak route
  entries and the shared capture result that `GraphDocuments::asset_request`
  reserves before worker admission, and the `ETag` of each route.
- [`src/asset_response.rs`](./src/asset_response.rs) defines
  `asset_response::deliver`, which answers with the gzip copy, a 304, or the
  stream of a generated or authored asset capture.
- [`src/background.rs`](./src/background.rs) and
  [`src/changes_background.rs`](./src/changes_background.rs) define
  `UsagePass` and `ChangesPass`, the background usage and Changes work.
  `UsagePass::fill_window` starts each view in the start order of the pass,
  with its own `Dispatch`.
  `ChangesPass::activity` holds the render store's activity, and
  the private `Reference` keeps a probe result together with its lease.
  After a committed
  Ready or Unavailable completion, and after `execute` and its write lease end,
  `ChangesPass` runs the optional `ChangeSource::settled` work and waits for it.
  [`src/changes_seed.rs`](./src/changes_seed.rs) skips that work when Serve
  stops, the classification is cancelled, or the head is no longer current.
  `AfterUsage::prepare` moves the pending base preparation of the origin's
  head attempt into the pass as a `PendingChanges`, through
  `ChangeSource::pending`. The pass calls `PendingChanges::dispatched` after it
  starts the last view, and `PendingChanges::cancel_and_join` when its
  Changes work ends or the pass is replaced. `ChangesPass` calls
  `ChangeSource::settle_pending` after each classification.
- [`src/background_batch.rs`](./src/background_batch.rs) defines `Window`, the
  bounded window of the current usage pass, which starts views in the order
  that the pass gives and keeps catalogue order for warnings and failure
  reports. `Window::start_dispatched` adds a view with its `Dispatch`, and
  `Window::settle` releases the held reports. The window counts only the views
  that have not handed off, and a handoff event lets it start the next view.
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
  `Work::background` runs one view with its `Dispatch`. `Work::stylesheet` and
  `Work::authored` read a stylesheet or an authored capture with its `ETag` on
  a worker.
  `Workers::with_activity` takes the `WriteActivity` of the render store, and
  each queued or active job, native work included, holds a lease of it. A
  file response holds its lease while a worker reads, captures, or hashes its
  bytes, and its body streams after that.
  [`src/work_background.rs`](./src/work_background.rs) runs the lookup job of
  one background view and, after a miss, its resumed job, in
  `RenderClass::Background`. One lease and one count of
  [`src/work_active.rs`](./src/work_active.rs) pass from the lookup job to the
  resumed job, so `Workers::stop` waits for both jobs. The
  [lookup and miss](./background.md#lookup-and-miss) guidance gives their
  order.
- [`src/comparison_store.rs`](./src/comparison_store.rs) defines `Comparisons`
  and `MemoryComparisons`, the bounded selected comparison generations.
  `Comparisons::gzip_file` reads a generation file with its gzip bytes.
  `MemoryComparisons::with_activity` takes the same activity, and each queued
  capture and its detached native work hold a lease.
- [`src/comparison_routes.rs`](./src/comparison_routes.rs) answers the
  selection, the root, and the files of comparison generations.
- [`src/render_request.rs`](./src/render_request.rs) and
  [`src/preview.rs`](./src/preview.rs) validate live prop requests and define
  `PreviewStore` and `MemoryPreviews`.
- [`src/preview_route.rs`](./src/preview_route.rs) answers the live prop
  render route and the files of temporary previews.
- [`src/shutdown.rs`](./src/shutdown.rs) defines `Lifecycle`, the ordered
  shutdown hooks.
- [`src/assets.rs`](./src/assets.rs) defines `ViewerAssets` and
  `PackageAssets`, the built viewer inventory, and `Stylesheet`, a generated
  stylesheet with its `ETag`. The shell stub comes from
  [`mokly-model`](../mokly-model/src/shell.rs).

- [`src/comparison_collector.rs`](./src/comparison_collector.rs) defines `CheckedCollector`, whose worker-side encoder checks frozen document and resource digests before capture.
- [`src/comparison_graph.rs`](./src/comparison_graph.rs) defines
  `FrozenResources`, which checks frozen document and resource hashes for the
  generation that it wraps.
  [`src/comparison_head.rs`](./src/comparison_head.rs) gives it the head
  validation methods. It forwards `validate_head` to the wrapped generation,
  checks each `validation_document` read against the frozen document digest,
  and answers `validation_identity` for head proofs. The document read of a
  proof is the wrapped document identity, so a proof needs no document read.
  `validation_checks` exports the frozen digest of a checked read.
  `adopt_validation` freezes the kept digest of a proven document when this
  state froze no other digest and the wrapped generation adopts the document,
  so every later read of that document meets the same digest check.

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md), its
  [background pass](../../docs/protocol/mokly-on-demand-background.md), and
  [eager base preparation](../../docs/protocol/mokly-eager-base-preparation.md).
- [Selected comparisons](../../docs/protocol/mokly-selected-comparisons.md) and
  [comparison serving](../../docs/protocol/mokly-comparison-serving.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Render store](../../docs/protocol/mokly-render-store.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
