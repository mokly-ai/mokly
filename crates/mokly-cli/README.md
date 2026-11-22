# mokly-cli

`mokly-cli` provides the `mokly` binary and is the composition root of the
Mokly Rust core. It owns argument parsing and terminal presentation, and it
wires the other core crates into the `serve`, `build`, and `publish` commands.
The npm shim in `@mokly/mokly` starts this binary with inherited streams. No
other crate depends on it.

## Responsibilities

- Parse `serve`, `build`, and `publish` with clap.
- Use watched Serve when the command is omitted.
- Select plain or rich output and protect terminal diagnostics.
- Keep success and failure exit statuses at 0 and 1.
- Load JSON configuration, validate the catalogue, and render every HTML or
  JavaScript view.
- Compute Changes from a pinned Git base and keep its validated result in memory.
- Compose the bounded view comparison reuse of Serve and admit only accepted
  classifications.
- Keep one captured base in Serve between classifications, and reuse it while
  its key and its freshness checks hold.
- Start the early renders of a fresh base, and end them with their
  classification.
- Compose one rendering runtime, sidecar pool, bundle store, and render cache
  per command, and the render store in Serve.

## What This Crate Does

The [CLI reference](../../docs/guides/cli/options-and-exit-status.md) lists
the commands, the options, the exit statuses, and the error categories. The
[help contract](../../docs/protocol/mokly-terminal-help.md) fixes the help and
version bytes. `--help` and `--version` write plain stdout in every output
mode.

The binary's mimalloc allocator returns freed memory to the operating system
after 30 ms, not after mimalloc's default of 1,000 ms. A valid
`MIMALLOC_PURGE_DELAY` value in the environment keeps priority.

