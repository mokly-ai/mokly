# mokly-sidecar

`mokly-sidecar` is the Rust client and process pool for Mokly's optional Node
render sidecar. Catalogue and render services depend on its `SidecarPool`
trait. `mokly-model` owns shared schemas. `mokly-platform` owns process trees.
The Node implementation lives in `@mokly/mokly`.

## Responsibilities

- Type each request, result, event, and source diagnostic.
- Bound UTF-8 NDJSON frames to 64 MiB of JSON bytes.
- Start Node lazily and require an exact-version hello.
- Queue requests fairly, spread independent calls, admit default growth by
  memory, and grant call claims.
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
parsed `NonZeroUsize` and timeout override. An explicit count is exact. A
default pool always admits its first sidecar. It adds another only when
available memory holds the unused budgets of its sidecars, the budgets that
call claims hold, the new budget, and spare memory. Reserved slots stay through
recycling, failed-worker replacement, and root changes. Serve admits each call
with a claim on the same capacity, and a claim that starts no new slot ends
with its call. The
[memory contract](../../docs/protocol/mokly-sidecar-memory.md) owns these rules.

`Pool::new` keeps the supplied size exact. For a default size, the composition
root calls `Pool::with_memory_admission` with `dyn HostMemory`.
`PoolCapacity::capacity` reads the same prospective capacity that reserves new
slots, and it holds nothing. `PoolCapacity::try_claim` returns
`Err(Error::Cancelled)` when the pool has stopped, as a request to a stopped
pool does. It returns `Ok(None)` for a temporary shortage, when the live claims
fill the capacity. Otherwise it atomically holds a place for one call in a
`CallClaim` and returns `Ok(Some(claim))`.
`SidecarPool::request_claimed` runs a call with its claim. When that
call starts a new slot, it takes a held budget without a new memory check.
Dropping the `CallClaim` ends the claim.

`WorkerFactory::spawn` returns `Spawned` or a `SpawnFailure`. The
`SpawnFailure::NotStarted` variant means that the factory created no child
process. The `SpawnFailure::Started` variant means that a failure came after
the child process started. Each variant holds the original `Error`, and
`into_error` returns it. The pool gives its caller the same error for both
variants.

In a default pool, admission counts the whole budget of a new slot until the
factory returns. When the factory returns `Spawned` or a `Started` failure, the
slot keeps its reservation, also when hello fails after that. When a call ends
before a process starts in its new slot, for example after `NotStarted`, the
pool frees that slot. A free slot is not a reservation. In a default pool, a
later start in it needs admission again. The pool also removes the PostCSS
context affinities of the slot, so a later call of that context can take
another slot. When the start used a held budget, the pool returns that budget
to the claim that held it, if that claim is still live.

`MemoryEstimate` combines `dyn HostProbe` and `dyn MemoryLimits`.
`SysinfoMemory` reads physical total minus used memory. On Linux,
`CgroupMemory` reads finite v1 or v2 controller limits through `dyn MemoryFiles`.

