# mokly-sidecar

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-sidecar` is the Rust client and process pool for Mokly's optional Node
render sidecar. Catalogue and render services depend on its `SidecarPool`
trait. `mokly-model` owns shared schemas. `mokly-platform` owns process trees.
The Node implementation lives in `@mokly/mokly`.

## Responsibilities

- Type each request, result, event, and source diagnostic.
- Bound UTF-8 NDJSON frames to 64 MiB of JSON bytes.
- Start Node lazily and require an exact-version hello.
- Queue requests fairly and spread independent calls across the pool.
- Enforce deadlines, retry, recycling, and bounded shutdown.

## What This Crate Does

`Client` consumes `dyn Transport` and `dyn Events`. It requires hello before
commands, checks response ids, forwards diagnostic events, and decodes each
result against the pending method. Protocol failures close the session.
Authoring diagnostics retain their codes and leave a healthy session usable.

`Pool` consumes `dyn WorkerFactory` and `dyn Clock`, and implements
`SidecarPool`. Constructing it starts no process. FIFO order per eligible slot bounds active
processes to `PoolOptions::size`. The CLI resolves `--sidecars`, `MOKLY_SIDECARS`, and the core count.
`PoolOptions` takes the parsed `NonZeroUsize` and timeout override.

The pool retains compiled recipes, CSS Modules maps, and resolved handle
tables. A new process restores old code without compiling changed sources.
Epoch-specific releases retain newer lifetimes with the same id. Releases
record state without waiting for a worker. An idle cleanup worker sends
disposal to each affected slot; busy slots apply it before their next request.
PostCSS context affinity prevents duplicate workers. A busy affine request
does not block independent work on another available slot. Returning slots
recheck pending releases before becoming idle. `cancel_requests` kills and reaps
busy sidecars before `shutdown` drains idle sidecars.
Bundle results include the digests of the bytes consumed by each module.
An optional evaluation digest isolates CSS Modules and resolved configuration
lifetimes. CSS source text belongs to stylesheet nodes. JavaScript bundle
identity includes its module edges, loader inputs, and evaluation digest.
PostCSS contexts have explicit source and resolution inputs and independent
disposal. A timeout or crash kills the process and
retries once. Other transport failures replace the process without a fallback
render. A process recycles after 500 render calls or above 1 GiB resident
memory across the sidecar and its Node descendants, including PostCSS
children. Native helper memory is excluded when the sidecar executable is
known. Parent-only scans use a temporary table at spawn, after `processCss`,
and every 64 samples. The persistent table retains only owned processes and
refreshes their memory and executable identities. Canonical paths handle Node
symlinks. A fresh worker gets one request before memory recycling. Repeated
memory pressure doubles the replacement's check delay up to 500 completed
requests and emits one notice per pressure episode. A sample at or below the
bound restores normal checks. The 500-render rule always applies. Recycling
starts after the in-flight request completes.

`NodeFactory` inherits the environment and repository working directory. It
uses a persistent launch thread for Linux parent-death signals. The Node
watchdog observes parent death and pipe closure outside the render thread.
PostCSS children use the same protection, including historical contexts. It
uses `dyn ProcessGroups` for whole-tree ownership, bounded pipe tasks for
transport, `dyn Wait` for monotonic deadlines, `dyn MemoryFactory` for a
per-worker `dyn ResidentMemory` monitor, and `dyn Diagnostics` for events and
standard error. Shutdown
wakes queued callers and sends shutdown to each process. All processes share
one two-second grace deadline. Survivors are killed and reaped.

Expected PostCSS errors carry typed configuration, plugin, or dependency data.
The core presents their catalogued code and text. Request diagnostics use
logical stylesheet paths and module-and-export render labels. PostCSS syntax
errors keep the logical source coordinate and reason. `abort` kills process trees
without the graceful deadline when the command receives a second signal.

## Quick Start

```bash
npm run build
cargo test -p mokly-sidecar
```

The executable composition root constructs `SystemClock`, `SystemMemory`,
`SystemProcessGroups`, its diagnostic reporter, and `NodeFactory`. It injects
that factory into `Pool`, then consumes the pool through `dyn SidecarPool`.
Direct native runs must set `MOKLY_NODE_EXECUTABLE` to the real Node binary
when PATH supplies a launcher that starts Node as a child. Such a launcher
cannot identify Node descendants for memory recycling.
Pass the installed `dist/sidecar.js` path, repository root, Node executable,
and binary package version in `Launch`.

## Development

```bash
cargo clippy -p mokly-sidecar --all-targets -- -D warnings
cargo xtask generate-types
```

Unit tests use `unimock` at process, pipe, clock, and reporter boundaries.
They verify frame limits, hello, correlation, deadlines, retry, recycling,
FIFO order, concurrency bounds, queue cancellation, and UTF-8 diagnostic lines. Real integration tests spawn
the built sidecar and render a component, screen, story, and page.
The `mock` feature exposes the public trait mocks to other crates.

### Key Code

- [Wire methods](./src/methods.rs), [results](./src/results.rs), and
  [definition metadata](./src/definitions.rs).
- [Framing](./src/codec.rs) and [ordered client](./src/client.rs).
- [Pool](./src/pool.rs), [options](./src/pool_options.rs), and
  [process factory](./src/process_factory.rs).

### Related Docs

- [Sidecar contract](../../docs/protocol/mokly-sidecar.md).
- [Definition transport](../../docs/protocol/mokly-sidecar-definitions.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md) and
  [module sources](../../docs/protocol/mokly-sidecar-modules.md).
- [Rust architecture](../../docs/architecture/rust-core.md).

`cargo xtask generate-types` writes one Node declaration module per wire type
under `packages/mokly/src/generated/sidecar/`. Authenticated marker drafts retain their API payload and physical parent.
Collected style records carry CSS and component owner paths. Authored schemas remain raw JSON
until the core validates them. A definition's source path identifies its
helper module separately from the exporting module in its handle. PostCSS
dependencies keep their plugin names and optional directory globs.
