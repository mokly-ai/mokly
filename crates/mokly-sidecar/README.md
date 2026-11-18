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
- Define the bundle store boundary and the outcomes of compiled recipes that
  outlive a process.

## What This Crate Does

`Client` consumes `dyn Transport` and `dyn Events`. It performs the exact-version
hello, forwards diagnostic events, and decodes each result for the pending
method. The pool completes hello before commands and replaces a worker after
a protocol failure.
Authoring diagnostics retain their codes and leave a healthy session usable.
Description preserves the order of data props and explicit controls, so the
core can carry author order into the read model.

`Pool` consumes `dyn WorkerFactory` and `dyn Clock`, and implements
`SidecarPool`. Constructing it starts no process. FIFO order per eligible slot
bounds active processes to `PoolOptions::size`. The CLI resolves
`--sidecars`, `MOKLY_SIDECARS`, and the core count. `PoolOptions` takes the
parsed `NonZeroUsize` and timeout override.

Every bundle result includes its compiled recipe. The pool retains these
recipes, CSS Modules maps, and resolved handle tables. A new process restores
old code without compiling changed sources.
Epoch-specific releases retain newer lifetimes with the same id. Releases
record state without waiting for a worker. An idle cleanup worker sends
disposal to each affected slot. Busy slots apply it before their next request.
Each worker keeps the request source root as its working directory for its
whole lifetime. A change of source root replaces the worker before replay.
Independent requests prefer an idle worker in the same source root, then an
unspawned slot, then the oldest idle slot. The launch root is the head root.
A base request takes the warm head worker only when no other slot is
available. That worker bundled the newest head generation, or rendered it last
after a successful render. The pool bound covers all roots.
Replacement drops the old root's affinities for that slot and emits one debug
event. PostCSS context affinity prevents duplicate workers. A busy affine
request does not block independent work on another available slot. Returning
slots recheck pending releases before becoming idle. `cancel_requests` kills
and reaps busy sidecars before `shutdown` drains idle sidecars. Scheduling and
cleanup use one staleness rule: a missing bundle or a missing or different
epoch makes a loaded generation stale. Cleanup stops when a pass changes no
state.

Serve, in `mokly-cli`, schedules one return pass after each Changes
publication and drives the pass from its own background worker. The pool owns
each step and the stop state. Each step takes one idle base worker while no
base request waits. It kills and reaps that worker, then starts a head worker
through hello. A waiting request takes the slot at a safe point. While the
pass has candidates, a base request prefers an idle worker of its root that
already left the pass. When a step cannot confirm a reap, only that slot
retires: its control stays registered, and the pool never reuses the slot. The
first failed reap also ends background return for the life of the pool. The
other slots keep serving requests and switch roots on demand. A call affine to
a retired PostCSS slot fails as unavailable at once. When no usable slot
remains, as in a one-slot pool, the pool stops. The
[source root scheduling contract](../../docs/protocol/mokly-sidecar-root-scheduling.md)
owns these rules.

