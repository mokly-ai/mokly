# mokly-server

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-server` delivers a local Mokly catalogue over HTTP. Depend on it from
the CLI to serve the browser shell, the public read model, graph documents,
and temporary prop previews. `mokly-graph` owns rendering and resource closure.
`mokly-model` owns public shapes, canonical JSON, and path names.

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
The transport owns each HTTP connection. Shutdown gives event-stream connections
up to 250 ms to flush their final chunk. It then aborts the other connections,
including incomplete requests, before watcher, render, Git, sidecar, and lock hooks.
An error in one hook does not skip later hooks. The CLI reporter receives the
first accept resource failure and the recovery once per backoff period.
The event stream sends an idle comment every 15 seconds during long background
work. Comments carry no publication data and do not cause a shell update.

`Projector` implements `dyn SnapshotFactory`. It projects the initial revision
from graph plans without rendering a document. Every JSON response has canonical
bytes. `Publications` supplies one complete snapshot per read and update, including its
matching document backend. `FixedPublication` retains revision 1.
`SharedPublication` installs later revisions in one step and emits each update
in order. Its subscription captures the initial state and receiver under one
lock. A superseded revision admits no queued live render. Watch and Changes
use these same boundaries.

Evidence revisions share the generation's assets, routes, backend, and shell.
Unchanged detail payloads and index bytes also stay shared. Delivery stamps the
current revision into canonical JSON without copying the payload. Only changed
details are validated and encoded. Source replacements retain ready usage
when its document key is equal. They compare detail values without revision
and share equal payloads and their encoded byte slices across generations. `Snapshot::detail` supplies the matching
revision to typed consumers. Shutdown fences and drains queued publications.
The transport closes clients before lifecycle hooks. The render-cancellation
hook interrupts provider requests before the HTTP worker pool drains them.
The listener stays reserved through sidecar shutdown and final release.

`UsagePass` renders every view in catalogue order after readiness. It yields
between documents and waits while foreground requests need the worker pool.
Document responses queue completion notices without waiting for publication.
One application-owned task coalesces notices and skips recorded routes and
routes with no detail views. A completed background
pass publishes its evidence in one batch. A replacement starts a new pass;
`--no-watch` computes it once. Old backends cannot publish into a replacement.
Workspace lists stay absent until all consumer usage is proven. One unavailable
view keeps every Used by list absent until the next generation. Failed views
publish unavailable usage without inventing empty consumers.
Rebuilds retain ready usage only for equal document keys in the same catalogue
and deployment. Reused usage is already complete, so later completion callbacks
publish no extra revision for those views.

`mokly-model` projects every status from retained model inputs. `mokly-compare`
owns Changes membership, eligibility, workspaces, input changes, and removed
metadata. Serve uses those shared functions and the shared snapshot route builders.

`ChangesPass` continues after current usage settles. It runs the command's
`dyn ChangeSource` outside the HTTP loop. Each status replaces the index and
all current details together. Ready state installs the review pointer, Changes
membership, moved paths, removed records, and per-view evidence in one revision.
Included details carry classification reasons in the review v8 shape even without a workspace.
Non-ready publications remove those reasons with the other comparison evidence.
Capacity is checked before ready-state projection and again at installation.
A full store therefore retries without repeating that projection.
New classification files enter the comparison store after ready-state projection
and before publication. Their retention window starts after projection.
An old head cannot publish into a replacement. Watched Serve polls HEAD and the
base ref once per second. A changed merge base reuses the accepted current
graph; a tip change with the same merge base keeps the published state.
HTTP worker leases keep foreground priority for the whole request. The CLI
shares those leases with base-side sidecar admission. Cancellation listeners
wake blocked admission without changing the process pool's size or deadlines.

`MemoryComparisons` implements `dyn Comparisons`. Classification generations
start with review v8 and removed details. Selected captures project that review
onto one screen or component entry and copy only its view closures. Historical
routes capture the removed entry from the same pinned base. Captures preserve
original document bytes. `FrozenResources` retains document and resource hashes.
It rejects changed public bytes or an inconsistent document after cache eviction
before a capture can install a mixed generation.

Identical pending selections coalesce. Different captures serialize. Admission
allows 32 pending captures and a ten-second deadline. Generations expire after
60 seconds without a read, except the classification JSON that the current
index names. Its snapshot files still expire and can be recaptured from the
retained base handles. GET and HEAD renew retention. The store allows 64
generations, 128 MiB total, and 64 MiB per generation. It rejects capacity
without evicting retained files. A full store delays classification publication
and retries installation without repeating comparison work. Missing generations return 404. Replacement
fences pending selected captures; shutdown cancels and drains all captures.

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the same
document. Public authored reads require both reached closure membership and a
fresh policy check. `ConfinedReader` opens each directory and the final regular
file without following symlinks. Routes never fall back to repository files.
The built viewer's browser manifest lists the only client modules served.

Each `GraphDocuments` captures a `dyn RenderWarnings` hook from its owning
Serve attempt. Saved, background, and temporary renders deliver private
composition warnings before returning their result, including retained
warnings on failure. The CLI owns sorting, deduplication, and attempt fences.
HTTP bodies and public models contain no warning records.

Authored GET responses stream from the confined handle without a file-size
limit. HEAD opens the same handle and sends no bytes. Preview asset copies use
the existing preview-store byte budget. Serve delivers document and preview
HTML without inspector injection. Reached-file checks test membership without
copying the complete set.

All routes require an exact loopback Host with an explicit decimal port.
Render POST also requires the exact HTTP Origin and the process render token.
Every response uses `no-store` and `nosniff`. No route adds a CORS header.

Temporary renders validate the installed revision, view, controls, and complete
props. They use the graph's shared prop render path outside the HTTP event
loop. The CLI supplies the shared JavaScript runtime, so React entries use
the same pool, cache, renderer, PostCSS, and fragment keys as their saved
views. The HTTP token and revision checks apply before that render path.
`MemoryPreviews` holds at most 16 bundles and 32 MiB for five minutes.
Authenticated expired ids return 410. Foreign or malformed ids return 404.
Temporary documents never enter a source file, the catalogue model, or the
saved document cache. Their content-addressed fragments may enter the bounded
fragment cache.

## Quick Start

From the workspace root, build the viewer and run an HTML catalogue:

```bash
npm run build
cargo run -p mokly-cli --bin mokly -- serve --config crates/mokly-graph/tests/fixtures/catalogue/mokly.config.json --no-watch --port 0
```

The composition root supplies `dyn Publications`,
`dyn PreviewStore`, `dyn Work`, and `dyn Diagnostics` to `Application`.
Serve also supplies `dyn Comparisons` and a Changes continuation to `UsagePass`. It reserves a listener
through `dyn ServerRuntime` and calls its `dyn BoundServer::run` method with a
stop channel and `dyn Lifecycle` hooks.

The shared shell declares the Browse brand SVG at
`/mokly-viewer/client/brand.svg`. The asset loader serves the matching packaged
icon for both Serve and static output.

## Development

```bash
cargo test -p mokly-server
cargo clippy -p mokly-server --all-targets -- -D warnings
```

Unit tests use injected boundaries and fake time. Integration tests use a real
HTML graph and loopback sockets. They cover route bytes, headers, fences,
public-file replacement, encoded attacks, previews, and event-stream shutdown.

### Key Code

- [Transport](./src/runtime.rs) and [shutdown hooks](./src/shutdown.rs).
- [HTTP application](./src/application.rs) and [atomic state](./src/snapshot.rs).
- [Graph adapter](./src/backend.rs) and [public reads](./src/public_read.rs).
- [Request validation](./src/render_request.rs) and [preview memory](./src/preview.rs).
- [Background Changes](./src/changes_background.rs), [comparison generations](./src/comparison_store.rs),
  and [foreground request leases](./src/foreground.rs).
- [Viewer inventory](./src/assets.rs) and [shell stub](../mokly-model/src/shell.rs).

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
