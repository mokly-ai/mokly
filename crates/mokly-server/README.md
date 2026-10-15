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
An error in one hook does not skip later hooks.

`Projector` implements `dyn SnapshotFactory`. It projects one fixed revision
from graph plans without rendering a document. Every JSON response has canonical
bytes. `Publications` supplies one complete snapshot per read and update, including its
matching document backend. `FixedPublication` retains revision 1.
`SharedPublication` installs later revisions in one step and emits each update
in order. Its subscription captures the initial state and receiver under one
lock. A superseded revision admits no queued live render. Watch and Changes
use these same boundaries.

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the same
document. Public authored reads require both reached closure membership and a
fresh policy check. `ConfinedReader` opens each directory and the final regular
file without following symlinks. Routes never fall back to repository files.
The built viewer's browser manifest lists the only client modules served.

All routes require an exact loopback Host with an explicit decimal port.
Render POST also requires the exact HTTP Origin and the process render token.
Every response uses `no-store` and `nosniff`. No route adds a CORS header.

Temporary renders validate the installed revision, view, controls, and complete
props. They use the graph's isolated prop render path outside the HTTP event
loop. `MemoryPreviews` holds at most 16 bundles and 32 MiB for five minutes.
Authenticated expired ids return 410. Foreign or malformed ids return 404.
No temporary bytes enter a source file, the catalogue, or its render cache.

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
- [Viewer inventory](./src/assets.rs) and [shell stub](./src/stub.rs).

### Related Docs

- [Shell delivery](../../docs/protocol/mokly-shell-delivery.md).
- [Runtime](../../docs/protocol/mokly-runtime.md).
- [Live controls](../../docs/protocol/mokly-component-controls.md).
- [Public closure](../../docs/protocol/mokly-public-closure.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
