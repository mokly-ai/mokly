# mokly-sidecar

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
Description preserves the order of data props and explicit controls, so the
core can carry author order into the read model.

`Pool` consumes `dyn WorkerFactory` and `dyn Clock`, and implements
`SidecarPool`. Constructing it starts no process. FIFO order per eligible slot
bounds active processes to `PoolOptions::size`. The CLI resolves
`--sidecars`, `MOKLY_SIDECARS`, and the core count. `PoolOptions` takes the
parsed `NonZeroUsize` and timeout override.

The pool retains compiled recipes, CSS Modules maps, and resolved handle
tables. A new process restores old code without compiling changed sources.
Epoch-specific releases retain newer lifetimes with the same id. Releases
record state without waiting for a worker. An idle cleanup worker sends
disposal to each affected slot. Busy slots apply it before their next request.
Each worker keeps the request source root as its working directory for its
whole lifetime. A change of source root replaces the worker before replay.
Independent requests prefer an idle worker in the same source root, then an
unspawned slot, then the oldest idle slot. The pool bound covers all roots.
Replacement drops the old root's affinities for that slot and emits one debug
event. PostCSS context affinity prevents duplicate workers. A busy affine
request does not block independent work on another available slot. Returning
slots recheck pending releases before becoming idle. `cancel_requests` kills
and reaps busy sidecars before `shutdown` drains idle sidecars. Scheduling and
cleanup use one staleness rule: a missing bundle or a missing or different
epoch makes a loaded generation stale. Cleanup stops when a pass changes no
state.

Bundle results include the digests of the bytes consumed by each module. An
optional evaluation digest isolates CSS Modules and resolved configuration
lifetimes. CSS source text belongs to stylesheet nodes. JavaScript bundle
identity includes its module edges, loader inputs, and evaluation digest.
PostCSS contexts have explicit source and resolution inputs and independent
disposal. A timeout or crash kills the process and retries once under the
[timeout rules](../../docs/protocol/mokly-sidecar-lifecycle.md). Other
transport failures replace the process without a fallback render. A process
recycles under the render-count and resident-memory rules of the
[memory sampling contract](../../docs/protocol/mokly-sidecar-memory.md).
PostCSS timeout diagnostics include phase timings for child spawn,
configuration load, plugin construction, and the latest stylesheet run.

`NodeFactory` uses the selected source working directory and sets `PWD` to it.
It omits `INIT_CWD`, `npm_package_json`, and `npm_config_local_prefix`. Other
environment values are inherited. The source directory uses
`dunce::canonicalize` for Windows path compatibility. A missing source
directory names that directory in the unavailable result. It uses a persistent
launch thread for Linux parent-death signals. The Node watchdog observes
parent death and pipe closure outside the render thread. PostCSS children use
the same protection, including historical contexts. It uses
`dyn ProcessGroups` for whole-tree ownership, bounded pipe tasks for
transport, `dyn Wait` for monotonic deadlines, `dyn MemoryFactory` for a
per-worker `dyn ResidentMemory` monitor, and `dyn Diagnostics` for events and
standard error. Shutdown wakes queued callers and sends shutdown to each
process. All processes share one grace deadline. Survivors are killed and
reaped. The [lifecycle contract](../../docs/protocol/mokly-sidecar-lifecycle.md)
owns stderr drainage at that deadline.

`NodeFactory::with_timings` enables timing through hello and forwards complete
sidecar records through `Diagnostics::timing`. The default leaves timings off.
The [timing records contract](../../docs/protocol/mokly-sidecar-timings.md)
owns the spawn, replacement, and stop spans and their reasons. The CLI redacts
secrets and controls in forwarded timing lines. Records from the sidecar's
timing writer retain their original bytes.

Expected PostCSS errors carry typed configuration, plugin, or dependency data.
The core presents their catalogued code and text. Request diagnostics use
logical stylesheet paths and module-and-export render labels. PostCSS syntax
errors keep the logical source coordinate and reason. `abort` kills process
trees without the graceful deadline when the command receives a second signal.

Authenticated marker drafts retain their API payload and physical parent.
Collected styles retain their original CSS bytes. Collected style records carry
CSS and component owner paths. Optional typed rule records carry comparison
owners independently of the delivery owner grouping. Authored schemas remain
raw JSON until the core validates them. A definition's source path identifies
its helper module separately from the exporting module in its handle. PostCSS
dependencies keep their plugin names and optional directory globs. Separate
[PostCSS read evidence](./src/postcss_evidence.rs) carries raw whole-file and
byte-range witnesses, known module paths, optional opened-file identity, and an
explicit incomplete coverage mark.