After the final release of a generation with complete reuse evidence, the
pool keeps its bundle settings, module graph, compiled code, input digests,
and directory lists in a bounded memory store. The final release of an
incomplete generation removes the older entry with equal settings and keeps
nothing. The
[compiled recipes contract](../../docs/protocol/mokly-sidecar-modules.md#compiled-recipes-and-release)
owns the retention rule and the bound. Each entry costs the bytes of its
serialized `restoreGeneration` envelope, with its private seed id and
without the LF delimiter. `MAX_FRAME_BYTES` bounds the total. A use counter,
not a clock, orders eviction. Keeping or seeding an entry counts as a use.
Before a `bundle` call, the pool restores the stored entry with equal
settings under a private seed id. It then prepares the complete live
generation with equal settings and the highest epoch. The generation id breaks
an epoch tie. An incomplete generation never seeds a `bundle` call.
Directory membership can change without a change of the content id. The
private seed id keeps a stored and a live recipe with the same content id
apart, so both reach the sidecar's `reuse` check. Bundle results carry the
public content id, never a seed id. Cleanup disposes of the seed when the
slot returns from the bundle request. A reused recipe leaves the store when
it becomes live. Its next final release can keep it again. Only a `bundle`
call loads stored entries. A replay never loads one. A replay still restores
the live generation that a request names, also an incomplete one.
`shutdown`, `abort`, and `cancel_requests` clear the store. A late release
cannot refill a stopped pool. The memory store writes no file. It adds no
configuration, terminal output, operation event, or timing name.

`BundleStore` is the boundary of the bundle cache, which keeps compiled
recipes across processes. `load` returns a `ReadOutcome`. A hit holds the
`DurableRecipe`, the `RecordToken` of its publication, and the outcome of its
access-order maintenance. A miss names its reason. A rejection holds the entry
fault and the outcome of one attempt to remove the rejected entry. `save`
publishes a `DurableRecipe`, or returns `Unchanged` when the entry already
holds its compilation. A save that finds a damaged or unreadable entry still
writes, and it returns `WriteOutcome::EntryFault` with the bounded effects of
the fault and of the write. `with_entry_fault` builds that outcome in one
place, and a cancelled write stays `Cancelled`. `invalidate`
removes only the publication that a `RecordToken` names. Both return a
`WriteOutcome`. The `effects` method
of each outcome maps it once to its `Effects`: the `cache` value of the timing
record, at most one entry warning and one directory warning, and the
`StoreState`. `ReusableRecipe::new` accepts only a compilation with complete
reuse evidence. `DurableRecipe::new` accepts only such a recipe whose evidence
is also durable, so no store caller can write or read a compilation without a
stable capture. `disk_seed_request` builds the `restoreGeneration` request of a
stored `DurableRecipe`. Live generations keep their `CompiledGeneration` for
explicit restoration. `mokly-compare` implements the store over the OS cache.
The
[bundle cache contract](../../docs/protocol/mokly-base-cache.md#bundle-entries)
owns the entry, fault, and lock rules.

`Pool::with_bundle_store` adds an optional `BundleStore` to the pool. It
starts no process and reads no file. A pool with a store sets
`Launch::capture_durability` for each worker that it starts, so `NodeFactory`
sends a `CaptureHint` in `hello`. Without a store, the sidecar records no
capture witnesses and proves no capture stable. When a `bundle` call has no
complete live
or released seed, the pool loads the entry of its settings from the bundle
store. On a hit, it restores the entry with `disk_seed_request` under a
private `disk:` seed id before the request. The pool reads the store at most
once for each call, also when the call runs again after a crash or a timeout.
A failed restore invalidates that publication, and the result reports
`damaged`, or `unavailable` when that removal finds the store unusable. After
a successful `bundle` call, the pool compares the runtime key of the result
with the keys of the seeds and of the generations that the worker already
holds. It sets the `cache` field of the result, which never
crosses the wire, to `memory` or `hit` for a reused compilation, or else to
the reason why the sidecar compiled. Then it offers the served recipe to
`save` when its reuse evidence is complete and durable. The store decides
whether to
write it. The pool keeps no record of earlier store calls, and it calls the
store outside its mutex. Without a store, the pool reads and writes no entry,
and a compile without a memory seed reports `unavailable`.

The core calls `SidecarPool::served_generation` with the id and the epoch of a
live generation when it serves that generation without a `bundle` call. The
pool then offers the recipe of that generation to `save` in the same way. It
offers nothing after a stop or after the release of that epoch. The method
returns no error.

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

`NodeFactory` uses the selected source working directory. It removes every
inherited variable whose name starts with `MOKLY_`, matched without case on
Windows, and `INIT_CWD`, `npm_package_json`, and `npm_config_local_prefix`.
Then it sets `PWD` to that directory and `MOKLY_POSTCSS_PHASES=1`. Other
environment values are inherited, and PostCSS children inherit this
environment. The source directory uses
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
They verify frame limits, hello, deadlines, retry, recycling,
FIFO order, concurrency bounds, queue cancellation, and UTF-8 diagnostic lines.
Replay tests keep complete inputs for fresh workers, omit already loaded
inputs, and preserve binding updates across workers. Recipe store tests
check the seed choice, eviction by use order, the replacement of an entry
with equal settings, the exact envelope bound, and clearing on every stop.
They retain a selected live seed when its final lease ends during restoration.
Real-process recipe tests count esbuild operations. A revert after a
release skips esbuild, a changed input compiles, and a stored and a live
recipe with one content id both stay usable. The shutdown unit tests
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
  catalogue and render services call, with `served_generation` for a core
  reuse, and `Pool`, its lazy bounded implementation, with
  `with_bundle_store`. Its `schedule_head_return` and `maintain_head_return`
  methods are the return pass boundary, and `ReturnWake` is the weak wake that
  Serve registers through `observe_head_return`.
- [`src/pool_leases.rs`](./src/pool_leases.rs) defines `Pool::acquire`, the
  root-aware FIFO queue of waiting requests. It protects the warm head worker
  from base requests, removes each taken slot from the return pass, and fails
  a call affine to a retired slot.
  [`src/pool_affinity.rs`](./src/pool_affinity.rs) chooses the slot that a
  request takes.
- [`src/pool_head.rs`](./src/pool_head.rs) defines `Head`, which holds the
  warm head worker, the candidates of the return pass, and the
  `return_disabled` flag, and `Pool::record_head`, which records each
  successful head bundle and render.
- [`src/pool_return.rs`](./src/pool_return.rs) schedules a return pass and
  runs one step in `Pool::maintain_return`. `Pool::retire_return` kills and
  reaps a worker while its slot stays leased. When it cannot confirm the reap,
  it adds the slot to the retired set, sets `return_disabled`, and returns
  `Error::HeadReturnDisabled` with the original failure. Only the return pass
  caller receives that error.
  [`src/pool_return_spawn.rs`](./src/pool_return_spawn.rs) starts the head
  worker of a step through hello.
- [`src/pool_options.rs`](./src/pool_options.rs) defines `Launch` and
  `PoolOptions`, the launch settings and the pool size and deadline override.
  The pool sets `Launch::capture_durability` when it keeps a bundle store.
- [`src/pool_recipes.rs`](./src/pool_recipes.rs) defines `Recipes`, the
  bounded store of released compiled recipes with complete reuse evidence.
- [`src/pool_releases.rs`](./src/pool_releases.rs) keeps the recipe of each
  final release in that store, and
  [`src/pool_preparation.rs`](./src/pool_preparation.rs) selects the complete
  memory seeds of each `bundle` call.
- [`src/pool_bundle_cache.rs`](./src/pool_bundle_cache.rs) seeds a `bundle`
  call from the bundle store, keeps the request-local provenance of its
  seeds, sets the `cache` outcome of its result, and offers served recipes to
  the store.
- [`src/bundle_store.rs`](./src/bundle_store.rs) defines `BundleStore` with
  `load`, `save`, and `invalidate`, its `ReadOutcome` and `WriteOutcome`, and
  `RecordToken`, the id of one publication.
- [`src/bundle_outcomes.rs`](./src/bundle_outcomes.rs) defines `Effects` and
  `StoreState`, the one exhaustive mapping of each store outcome to its timing
  value, its warnings, and the store state. `Effects::with_entry_fault` adds
  an entry fault to the effects of a write.
- [`src/reusable_recipe.rs`](./src/reusable_recipe.rs) defines
  `ReusableRecipe`, which admits only complete reuse evidence, and
  `disk_seed_request`, the restore request of a stored `DurableRecipe`.
- [`src/durable_recipe.rs`](./src/durable_recipe.rs) defines `DurableRecipe`,
  the only recipe that the bundle store reads and writes. It admits a
  `ReusableRecipe` only when its reuse evidence is also durable.
- [`src/capture_hint.rs`](./src/capture_hint.rs) defines `CaptureHint`, the
  private `hello` field that asks the sidecar for capture witnesses, and
  `CaptureVolume`. `CaptureHint::from_volumes` keeps at most 64 volumes from
  `mokly-platform` within 64 KiB.
- [`src/process_factory.rs`](./src/process_factory.rs) defines `NodeFactory`,
  the `WorkerFactory` that starts Node with whole-tree ownership. It sends the
  `CaptureHint` in `hello` when the launch asks for capture durability.
- [`src/process_environment.rs`](./src/process_environment.rs) holds the pure
  environment rule that `NodeFactory` applies to each sidecar command.
- [`src/workers.rs`](./src/workers.rs) defines the injected `WorkerFactory`,
  `Worker`, `Clock`, and `Diagnostics` traits.
- [`src/process_clock.rs`](./src/process_clock.rs) and
  [`src/process_memory.rs`](./src/process_memory.rs) define the host
  `SystemClock` and `SystemMemory` that the composition root injects.
- [`src/client.rs`](./src/client.rs) defines `Client`, which performs hello,
  forwards diagnostic events, and decodes each result.
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
- [Bundle cache entries](../../docs/protocol/mokly-base-cache.md#bundle-entries).
- [Cancellation and timeouts](../../docs/protocol/mokly-sidecar-lifecycle.md).
- [Memory sampling](../../docs/protocol/mokly-sidecar-memory.md).
- [Timing records](../../docs/protocol/mokly-sidecar-timings.md).
- [PostCSS contexts and evidence](../../docs/protocol/mokly-sidecar-postcss.md).
- [Definition transport](../../docs/protocol/mokly-sidecar-definitions.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md) and
  [module sources](../../docs/protocol/mokly-sidecar-modules.md).
- [Source root scheduling](../../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
