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
the lookup and the miss of each view, the `Stages` bounds and budget, the ready
state, and the write leases of the Changes reference probes.

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
negotiation, HEAD parity, one encode for concurrent and later publication
requests, and a separate encoding for each comparison request.
[Authored capture lifetime tests](./tests/authored_capture_lifetime_tests.rs)
check that sequential requests leave no open temporary copies.
[Generated asset digest tests](./tests/generated_asset_digest_tests.rs)
check that Serve reads the recorded digest after verifying the copy.
[Cache tests](./tests/shared_assets/cache_tests.rs) cover the `ETag` and 304
answers of stylesheets and assets, also after a stylesheet or an authored file
changes at the same URL.
[JSON cache tests](./tests/shared_assets/json_cache_tests.rs) cover the gzip
copy of an authored JSON file and its own `ETag`.
[Comparison cache tests](./src/_tests_/comparison_cache_tests.rs) cover the
immutable generation files and the `no-store` root and selection.

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
  `Publications` for `SharedPublication`, including atomic reads of the
  current snapshot and its gzip cache.
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

See [Serve modules](./code.md) for more entry points.

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