## Quick Start

The executable composition root assembles the pool. It passes the installed
`dist/sidecar.js` path, the source root, the Node executable, and the binary
package version in `Launch`:

```rust
use std::num::NonZeroUsize;
use std::sync::Arc;

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::Diagnostics;

fn sidecars(
    diagnostics: Arc<dyn Diagnostics>,
    launch: Launch,
    size: NonZeroUsize,
) -> Arc<dyn SidecarPool> {
    let clock = Arc::new(SystemClock::new());
    let factory = NodeFactory::new(
        Arc::new(SystemProcessGroups),
        clock.clone(),
        diagnostics,
        Arc::new(SystemMemory),
    );
    let options = PoolOptions {
        size,
        timeout_ms: None,
    };
    Arc::new(Pool::new(Arc::new(factory), clock, launch, options))
}
```

Direct native runs must set `MOKLY_NODE_EXECUTABLE` to the real Node binary
when `PATH` supplies a launcher. The
[memory sampling contract](../../docs/protocol/mokly-sidecar-memory.md)
explains why. Build the packages before the real-process tests:

```bash
npm run build
cargo test -p mokly-sidecar
```

## Development

```bash
cargo clippy -p mokly-sidecar --all-targets -- -D warnings
cargo xtask generate-types
```

`cargo xtask generate-types` writes one Node declaration module per wire type
under `packages/mokly/src/generated/sidecar/`.

Unit tests use `unimock` at process, pipe, clock, and reporter boundaries.
They verify frame limits, hello, correlation, deadlines, retry, recycling,
FIFO order, concurrency bounds, queue cancellation, and UTF-8 diagnostic lines.
Replay tests keep complete inputs for fresh workers, omit already loaded
inputs, and preserve binding updates across workers. The shutdown unit tests
control exit and drain independently through `WaitMock`. Command stderr tests
acknowledge all forwarded bytes before shutdown and check bounded pieces and
process reaping. Direct sidecar tests check graceful exit code 0 and the final
partial stderr tail without the core's grace timer. A real `NodeFactory` test
holds the final stderr piece until the drain wait starts, then checks EOF
delivery and completion with an injected `Wait`. Other real integration tests
spawn the built sidecar and render a component, screen, story, and page. The
`mock` feature exposes the public trait mocks to other crates.

### Key Code

- [`src/pool.rs`](./src/pool.rs) defines `SidecarPool`, the boundary that
  catalogue and render services call, and `Pool`, its lazy bounded
  implementation.
- [`src/pool_options.rs`](./src/pool_options.rs) defines `Launch` and
  `PoolOptions`, the launch settings and the pool size and deadline override.
- [`src/process_factory.rs`](./src/process_factory.rs) defines `NodeFactory`,
  the `WorkerFactory` that starts Node with whole-tree ownership.
- [`src/workers.rs`](./src/workers.rs) defines the injected `WorkerFactory`,
  `Worker`, `Clock`, and `Diagnostics` traits.
- [`src/process_clock.rs`](./src/process_clock.rs) and
  [`src/process_memory.rs`](./src/process_memory.rs) define the host
  `SystemClock` and `SystemMemory` that the composition root injects.
- [`src/client.rs`](./src/client.rs) defines `Client`, which requires hello,
  checks response ids, and decodes each result.
- [`src/codec.rs`](./src/codec.rs) frames NDJSON messages within
  `MAX_FRAME_BYTES`.
- [`src/methods.rs`](./src/methods.rs), [`src/results.rs`](./src/results.rs),
  and [`src/wire.rs`](./src/wire.rs) define the request payloads, the result
  payloads, and the envelopes of the wire protocol.
- [`src/definitions.rs`](./src/definitions.rs) defines `Definitions`, the
  inventory that `describe` returns.
- [`src/error.rs`](./src/error.rs) defines `Error`, the fail-closed error
  categories.
- [`src/typescript.rs`](./src/typescript.rs) provides `generate`, which
  returns the Node declaration modules of the wire types.

### Related Docs

- [Sidecar contract](../../docs/protocol/mokly-sidecar.md).
- [Cancellation and timeouts](../../docs/protocol/mokly-sidecar-lifecycle.md).
- [Memory sampling](../../docs/protocol/mokly-sidecar-memory.md).
- [Timing records](../../docs/protocol/mokly-sidecar-timings.md).
- [PostCSS contexts and evidence](../../docs/protocol/mokly-sidecar-postcss.md).
- [Definition transport](../../docs/protocol/mokly-sidecar-definitions.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md) and
  [module sources](../../docs/protocol/mokly-sidecar-modules.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
