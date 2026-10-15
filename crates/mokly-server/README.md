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
The transport owns each HTTP connection. Shutdown closes incomplete requests
and event streams before it runs watcher, render, Git, sidecar, and lock hooks.
An error in one hook does not skip later hooks. The CLI reporter receives the
first accept resource failure and the recovery once per backoff period.

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
details are validated and encoded. `Snapshot::detail` supplies the matching
revision to typed consumers. Shutdown fences and drains queued publications.

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

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the same
document. Public authored reads require both reached closure membership and a
fresh policy check. `ConfinedReader` opens each directory and the final regular
file without following symlinks. Routes never fall back to repository files.
The built viewer's browser manifest lists the only client modules served.

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
`dyn PreviewStore`, `dyn Work`, and `dyn Diagnostics` to `Application`. It reserves a listener
through `dyn ServerRuntime` and calls its `dyn BoundServer::run` method with a
stop channel and `dyn Lifecycle` hooks.

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
- [Viewer inventory](./src/assets.rs) and [shell stub](../mokly-model/src/shell.rs).

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
