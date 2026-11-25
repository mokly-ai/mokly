# Serve modules

The [crate README](./README.md) describes the public entry points and usage.

- [`src/json_delivery.rs`](./src/json_delivery.rs) defines `JsonBody`,
  `GzipFiles`, and `Gzip`, the negotiation and the shared encoding of
  [JSON compression](./delivery.md#json-compression). `accepts_gzip` reads
  every `Accept-Encoding` line. An explicit `gzip;q=0` refuses gzip, also when
  `*` accepts it.
- [`src/backend.rs`](./src/backend.rs) defines `Documents` and
  `GraphDocuments`, the graph-backed documents and read-time confinement.
  `Documents::generated` reads a declared document, `Documents::stylesheet`
  reads a generated stylesheet with its `ETag`, and
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
  `AuthoredAssets`, the [authored file](./delivery.md#authored-files) validator
  records of one generation. `AuthoredRequest` holds the route gate before a
  worker prepares its copy.
- [`src/asset_file.rs`](./src/asset_file.rs) defines `CaptureWriter`, which
  can hash bytes while it writes a temporary copy.
- [`src/validator.rs`](./src/validator.rs) computes the strong SHA-256 `ETag`
  of a resource, and `validator::deliver` answers a matching `If-None-Match`
  with 304. A `*` or the weak form of the tag also matches.
- [`src/asset_streams.rs`](./src/asset_streams.rs) defines `AssetStreams`,
  `TemporaryAssets`, `AssetRequest`, `AssetResult`, and `SharedAsset`, the
  captured asset. Generated responses can share its verified `AssetVersion`
  while the capture is active.
- [`src/backend_assets.rs`](./src/backend_assets.rs) keeps the weak route
  entries and the shared capture result that `GraphDocuments::asset_request`
  reserves before worker admission. The generation's digest supplies its
  `ETag` after verification.
- [`src/asset_response.rs`](./src/asset_response.rs) defines
  `asset_response::deliver`, which revalidates or streams an asset capture.
  Authored JSON can use a request-owned gzip copy.
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
  `AfterUsage::prepare` moves the pending base preparation of the origin's
  head attempt into the pass as a `PendingChanges`, through
  `ChangeSource::pending`. The pass calls `PendingChanges::dispatched` after it
  starts the last view, and `PendingChanges::cancel_and_join` when its
  Changes work ends or the pass is replaced. `ChangesPass` calls
  `ChangeSource::settle_pending` after each classification.
- [`src/background_batch.rs`](./src/background_batch.rs) defines `Window`, the
  bounded window of the current usage pass, which keeps catalogue order for
  starts, warnings, and failure reports. `Window::start_dispatched` adds a view
  with its `Dispatch`. `Window::settle` releases the held reports. The window
  counts only the views that have not handed off, and a handoff event lets it
  start the next view.
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
  `MemoryComparisons::with_activity` takes the same activity, and each queued
  capture and its detached native work hold a lease.
- [`src/comparison_routes.rs`](./src/comparison_routes.rs) answers the
  selection, the root, and the files of comparison generations. It negotiates
  gzip for each JSON response.
- [`src/render_request.rs`](./src/render_request.rs) and
  [`src/preview.rs`](./src/preview.rs) validate live prop requests and define
  `PreviewStore` and `MemoryPreviews`.
- [`src/preview_route.rs`](./src/preview_route.rs) answers the live prop
  render route and the files of temporary previews.
- [`src/shutdown.rs`](./src/shutdown.rs) defines `Lifecycle`, the ordered
  shutdown hooks.
- [`src/assets.rs`](./src/assets.rs) defines `ViewerAssets` and
  `PackageAssets`, the built viewer inventory, and `Stylesheet`, a generated
  stylesheet with its `ETag`. It gives each viewer file the type of
  `delivered_content_type` in
  [`mokly-content-types`](../mokly-content-types/src/lib.rs). The shell stub
  comes from [`mokly-model`](../mokly-model/src/shell.rs).

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