Build and Serve share the same runtime composition. Each command owns one
lazy sidecar pool. `--sidecars` and `MOKLY_SIDECARS` set an exact size.
The default uses the core count as its upper bound and applies the
[memory admission rules](../../docs/protocol/mokly-sidecar-memory.md#default-admission).
Each command also creates one render cache at its entry point and uses it
across catalogue preparation, document rendering, and live prop previews.
The timing layer of `--debug-timings` reads the same cache for its cache
counts. Head and base renders use `mokly_render::runtime::Runtime` with that
shared pool and cache. The render workers of a command are `CaptureWorkers`
over one `ThreadWorkers` pool. Their `PoolCaptureCapacity` limits each capture
window by the current admission bound of the sidecar pool, under the
[capture rules](../../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
The npm shim supplies its package root and Node
executable. Direct binary execution checks the adjacent installed package and
development ancestors, and uses `node` from `PATH` when the shim has not
supplied `MOKLY_NODE_EXECUTABLE`. An HTML-only catalogue without a renderer or
PostCSS starts no sidecar and needs no package lookup result. A configured
renderer contributes its complete bundle source inventory even when the
catalogue has only HTML entries. The browser bundle comes from the matching
installed `@mokly/viewer` package. When the working configuration names a
renderer or PostCSS, base preparation leases an existing extraction of the
base commit before it loads the base configuration, and base reads use it. The
dependency step then reuses that lease, or it extracts the sources and
attaches the new lease before catalogue and graph preparation. Base preparation
passes the working repository root and the repository's cache namespace, the
`DiskCache` root, to `BaseSide`. Base render keys then name their paths without
the checkout folder. The
[terminal errors contract](../../docs/protocol/mokly-terminal-errors.md) owns
the scripts hint of base failures.

Each command also adds the bundle cache to its sidecar pool. `bundle_runtime`
composes `CachedBundles` over a `DiskCache` that the command's cancellation
stops. When `SystemLocations` gives no cache location, the pool gets a store
whose first call reports a store fault, and the store then stays off. The
store prints the entry warning and the directory warning of the
[cache warnings contract](../../docs/protocol/mokly-terminal-cache.md#cache-warnings)
through the command's diagnostics. The bundle cache and the base caches share
one announcement of the cache directory in each command. In `build` and
`publish`, they share one `OnceReporter`, which `render_runtime` returns for
the Changes of the command. Their terminal owner holds that line while the
head renders, under the
[cache directory rule](../../docs/protocol/mokly-terminal-cache.md#cache-directory).
In Serve, the `ServeDirectory` of the bundle cache
and the base cache notice of each comparison attempt share one flag.
`ServeDirectory` does not depend on a comparison attempt. Both write through
`Terminal::cache_notice`. `ServeProgress` holds one such notice while Serve
starts. `Progress::ready` writes the readiness layout and then releases it. A
startup that fails or is cancelled drops the notice, and a later notice prints
at once.
Serve prepares its head in the `full` mode of the
[capture modes](../../docs/protocol/mokly-sidecar-recipes.md#capture-modes)
until it publishes its first state. After successful readiness,
`ServeServices::head_published` switches each later head
preparation to `serveEdit`. Those preparations capture no reuse evidence and
offer nothing to the bundle cache. The base side of Serve, `build`, and
`publish` keep the `full` mode.

Serve also composes the
[render store](../../docs/protocol/mokly-render-store.md). `render_store_runtime`
builds one `DocumentWriter` over the `renders` kind at the same cache location,
with the `CAPACITY` bound, and `Runtime::with_document_store` gives it to the
head and base graphs. The writer reads the native build identity and indexes
the store while Serve starts. `serve_changes` calls `resume` after each
completed Changes result, so the store writes nothing before the first one.
`render_store_runtime::bind` gives the writer the Changes status of the current
publication as its `WriteReadiness`. The sidecar gate and pool, the rebuilds,
the head-return worker, and the server's work, captures, and Changes reference
probes each hold a lease of the writer's `WriteActivity` while they run. So the writer starts new work only
while Serve is idle. The writer prints the cache warnings through the command's
diagnostics, and its state reaches `--debug-timings` as `render.store` records.
`build` and `publish` compose no render store.

Serve validates an HTML, JavaScript, or mixed catalogue before it reserves a
loopback port, then serves it through `mokly-server` under the
[on-demand Serve contract](../../docs/protocol/mokly-on-demand.md). Watched
Serve attaches a `mokly-watch` observer before module evaluation. It prepares
again before adoption only under the
[readiness rule](../../docs/protocol/mokly-watch.md#watch-targets-and-readiness). One
serialized queue handles watch events and the rich-mode `r` shortcut under the
[watch runtime contract](../../docs/protocol/mokly-watch-runtime.md). A valid
candidate replaces the public state and backend with the next revision. A
failed candidate keeps the last good state. After `Catalogue ready`, Serve
completes current usage and classifies Changes against one pinned merge base.
The usage pass starts its views in a sliding window of the worker count. Each
view first looks up its document on the shared render workers, and a cache or
store hit ends there without a batch or completion admission reading. A sidecar
call of its link checks still passes the gate checks below. A miss waits for a
batch place. The completion bound limits only the misses whose own root fragment
returned without failure. The batch and completion bounds read the current
sidecar capacity at each entry, and both use the smaller of that capacity and
the worker count. Both bounds also count the views of a replaced pass that
still render or complete. Both source roots share that capacity. A miss of a
JavaScript entry without saved slots waits for its own root fragment on its
resumed blocking thread. Any other miss keeps its worker permit until it ends
and takes no completion place. Every background view reads or builds its
document on the shared render workers, as HTTP renders, build, and comparison
do. So a view that waits for its own root fragment holds no render worker that
another view needs. A shared admission
gate lets foreground requests finish their sidecar calls before more base
requests start. The gate admits each call with a pool claim, which keeps the
call's place in the capacity until the call ends. Waiting calls of background
views go after the other waiting head calls, and they never wait for a whole
foreground request. After `Source::finished` reports a committed classification,
`BaseCompletion::base_finished` schedules one sidecar return pass. The
`mokly-head-return` worker runs one step of the pass at a time while the gate
is open and no base call waits at it. It holds the pool and the gate only
weakly, so an idle worker keeps neither alive. Each failed step reaches
stderr once through the sidecar `Diagnostics` reporter, and a failed reap
adds the warning that background preparation is disabled. The base preparation
bundles its stylesheet roots on its own thread, not on the shared render
workers. That thread is the classification thread, or the `mokly-base-prepare`
thread of an eager preparation. A base root that waits at the gate then never
holds a worker that a foreground render needs.
`Source::classification_runtime` also gives each classification `CaptureWorkers` with a separate capture pool. That pool
has as many threads as the smaller of the worker count and the admission limit
of the gate, and at least one. So the base capture and the early renders of a fresh base run on render
workers that foreground renders do not use. A base job that waits at the gate
then holds no shared worker, under the
[admission rules](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
Ordinary reads, and every read through the kept base, still run on the shared
render workers.
Changes classification also prepares views on the shared render workers. Those
tasks read only retained base inputs and the head, so they schedule no base
source read and no base sidecar call. A view that needs the base source is
prepared later, in the ordered classification pass.
Serve composes one `comparison_reuse::MemoryComparisons` service for its
lifetime, with the fixed bound of the
[reuse rules](../../docs/protocol/mokly-comparison-serving.md#view-comparison-reuse).
`Source::comparison_attempt` begins each classification's `ReuseAttempt` with
a `ReuseFence` over the adopted configuration, its roots, and the
install-scripts mode. A view whose kept proof still holds is not prepared.
`Source::finished` accepts the attempt after the Ready publication and
discards it after a failure. When an execution ends without `finished`,
`Source::discarded` discards the staging.
Serve captures one warning sink per preparation attempt and
reports each warning once under the
[build warnings contract](../../docs/protocol/mokly-build-warnings.md).
Shutdown follows the [runtime shutdown order](../../docs/protocol/mokly-runtime.md).

Serve keeps at most one captured base between classifications. The
[Serve base lifetime rule](../../docs/protocol/mokly-base-preparation.md#serve-base-lifetime)
owns what Serve keeps, the key, the freshness checks, the cancellation rule,
and the release events. `ServeChanges` owns the one slot, and every `Source`
of the process shares it. Each classification composes its own `ServeBase`
provider around `NativeBase`, and that provider holds only a weak handle of
the slot. A base reader keeps only its exact kept base, its cancellation, and
a `ReleaseBase` capability, which also holds only a weak handle of the slot.
It keeps no provider, so it holds no progress callback of the preparation and
no strong handle of the slot. An old reader can keep only its own base alive.
`ServeBase::find_kept` compares the `BaseKey`, then runs `Freshness::current`
outside the slot lock. A current base returns a reader with the
classification's own cancellation. Another key, a stale check, or a check
error other than a cancellation releases the kept base before the fresh
preparation. A cancelled classification keeps a valid kept base, and the
lookup returns `Error::Cancelled`. A release, which `ServeBase::release` also
makes through `ReleaseBase`, clears the slot only when the slot holds that
exact base, so a late reader cannot clear a newer base.

Only Serve gives `NativeBase` a `Freshness`. With it, `NativeBase` samples the
checkout identity before its first base read and records the evidence of the
preparation. `build` and `publish` take no sample and record no evidence. A
sample or record failure, other than a cancellation, gives no evidence, and
the fresh preparation continues without a kept base. The Git runner, the
source tree, the dependency step, the sidecar pool handle, and the render
workers of a fresh base follow one `PreparingBase` lifetime. Until the keep,
the classification, its capture scope, and the command stop can cancel it.
`ServeBase::keep` installs an eligible base in the slot inside the
classification's commit callback, and it detaches the lifetime there. After
that, only the command stop cancels the work of the kept base. A base that
Serve does not keep stays on the classification lifetime. In every command,
`NativeBase` builds the base runtime with `Runtime::for_base`, so the base
shares the style memo of the head runtime. When the base graph preparation
ends, `NativeBase` applies `BaseRenderAdmission` before it starts the
[early renders](../../docs/protocol/mokly-base-preparation.md#shared-render-runtime)
of the base through `RenderGeneration::prefetch_comparison`. It returns their
`PrefetchGuard` in `PreparedBase`. They never move to a kept base. The
classification holds the guard until the capture of that base returns, so
each exit stops the early renders and waits for them.

Serve also starts the
[eager base preparation](../../docs/protocol/mokly-eager-base-preparation.md)
of each head preparation attempt when its working configuration validates and
the configured sidecar size in `Common::sidecars` is at least three.
`serve_delivery::states` gives that size and the `NativeEagerFactory` to
`EagerStarts::configure`, and `EagerAttempts` keeps the factory only when the
size is at least three. Without that factory, `EagerAttempts::start` starts
nothing, no `Source` has pending work, and `Source::classify_native` prepares
the base serially after the usage pass.
`EagerAttempts` first cancels and joins the pending work of the earlier
attempt. One owned `mokly-base-prepare` thread runs the work under its own
`PreparingBase` lifetime, which the command stop also cancels. A failed or
replaced attempt, the usage pass or classification of its state, and Serve
shutdown end the work with `PendingChanges::cancel_and_join`. That call joins
the thread before it releases the sources and leases. The source phase pins
the base, samples the checkout, loads the base configuration, discovers the
base sources, and reads both clean dependency identities with the extraction
that a sidecar base needs. A complete extraction lease bypasses the cold
source wait. Otherwise discovery, the extraction, and the identity reads wait
through `SourceAdmission` until `ServeServices::head_published` reports the
first successful readiness. The attempts after that readiness do not wait. The
source phase stops after the pin when the key matches the kept base. The
adopted head, after any watch recheck, starts the validation
phase: dependency selection, the install, and graph validation. With a kept
base of another key, that phase also waits for the classification.
`ProvenValidation` holds graph validation until adoption when it cannot prove
the working installation. The work keeps its statuses, steps, cache notices, warnings, and the sidecar text of its base
source root in one `OrderedEvents` record. `Source::pending` hands the work to
the usage pass of its state. The classification adopts it through
`AdoptingBase` only when the key, the head dependency evidence, and the
working inputs are current. Adoption replays the record through the normal
reporting paths, selects the eager lifetime, and binds the classification's
capture workers before the early renders start. Otherwise the classification
prepares serially. A source that a reference refresh creates has no pending
work.

`build` validates the catalogue, renders every view into the bounded process
cache, and captures the head once during the build check under its separate
256 MiB bound. It computes Changes unless `--no-changes` is set. After output
admission, it pins the selected base before catalogue validation and
rendering. Changes, the static index, the generation writer, and publication
metadata read the captured head and the same comparison result.
Viewer modules are validated before consumer rendering. Invalid package
scripts retain their path and parser position in a viewer-package failure.
`mokly-static` writes the output through its exclusive output transaction. The
[static build contract](../../docs/protocol/mokly-export.md) owns the output,
the Changes outcomes, and recovery. Build preparation owns the single
strict-warning check for both `build` and `publish`.

`publish` validates credentials and the committed clean checkout before it
calls the CLI-owned `StaticOutput` adapter. It uses the same build check and
head capture as `build` before Changes and output read the captured head. The
adapter runs the same output transaction as `build` in a private directory
outside the repository and returns the installed bytes with their typed
ownership and upload metadata to one cached upload preparation.
`mokly-publish` owns the exchange. The
[upload contract](../../docs/protocol/mokly-upload.md) owns the checkout
checks, the private directory, and its cleanup.

Build and publish install signal handling before command work. Cancellation
reaches Git, cache waits, installation, source reads, graph planning,
comparison, and document workers, even with no sidecar. A later signal kills
owned sidecars and exits immediately after any active output installation,
restoration, or cleanup settles. Serve uses its own idempotent stop state, and
a normal interruption exits 0. The
[terminal errors contract](../../docs/protocol/mokly-terminal-errors.md) owns
the interrupt outcomes.

One injected terminal writer handles startup, shortcuts, rebuilds, and render
diagnostics. Raw mode preserves carriage returns and ignores shortcut release
events. Catalogue counts include variants. While Changes runs, the comparing
spinner names the current comparison step in Serve, `build`, and `publish`.
The reporter implements output-mode precedence, fixed error
categories, recovery hints, control escaping, token redaction, ASCII fallback,
and display width bounds under the
[terminal output contract](../../docs/protocol/mokly-terminal-output.md).
`--debug-timings` emits the structured spans of the
[timings contract](../../docs/protocol/mokly-timings.md) without source text,
props, or error payloads. `MOKLY_DIAGNOSTIC=1` adds the redacted cause chain
and any supplied sidecar JavaScript stack.

## Quick Start

```bash
cargo run -p mokly-cli --bin mokly -- --help
cargo run -p mokly-cli --bin mokly -- --version
cargo run -p mokly-cli --bin mokly -- build --help
```

The [CLI guides](../../docs/guides/cli/serve.md) show each command in use.

## Development

See the [CLI test guide](./tests/README.md) for crate tests, the design matrix,
and process-recovery fixtures. Publish cleanup tests cover the allocated
private directory and symbolic-link boundaries. The Windows MSVC binary
reserves an 8 MiB main-thread stack through its linker settings in
[`build.rs`](./build.rs), matching Linux and macOS main-thread headroom.
`build.rs` also embeds `MOKLY_NATIVE_BUILD`, a new nonce for each native build,
in the build identity of the render store. Linux adds the digest of the running
executable. Other targets use only the nonce, so `build.rs` names an invocation
marker that never exists. Cargo then runs the build script and relinks the
binary on every build of those targets, also when only a dependency feature
changed.

### Key Code

- [`src/main.rs`](./src/main.rs) and [`src/entry.rs`](./src/entry.rs) start
  the binary, select the command and the output mode, and map the result to
  the exit status.
- [`src/allocator.rs`](./src/allocator.rs) defines
  `return_freed_memory_sooner`, which `main` calls first to make the shorter
  purge delay the mimalloc default.
- [`src/grammar.rs`](./src/grammar.rs) defines `Cli`, `Verb`, and `Common`,
  the clap grammar, and [`src/options.rs`](./src/options.rs) normalizes
  options and environment fallbacks. `Publish.token` and `Environment.token`
  hold a `mokly_publish::redaction::Secret`, so `Debug` output never shows a
  token.
- [`src/render_runtime.rs`](./src/render_runtime.rs) creates the render cache
  and composes the shared JavaScript and HTML rendering services of one
  command. It adds the bundle store to the pool and returns the command's
  cache reporter for the Changes of `build` and `publish`. It also composes
  the host and process-limit estimate for default sidecar admission, and it
  wraps the render workers of the command in `CaptureWorkers`.
- [`src/capture_workers.rs`](./src/capture_workers.rs) defines
  `CaptureWorkers`, which forwards ordinary reads to its inner render workers
  and runs the capture window and the early renders on its capture pool.
  `PoolCaptureCapacity` reads the current admission bound of the process pool,
  which limits each capture window.
- [`src/bundle_runtime.rs`](./src/bundle_runtime.rs) composes the bundle store
  of one command over a `DiskCache` that the command's cancellation stops,
  and maps each store outcome to its warning lines.
- [`src/render_store_runtime.rs`](./src/render_store_runtime.rs) composes the
  render store of Serve: the paused `DocumentWriter` over the `renders` kind,
  its `Startup` identity, its warning lines, and the binding of its
  `WriteReadiness` to the current Changes status.
- [`src/changes_runtime.rs`](./src/changes_runtime.rs) composes the Changes
  service of `build` and `publish`. Its `reporter` gives the one-shot
  `OnceReporter` that the bundle store shares.
- [`src/cache_directory.rs`](./src/cache_directory.rs) defines
  `ServeDirectory`, the cache directory announcement of the bundle cache and
  the render store in Serve. It writes through `Terminal::cache_notice` of
  [`src/terminal.rs`](./src/terminal.rs), which writes at once by default.
- [`src/entry_serve.rs`](./src/entry_serve.rs) and
  [`src/serve.rs`](./src/serve.rs) compose, prepare, and close Serve.
  `entry_serve.rs` passes the terminal output of Serve to
  `ServeServices::new`, and it calls `Progress::ready` with the readiness
  layout inside the serve phase.
- [`src/serve_progress.rs`](./src/serve_progress.rs) defines `ServeProgress`,
  the one terminal owner of Serve. It erases progress before each durable
  line, holds one cache notice until `Progress::ready` writes the readiness
  layout, and drops that notice when startup fails or is cancelled.
- [`src/serve_services.rs`](./src/serve_services.rs) shares one pool and
  cache across Serve preparation and live views. It gives the sidecar gate
  the command's `Diagnostics` reporter. `ServeServices::new` takes that
  `ServeOutput` and creates the one announcement flag of the Serve process.
  `ServeServices::head_published` sets the flag that gives each later head
  preparation the `ServeEdit` capture mode. `entry_serve.rs` calls it after
  the first successful publication and the readiness timing span. That call
  also ends the cold source wait of eager base preparation. Its
  `AttemptPreparation` starts, adopts, and discards the eager base
  preparation of each head attempt through `EagerStarts`.
  [`src/serve_delivery.rs`](./src/serve_delivery.rs) passes that flag to the
  base caches of Serve Changes. Its `states` composes the `NativeEagerFactory`
  and gives it to `EagerStarts::configure` with the configured sidecar size.
- [`src/serve_pool.rs`](./src/serve_pool.rs) defines `ServePool`, which puts
  the admission gate around the shared pool. Its narrow `BaseCompletion`
  capability schedules the return pass. Each head or base handle passes the
  caller's `RenderClass` to the gate and runs the admitted call through
  `SidecarPool::request_claimed`. A handle forwards a store-served record to
  `SidecarPool::record_served_render` without admission or a write lease.
  `ServePool::new` registers the wake of the return worker for head return
  only. `PoolScheduling::eager_pool` gives eager preparation a handle whose
  calls take eager admission until the classification adopts the preparation.
  It also registers that wake through `PoolCapacity::observe_admission`, so a
  Serve without eager preparation receives no pool admission wakes.
- [`src/serve_gate.rs`](./src/serve_gate.rs) defines `Gate`, which admits each
  call with a `CallClaim` from `PoolCapacity::try_claim`. Waiting
  `RenderClass::Background` calls go after the other waiting head calls, and
  base calls also wait for every foreground request. `Gate::acquire_eager`
  admits one eager call at a time with `PoolCapacity::try_eager_claim`, and
  only while no head call waits and no whole HTTP render runs.
  `EagerAdmission::allowed` of
  [`src/serve_eager_admission.rs`](./src/serve_eager_admission.rs) refuses
  eager calls at a capacity of one, and at two or three until the last view
  starts. The gate answers the `ReturnAdmission` check and reports each failed
  step and the disable warning.
- [`src/serve_return.rs`](./src/serve_return.rs) starts the
  `mokly-head-return` worker. The worker holds only weak handles and runs one
  `maintain_head_return` step at a time while admission is ready.
- [`src/serve_lifecycle.rs`](./src/serve_lifecycle.rs) holds the startup
  helpers of Serve, such as the Tokio runtime and the progress animation, and
  `ServeLifecycle`, which orders observer shutdown, busy-worker cancellation,
  and idle-worker shutdown.
- [`src/serve_trace.rs`](./src/serve_trace.rs) installs the
  `--debug-timings` layer of every command and writes its records.
  [`src/serve_trace_fields.rs`](./src/serve_trace_fields.rs) holds the
  bounded allow-lists of the record fields, such as the `cache` values, the
  view comparison reuse fields, and the `render.store` state fields.
- [`src/serve_controls.rs`](./src/serve_controls.rs) maps the keys of rich
  watched Serve to its shortcuts and owns raw mode. Closed or failed terminal
  input ends the key reader but does not stop Serve. Serve shutdown waits for
  the key reader only for a bounded time. On Unix,
  [`src/serve_keyboard_unix.rs`](./src/serve_keyboard_unix.rs) reads the
  terminal and [`src/serve_keyboard_keys.rs`](./src/serve_keyboard_keys.rs)
  decodes its keys. On Windows, `serve_controls.rs` reads Crossterm key events.
- [`src/build.rs`](./src/build.rs) defines `BuildService` and
  `CatalogueBuild`, which validate and render the catalogue before static
  output.
- [`src/static_build.rs`](./src/static_build.rs) defines `StaticBuild`, the
  shared pipeline between rendered catalogues, static assembly, and
  transactions.
- [`src/one_shot/mod.rs`](./src/one_shot/mod.rs) defines `Lines`, the one
  terminal owner of `build` and `publish`.
  [`src/one_shot/phases.rs`](./src/one_shot/phases.rs) reports the phases,
  the warnings, and the Changes result, and holds the cache directory line
  while the head renders. [`src/one_shot/progress.rs`](./src/one_shot/progress.rs)
  owns the animation and the upload progress, and
  [`src/one_shot/output.rs`](./src/one_shot/output.rs) writes the durable
  results and the recovery paths.
- [`src/publication/mod.rs`](./src/publication/mod.rs) holds the
  `StaticOutput` adapter and the publish orchestration.
- [`src/output.rs`](./src/output.rs), [`src/codes.rs`](./src/codes.rs), and
  [`src/redaction.rs`](./src/redaction.rs) select the reporter, fix the error
  categories and recovery copy, and redact tokens and terminal controls. The
  redactor collects the `--token` and `MOKLY_TOKEN` values before validation,
  so it also redacts a malformed value.
- [`src/changes_static.rs`](./src/changes_static.rs) checks input evidence
  before base document callbacks.
- [`src/changes_diagnostics.rs`](./src/changes_diagnostics.rs) presents
  comparison failures and unavailable Changes, and adds the scripts hint to
  every base failure after a scripts-off install.
- [`src/changes_base.rs`](./src/changes_base.rs) defines `NativeBase`, the
  base provider of every command. With a `Freshness`, it samples the checkout
  identity before its first base read and records the evidence of the
  preparation. It starts the early renders of a fresh base when the base graph
  preparation ends. Its `NativePhases` of
  [`src/changes_base_sources.rs`](./src/changes_base_sources.rs) split the
  source phase, which needs no head dependency evidence, from
  `validate_sources`, which selects the dependencies and validates the graph.
  `NativePhases::validate` prepares the graph without document work, and
  `NativePhases::admit` admits that work after head usage.
  [`src/changes_source_admission.rs`](./src/changes_source_admission.rs)
  defines `SourceAdmission`, and
  [`src/serve_eager_source_gate.rs`](./src/serve_eager_source_gate.rs)
  defines `SourceWait`, which holds the cold wait until `StartupSources`
  records the first successful readiness or the preparation is cancelled.
  [`src/changes_validation_admission.rs`](./src/changes_validation_admission.rs)
  defines `GraphPreparationAdmission`, the check before base graph validation.
- [`src/base_dependencies.rs`](./src/base_dependencies.rs) defines
  `NativeDependencies` and `DependencySources`.
  [`src/base_dependency_sources.rs`](./src/base_dependency_sources.rs) leases
  or builds the extraction and reads both clean dependency identities without
  head evidence. `NativeDependencies::prepare` then selects the tier with the
  adopted head evidence.
  [`src/base_dependency_selection.rs`](./src/base_dependency_selection.rs)
  holds the timing tier numbers and the configured module resolution.
- [`src/changes_freshness.rs`](./src/changes_freshness.rs) compares the HTML
  dependency inputs, gives their `base-dependencies` warning, and builds the
  `DependencySelection` of an HTML-only base. Its `SelectionRequest` and
  `PreparedDependencies` carry the selection of a sidecar base from the
  dependency step. It also checks whether a dependency fallback still allows a
  kept base, and it selects the working `node_modules` roots.
- [`src/serve_changes.rs`](./src/serve_changes.rs) defines `ServeChanges`,
  which owns the kept-base slot and the view comparison reuse service, and
  `Source`, one Serve comparison source. `Source::finished` accepts or
  discards the reuse attempt, and `Source::discarded` drops staging that
  `finished` never took. After it reports the result, `Source::finished` also
  schedules the sidecar return pass. `Source::settled` forwards to
  `RenderGeneration::prepare_render_reuse` on the original head of the source.
  `mokly-graph` owns what that hook prepares.
  `Source::pending` hands the eager
  preparation of its state to the usage pass, and `Source::settle_pending`
  cancels and joins it after the classification.
  [`src/serve_changes_native.rs`](./src/serve_changes_native.rs) resolves the
  base references and builds the runtime of each classification with its
  capture workers. Its `AttemptLookup` pins the merge base of the reference
  read of the same attempt, so a classification resolves no base reference
  again. Its `Source::comparison_attempt` begins one fenced reuse attempt.
  [`src/serve_changes_classification.rs`](./src/serve_changes_classification.rs)
  defines `Source::classify_native`, which composes each classification with
  its `ServeBase` provider, its cancellations, and `AdoptingBase`.
  [`src/serve_capture_workers.rs`](./src/serve_capture_workers.rs) builds the
  separate capture pool of one Serve classification.
  [`src/serve_delivery.rs`](./src/serve_delivery.rs) composes the one
  `comparison_reuse::MemoryComparisons` service. It also composes `UsagePass`,
  whose `UsageCapacity` gives both background stages the smaller of the worker
  count and the sidecar limit. It gives the writer's `WriteActivity` to
  `Workers`, `MemoryComparisons`, and `ChangesPass`.
- [`src/serve_base.rs`](./src/serve_base.rs) defines `ServeBase`, which finds,
  keeps, and releases the kept base, `BaseSlot`, the slot, and `ReleaseBase`,
  the release-only capability that each reader keeps.
- [`src/serve_base_cancel.rs`](./src/serve_base_cancel.rs) defines
  `BaseLifetime` and `PreparingBase`, the cancellation of fresh base work that
  detaches at the keep.
- [`src/serve_base_key.rs`](./src/serve_base_key.rs) defines `BaseKey`: the
  merge-base commit, a digest of the adopted configuration with its file,
  repository root, roots, and authored inputs, and the effective
  install-scripts setting.
- [`src/serve_eager.rs`](./src/serve_eager.rs) defines `EagerStarts`, the
  attempt hooks of eager base preparation, and `PendingBase`, the pending
  result of one head attempt until its classification adopts it.
  `EagerAttempts::configure` keeps the factory only for a configured sidecar
  size of at least three.
  [`src/serve_eager_native.rs`](./src/serve_eager_native.rs) composes that
  work with its own lifetime, eager pool handle, and ordered record.
  [`src/serve_eager_task.rs`](./src/serve_eager_task.rs) runs it on one owned
  thread, which `PendingChanges::cancel_and_join` cancels and joins before it
  releases the pending inputs.
  [`src/serve_eager_sources.rs`](./src/serve_eager_sources.rs) and
  [`src/serve_eager_work.rs`](./src/serve_eager_work.rs) hold the source phase
  and the validation phase.
- [`src/serve_eager_events.rs`](./src/serve_eager_events.rs) defines
  `OrderedEvents`, the one ordered record of the statuses, steps, cache
  notices, warnings, and diagnostic text of pending work.
  [`src/serve_eager_reporting.rs`](./src/serve_eager_reporting.rs) replays it
  at adoption through the guarded output paths of Serve Changes, and
  [`src/serve_eager_diagnostics.rs`](./src/serve_eager_diagnostics.rs) routes
  the sidecar text of a pending base source root into it.
- [`src/serve_eager_base.rs`](./src/serve_eager_base.rs) defines
  `AdoptingBase`, which adopts one pending graph or prepares the base
  serially. [`src/serve_eager_evidence.rs`](./src/serve_eager_evidence.rs)
  checks the exact key, the head dependency evidence, and the working inputs
  before adoption, and
  [`src/serve_eager_adoption.rs`](./src/serve_eager_adoption.rs) releases each
  rejected pending graph.

- [`src/base_render_admission.rs`](./src/base_render_admission.rs) defines the prerequisite before early rendering. Static commands verify source evidence, and Serve admits immediately.

### Related Docs

- [CLI options and exit status](../../docs/guides/cli/options-and-exit-status.md),
  [serve](../../docs/guides/cli/serve.md), [build](../../docs/guides/cli/build.md),
  and [publish](../../docs/guides/cli/publish.md) guides.
- [Package contract](../../docs/protocol/mokly-package.md).
- [Terminal help](../../docs/protocol/mokly-terminal-help.md).
- [Terminal output](../../docs/protocol/mokly-terminal-output.md),
  [cache output](../../docs/protocol/mokly-terminal-cache.md), and
  [comparison steps](../../docs/protocol/mokly-terminal-steps.md).
- [Bundle cache entries](../../docs/protocol/mokly-base-cache.md#bundle-entries)
  and the [render store](../../docs/protocol/mokly-render-store.md).
- [Terminal errors](../../docs/protocol/mokly-terminal-errors.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md) and
  [watch runtime](../../docs/protocol/mokly-watch-runtime.md).
- [Base preparation](../../docs/protocol/mokly-base-preparation.md),
  [eager base preparation](../../docs/protocol/mokly-eager-base-preparation.md),
  and [comparison serving](../../docs/protocol/mokly-comparison-serving.md).
- [Sidecar source root scheduling](../../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Static build](../../docs/protocol/mokly-export.md) and
  [upload](../../docs/protocol/mokly-upload.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