Every bundle result includes its compiled recipe. The pool retains these
recipes, CSS Modules maps, and resolved handle tables. A new process restores
old code without compiling changed sources.
Epoch-specific releases retain newer lifetimes with the same id. Releases
record state without waiting for a worker. An idle cleanup worker sends
disposal to each affected slot. Busy slots apply it before their next request.
Each worker keeps the request source root as its working directory for its
whole lifetime. A change of source root replaces the worker before replay.
Independent requests prefer an idle worker in the same source root, then an
unspawned slot, then the oldest idle slot. Among the idle workers of one root,
a call that names a generation prefers a worker that holds its current epoch
and each input that the call needs, then another worker with that epoch.
A head bundle prefers the idle head worker that compiled last, then older
compilers, under the
[head bundle rank](../../docs/protocol/mokly-sidecar-root-scheduling.md#head-bundle-affinity).
A successful head bundle counts as a compile unless its `cache` field is
`memory` or `hit`. A new process starts without a compile. Ties and other
calls without a generation keep queue order. A call can use another available
slot while the worker that holds its generation is busy. The launch root is
the head root.
A base request takes the warm head worker only when no other slot is
available. That worker bundled the newest head generation, or rendered it last
after a successful render request. A warm-up replay does not move it. The pool
bound covers all roots.
Replacement drops the old root's affinities for that slot and emits one debug
event. PostCSS context affinity prevents duplicate workers. A busy affine
request does not block independent work on another available slot. Returning
slots recheck pending releases before becoming idle. `cancel_requests` kills
and reaps busy sidecars before `shutdown` drains idle sidecars. Scheduling,
the generation rank, and cleanup use one staleness rule: a missing bundle or a
missing or different epoch makes a loaded generation stale. The rank counts a
missing record as not loaded. Cleanup stops when a pass changes no state.

Serve, in `mokly-cli`, schedules one return pass after each Changes
publication and drives the pass from its own background worker. The pool owns
each step and the stop state. Each step takes one idle base worker while no
base request waits. It kills and reaps that worker, then starts a head worker
through hello. A waiting request takes the slot at a safe point. While the
pass has candidates, a base request prefers an idle worker of its root that
already left the pass. The generation rank orders workers only inside that
group and the candidates. When a step cannot confirm a reap, only that slot
retires: its control stays registered, and the pool never reuses the slot. The
first failed reap also ends background return for the life of the pool. The
other slots keep serving requests and switch roots on demand. A call affine to
a retired PostCSS slot fails as unavailable at once. When no usable slot
remains, as in a one-slot pool, the pool stops. The
[source root scheduling contract](../../docs/protocol/mokly-sidecar-root-scheduling.md)
owns these rules.

The pool keeps the last 30 successful render requests of the newest head
generation, and no replay. After the return pass starts a head worker, the next steps warm
it up while no request waits and Serve holds no claim. A warm-up sends the
missing `restoreGeneration`, `cssModules`, `describe`, and `bindings` calls,
then replays the recorded renders, one call at a time, and discards each
result. Each warm-up call sets `Request::quiet`, so the sidecar drops the
console and output writes of the code that the call runs, and its timing
records still appear. `Request::quiet` has no default, so each request builder
chooses it. A request takes the worker after the call in flight, and the warm-up
continues later. A newer head generation, a stop, a failed call, or another
loaded head generation ends it. A failed call keeps or replaces the worker as
a failed request does. The
[return warm-up contract](../../docs/protocol/mokly-sidecar-return-warmup.md)
owns these rules.

After the final release of a generation with captured reuse evidence, the
pool keeps its bundle settings, module graph, compiled code, input digests,
and directory lists in a bounded memory store. Captured evidence is complete
and carries no marker. The pool also keeps a Serve edit generation with a
toolchain identity whose evidence holds only the `uncaptured` marker. The
final release of an unmarked incomplete generation removes the older entry
with equal settings and keeps nothing. The
[compiled recipes contract](../../docs/protocol/mokly-sidecar-recipes.md)
owns the retention rule and the bound. Each entry costs the bytes of its
serialized `restoreGeneration` envelope, with its private seed id and
without the LF delimiter. `MAX_FRAME_BYTES` bounds the total. A use counter,
not a clock, orders eviction. Keeping or seeding an entry counts as a use.
Before a `bundle` call, the pool restores the stored entry with equal
settings under a private seed id. It then prepares the first live generation
with equal settings: a captured generation before a marked one, then the
highest epoch. The generation id breaks a tie. The `BundleCapture` of the
call admits each seed. A `Full` call takes only captured seeds, and a
`ServeEdit` call also takes marked ones. When the stored seed is marked and
the live seed is captured, the pool prepares the live seed first. An unmarked
incomplete generation never seeds a `bundle` call. After a captured live
seed, a `ServeEdit` call also prepares the newest admissible marked live
generation. Thus an older captured generation cannot hide the edit fallback
on another worker. Captured candidates still take priority in the sidecar's
reuse check.
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
`StoreState`. `ReusableRecipe::new` accepts a compilation with captured reuse
evidence. It also accepts a Serve edit compilation with a toolchain identity
whose evidence holds only the `uncaptured` marker, with `complete` and
`durable` false and no inputs. `DurableRecipe::new` accepts only a recipe
whose evidence is captured and durable, with no marker, so no store caller
can write or read a compilation without a stable capture.
`DurableRecipe::with_plan` keeps the optional `ResolutionPlan` of the
compilation beside the recipe, only when the plan and the evidence fit
`RECORD_BYTES` together.
`disk_seed_request` builds the `restoreGeneration` request of a stored
`DurableRecipe`. Live generations keep their `CompiledGeneration` for
explicit restoration. `mokly-compare` implements the store over the OS cache.
The
[bundle cache contract](../../docs/protocol/mokly-base-cache.md#bundle-entries)
owns the entry, fault, and lock rules.

`Pool::with_bundle_store` adds an optional `BundleStore` to the pool. It
starts no process and reads no file. A pool with a store sets
`Launch::capture_durability` for each worker that it starts, so `NodeFactory`
sends a `CaptureHint` in `hello`. Without a store, the sidecar records no
capture witnesses and proves no capture stable. When a `bundle` call has no
live or released seed that its capture admits, the pool loads the entry of
its settings from the bundle store, in both capture modes. On a hit, it
restores the entry with `disk_seed_request` under a private `disk:` seed id
before the request. The pool reads the store at most
once for each call, also when the call runs again after a crash or a timeout.
A failed restore invalidates that publication, and the result reports
`damaged`, or `unavailable` when that removal finds the store unusable. A
worker records the count of `esbuild` operation events of each `bundle`
request in a result field that never crosses the wire. After a successful
`bundle` call, the pool uses that count to set the `cache` field of the
result, which also never crosses the wire. A count of zero gives `hit` when
the runtime key of the result equals the key of the disk seed of the
request. Otherwise, a count of zero gives `memory`. A positive count gives
the reason why the sidecar compiled. When the result holds the restored
stored compilation, the pool also adds the stored plan of that entry to the
result. A `Full` call then offers the served recipe, with the plan of the
result, to `save` when its reuse evidence is captured and durable. A
`ServeEdit` call offers nothing. The store decides whether to write it. The
pool keeps no record of earlier store calls, and it calls the store outside
its mutex. Without a store, the pool reads and writes no entry,
and a compile without a memory seed reports `unavailable`.

The core calls `SidecarPool::served_generation` with the id and the epoch of a
live generation when it serves that generation without a `bundle` call, but
only in the `Full` capture mode. The pool then offers the recipe of that
generation to `save` in the same way. It offers nothing after a stop or after
the release of that epoch. The method returns no error.

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
standard error. It returns `SpawnFailure::NotStarted` for a failure before the
Node process exists. Examples are a missing sidecar entry or source directory,
and a Node executable that cannot start. It returns `SpawnFailure::Started`
when a later step fails, for example when it cannot take whole-tree ownership
or start a pipe task. Shutdown wakes queued callers and sends shutdown to each
process. All processes share one grace deadline. Survivors are killed and
reaped. The [lifecycle contract](../../docs/protocol/mokly-sidecar-lifecycle.md)
owns stderr drainage at that deadline.

The worker and its `WorkerControl` share that monitor. Admission can read
current resident memory during a request without borrowing its session.
Exact pools and default pools at their slot ceiling take no admission samples.

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
inputs, and preserve binding updates across workers. Head bundle affinity
tests check that a head bundle takes the newest idle compiler, or the next
newest while that one is busy. Base bundles keep FIFO order. Memory reuse
neither creates nor raises a compile rank, and a disk hit creates none. After
a recycle, a root switch, or a reap, the new process has no rank. A retired
compiler leaves the surviving compiler preferred. Generation affinity tests
check that a worker with every input that a call needs comes before other
holders and non-holders, with FIFO ties. Stale epochs and missing records
never win the rank. Calls without a generation keep FIFO order while no worker
has a compile, and context
affinity and the pass preference still come first. Parallel renders use every
available slot and start no process. Return warm-up tests check the order of
the preparation and the replays, the bound of 30 calls, the handover to a
waiting request, the pause for a claim, the quiet flag of warm-up calls, the
render count of replays, the warm head after replays, and each end of a
warm-up. Recipe store tests
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
  reuse and `request_claimed` for a call that holds a `CallClaim`, and
  `Pool`, its lazy bounded implementation, with
  `with_bundle_store`. Its `schedule_head_return` and `maintain_head_return`
  methods are the return pass boundary, and `ReturnWake` is the weak wake that
  Serve registers through `observe_head_return`.
- [`src/pool_leases.rs`](./src/pool_leases.rs) defines `Pool::acquire`, the
  root-aware FIFO queue of waiting requests. It protects the warm head worker
  from base requests, removes each taken slot from the return pass, and fails
  a call affine to a retired slot.
  [`src/pool_affinity.rs`](./src/pool_affinity.rs) chooses the slot that a
  request takes. Its pure rank orders the idle slots of one root by the
  generation state that a call needs. For a `bundle` call, it then prefers the
  newest `Slot::last_compilation`, the epoch that `Pool::execute` records
  after a head compile. Growth reuses a free slot before it adds a new one.
- [`src/pool_head.rs`](./src/pool_head.rs) defines `Head`, which holds the
  warm head worker, the candidates of the return pass, the
  `return_disabled` flag, and the warm-ups, and `Pool::record_head`, which
  records each successful head bundle and render request.
- [`src/pool_warmup.rs`](./src/pool_warmup.rs) defines `Warmups`, the
  recorded head render calls and the pending warm-ups, and
  `Pool::maintain_warmup`, which runs one warm-up step when no return step
  can run.
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
- [`src/pool_admission.rs`](./src/pool_admission.rs) defines `PoolCapacity`,
  with the read-only `capacity` and the atomic `try_claim`, and the shared slot
  reservation calculation. [`src/pool_claim.rs`](./src/pool_claim.rs) defines
  `CallClaim`, the call-scoped hold that ends on drop, and the held budgets
  that a claimed call takes when it starts a new slot.
- [`src/pool_start.rs`](./src/pool_start.rs) defines `StartLease`, which holds
  the admission of a new slot until a process starts in it. `Pool::acquire`
  creates a lease only when a call takes a new slot. The lease records the
  claim whose held budget the start used. `Pool::spawn` commits the lease when
  the factory returns `Spawned` or `SpawnFailure::Started`. When an
  uncommitted lease drops, it frees the slot and removes the context
  affinities of the slot. It also returns the held budget to that claim when
  the claim is still live.
- [`src/host_memory.rs`](./src/host_memory.rs) defines `HostMemory`,
  `MemoryEstimate`, and the injected host and process-limit boundaries.
  [`src/cgroup_memory.rs`](./src/cgroup_memory.rs) supplies the Linux limit adapter.
- [`src/pool_recipes.rs`](./src/pool_recipes.rs) defines `Recipes`, the
  bounded store of released compiled recipes with captured reuse evidence or
  the Serve edit marker. It seeds only a recipe that the call's capture admits.
- [`src/pool_releases.rs`](./src/pool_releases.rs) keeps the recipe of each
  final release in that store, and
  [`src/pool_preparation.rs`](./src/pool_preparation.rs) selects the memory
  seeds that each `bundle` call's capture admits, captured seeds first. Its
  `Prerequisites` gives the inputs that each generation call needs, for
  replay and for the rank alike.
- [`src/pool_bundle_cache.rs`](./src/pool_bundle_cache.rs) seeds a `bundle`
  call from the bundle store, keeps the request-local provenance of its disk
  seed, sets the `cache` outcome of its result, and offers the served recipe
  of each `Full` call to the store. The provenance keeps the runtime key and
  the plan of a restored stored compilation. A result with that runtime key
  carries that plan. It reports `hit` when its count of `esbuild` events is
  zero.
- [`src/bundle_store.rs`](./src/bundle_store.rs) defines `BundleStore` with
  `load`, `save`, and `invalidate`, its `ReadOutcome` and `WriteOutcome`, and
  `RecordToken`, the id of one publication.
- [`src/bundle_outcomes.rs`](./src/bundle_outcomes.rs) defines `Effects` and
  `StoreState`, the one exhaustive mapping of each store outcome to its timing
  value, its warnings, and the store state. `Effects::with_entry_fault` adds
  an entry fault to the effects of a write.
- [`src/reusable_recipe.rs`](./src/reusable_recipe.rs) defines
  `ReusableRecipe`, which admits captured reuse evidence or a marked Serve
  edit compilation with a toolchain identity, and
  `disk_seed_request`, the restore request of a stored `DurableRecipe`.
- [`src/durable_recipe.rs`](./src/durable_recipe.rs) defines `DurableRecipe`,
  the only recipe that the bundle store reads and writes. It admits a
  `ReusableRecipe` only when its reuse evidence is captured and durable, with
  no marker. Its `with_plan` keeps an optional plan beside it within the
  record bound.
- [`src/resolution_plan.rs`](./src/resolution_plan.rs) defines
  `ResolutionPlan`, the native import targets of one captured compile, keyed
  by importer, specifier, and import kind, and `PlannedImport`, one target.
  `RECORD_BYTES` is the 8 MiB bound of a plan record and of the records that
  the core keeps. `ResolutionPlan::record_bytes` admits a plan only with
  captured and durable evidence. `bounded_record_bytes` counts a serialized
  value within that bound without building it.
- [`src/capture_hint.rs`](./src/capture_hint.rs) defines `CaptureHint`, the
  private `hello` field that asks the sidecar for capture witnesses, and
  `CaptureVolume`. `CaptureHint::from_volumes` keeps at most 64 volumes from
  `mokly-platform` within 64 KiB.
- [`src/process_factory.rs`](./src/process_factory.rs) defines `NodeFactory`,
  the `WorkerFactory` that starts Node with whole-tree ownership. It sends the
  `CaptureHint` in `hello` when the launch asks for capture durability. Its
  `spawn` decides whether each failure is `SpawnFailure::NotStarted` or
  `SpawnFailure::Started`.
- [`src/process_environment.rs`](./src/process_environment.rs) holds the pure
  environment rule that `NodeFactory` applies to each sidecar command.
- [`src/workers.rs`](./src/workers.rs) defines the injected `WorkerFactory`,
  `Worker`, `Clock`, and `Diagnostics` traits. It also defines `SpawnFailure`,
  the factory error that says whether a child process started.
- [`src/process_clock.rs`](./src/process_clock.rs) and
  [`src/process_memory.rs`](./src/process_memory.rs) define the host
  `SystemClock` and `SystemMemory` that the composition root injects.
- [`src/client.rs`](./src/client.rs) defines `Client`, which performs hello,
  forwards diagnostic events, and decodes each result.
- [`src/codec.rs`](./src/codec.rs) frames NDJSON messages within
  `MAX_FRAME_BYTES`. After each complete frame, its `Decoder` keeps at most
  16 KiB of buffer capacity.
- [`src/methods.rs`](./src/methods.rs), [`src/results.rs`](./src/results.rs),
  and [`src/wire.rs`](./src/wire.rs) define the request payloads, the result
  payloads, and the envelopes of the wire protocol. `BundleRequest` flattens
  the persisted `Bundle` settings and adds the optional request-only
  `BundleCapture`, `Full` by default or `ServeEdit`, and the optional
  request-only `plan` of a Serve edit. `results::Bundle` carries the optional
  `plan` beside `compiled`. Pool state, store calls, and restore requests take
  only the `Bundle` settings. A successful `Response`
  keeps its result as owned raw JSON until `decode_result` decodes the type of
  the pending request. The private [`src/wire_decode.rs`](./src/wire_decode.rs)
  decodes each envelope field by field, with no generic JSON tree.
  `results::Bundle` and the `RestoreGeneration` of
  [`src/compiled.rs`](./src/compiled.rs) hold the compilation in an `Arc`, and
  a compilation holds its `ReuseEvidence` in an `Arc`. Pool records, store
  offers, and restore requests share the compilation instead of copying it.
  `ReuseEvidence` can carry the `UncapturedEvidence` marker of a deliberate
  Serve edit omission. Its `captured`, `serve_edit`, and `reusable` methods
  decide which candidates a call admits.
- [`src/definitions.rs`](./src/definitions.rs) defines `Definitions`, the
  inventory that `describe` returns.
- [`src/error.rs`](./src/error.rs) defines `Error`, the fail-closed error
  categories.
- [`src/typescript.rs`](./src/typescript.rs) provides `generate`, which
  returns the Node declaration modules of the wire types.

### Related Docs

- [Sidecar contract](../../docs/protocol/mokly-sidecar.md).
- [Bundle cache entries](../../docs/protocol/mokly-base-cache.md#bundle-entries).
- [Compiled recipes and capture modes](../../docs/protocol/mokly-sidecar-recipes.md).
- [Serve edit plans](../../docs/protocol/mokly-sidecar-plans.md).
- [Cancellation and timeouts](../../docs/protocol/mokly-sidecar-lifecycle.md).
- [Memory admission and sampling](../../docs/protocol/mokly-sidecar-memory.md).
- [Timing records](../../docs/protocol/mokly-sidecar-timings.md).
- [PostCSS contexts and evidence](../../docs/protocol/mokly-sidecar-postcss.md).
- [Definition transport](../../docs/protocol/mokly-sidecar-definitions.md).
- [Render records](../../docs/protocol/mokly-sidecar-render-records.md) and
  [module sources](../../docs/protocol/mokly-sidecar-modules.md).
- [Source root scheduling](../../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
