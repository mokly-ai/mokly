# mokly-cli

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-cli` provides the `mokly` binary. It owns argument parsing and terminal
presentation. The npm shim starts this binary with inherited streams.

## Responsibilities

- Parse `serve`, `build`, and `publish` with clap.
- Use watched Serve when the command is omitted.
- Select plain or rich output and protect terminal diagnostics.
- Keep success and failure exit statuses at 0 and 1.
- Load JSON configuration, validate the catalogue, and render every HTML or JavaScript view.

- Compute Changes from a pinned Git base and keep its validated result in memory.

## What This Crate Does

The Windows MSVC binary reserves an 8 MiB main-thread stack through
`/STACK:8388608`, matching Linux and macOS main-thread headroom. Preparation
uses the caller's stack. Render workers use default stacks.

Help describes configuration discovery through `mokly.config.json`.
`--help` and `--version` write plain stdout in every output mode.
Rich build and publish Changes summaries include the measured comparison
duration for ready and unavailable results. Plain output has no phase duration.

Serve validates an HTML, JavaScript, or mixed catalogue before it reserves a loopback port. It
serves its initial state through `mokly-server`, with lazy document rendering,
canonical public JSON, authenticated live prop previews, and clean signal
shutdown. A background pass fills usage after readiness and yields to foreground
renders. A completed pass publishes complete consumer lists. Watched Serve attaches a native observer before module evaluation. It buffers
startup edits and coalesces filesystem events by path. The same serialized
queue handles these events and the rich-mode `r` shortcut. A new generation
restarts the usage pass. The initial generation follows the same lease lifetime
as later generations. Replacement releases it after active work finishes.
Configuration changes attach a candidate observer before a second validation
pass when roots change. Exact additions extend
the active observer. Resource callbacks queue their inputs outside render
tasks. A failed attempt accepts repair events from watched directories.
`repoRoot` changes require a restart. Sidecar count and timeout are process
options fixed at startup. Failure keeps the active observer and model. A
valid candidate replaces the public state and backend with the next revision;
a failed candidate keeps the last good state. Preparation and projection run
outside the serving task. A revision race stamps the same candidate again
without repeating projection. Port 0 requests a free port. An occupied concrete port advances to
the next available port through 65535. Repeated SIGINT requests coalesce.
Shutdown closes clients, stops observation, cancels busy pool requests,
drains render work, closes Git hooks, and shuts down idle sidecars. The
listener and file locks release last. Startup uses the same lifecycle with a watcher slot and an atomic readiness
handoff. A stop before that handoff suppresses the ready layout.
The browser bundle comes from the matching installed `@mokly/viewer` package.

After `Catalogue ready`, Serve completes current usage and classifies Changes
against one pinned merge base. Base extraction and dependency installation
publish `preparing`; rendering and comparison publish `pending`. Only the
accepted generation reports `Changes ready` and its Changes, moved, and
ignored-only counts. A failed comparison publishes `unavailable` with its
diagnostic while All remains available. Base dependency and checkout-conversion warnings use the
captured attempt and precede the result. Base composition warnings stay private.

Serve keeps the configured sidecar pool bound for both source roots. A shared
admission gate lets queued and active foreground requests finish their sidecar
calls before more base requests start. This groups each foreground burst even
with one worker. Attempt cancellation wakes queued base calls without polling.

A merge-base change retains the current warning attempt and current render graph.
A changed HEAD or base tip with the same merge base keeps the Changes evidence.
Content replacement starts a new attempt and invalidates pending captures.
Each classification gives its base workers the run's cancellation token.
Replacing the run stops capture before another cached view is read or encoded.
The command supplies tracked Git runners to both classification and retained
historical sources. The ordered Git shutdown hook closes admission, cancels
process groups, and waits for every command and pipe to drain. Git processes
that ignore SIGTERM receive SIGKILL after the one-second grace period.

One injected terminal writer handles startup, shortcuts, rebuilds, and render
diagnostics. It reports listener backoff and recovery in both output modes.
Comparisons use one progress row with 80 ms animation on a TTY. Every durable
line erases that row first. A pipe keeps the starting and completion lines
without animation. A cancelled phase clears its row. The first cache path
prints once in both modes. Base-ref refresh prints the Git watch action and
keeps the current warning attempt.
Serve captures one warning sink per preparation attempt. It sorts and
deduplicates preparation and composition warnings before the completion line.
Later on-demand, background, and temporary renders report only new warnings.
A repair inherits the failed preparation attempt's seen set. Render and preview
failures do not change that scope's preparation status. Replaced or cancelled
producers cannot print warnings, including when shutdown fails. A fatal
startup error flushes pending warnings before cancellation. Resource-only
reloads retain the scope.
It preserves carriage returns in raw mode and ignores shortcut
release events. `--debug-timings` emits structured stage spans and background
counts without source text, props, or error payloads. Shared Changes timings
include the numeric dependency tier and final comparison view counts. A failed phase keeps error status.
Capture spans separate validation, composition, encoding, and closure work.

Common options are `--config`, `--base`, `--base-install-scripts`,
`--no-base-install-scripts`, `--sidecars`, and `--debug-timings`.
The composition root constructs a
lazy sidecar pool with the normalized `--sidecars` or environment count.
The npm shim supplies its package root and Node executable. Direct binary
execution checks the adjacent installed package and development ancestors.
An HTML-only catalogue without a renderer or PostCSS starts no sidecar and
needs no package lookup result. A configured renderer contributes its complete
bundle source inventory even when the catalogue has only HTML entries. Direct execution uses `node` from `PATH` when the shim has not
supplied `MOKLY_NODE_EXECUTABLE`. The render pool shares parent-side Node
resolution with the base-install probe, which runs from the working repository.
HTML-only base comparison follows the [HTML package styles policy](../../docs/protocol/mokly-comparison.md#html-package-styles).
It reads exact governing paths from the head generation's completed dependency
inventory. Unrelated manifest edits and retired Serve imports do not warn.
Static builds keep the input-change outcome when historical PostCSS evidence
disagrees with its pinned Git source. They preserve the earlier output.
They also check selected base package inputs before base document callbacks.
Build and Serve share the same runtime composition. Each command owns one
pool and cache across catalogue preparation, document rendering, and live
prop previews. Serve checks the render token and installed revision before
passing validated props to the graph. Control bounds also apply in the core.
Build and publish install signal handling before command work. The native signal
flag records delivered signals before the listener task runs. The shared
pre-installation boundary drains and checks it after configuration, Git, render,
and stage work. Output reservation precedes Git and sidecar preparation.
Viewer modules are validated before consumer rendering; invalid package scripts
retain their path and parser position in a viewer-package failure. Both
the signal path and normal exit drain the idempotent pool with separate
shutdown guards.
Cancellation stops source reads, graph planning, and queued native documents
even with no sidecar. Signal copies within one second of the first signal
count as one interruption. A later signal kills owned sidecars and exits
immediately after any active output installation, restoration, or cleanup
settles. The output guard and forced-exit admission share one lock, so a new
write cannot start after a forced exit is pending. The interval uses an
injected monotonic clock. Each worker starts in
its request source root and uses the embedded npm version for hello and
graph keys.
Serve uses its own idempotent stop state. Signals and `q` cancel native work
and drain sidecars while the HTTP workers stop. Repeated signals cannot
force a build-style failure exit. A normal interruption exits 0.
The composition root captures `MOKLY_SIDECAR_TIMEOUT_MS` once. Option
validation accepts a positive 64-bit integer and retains it for PoolOptions.
Invalid values fail `cli-invalid` with the accepted range.

Serve accepts `--port`, `--watch`, `--no-watch`, and `--open`. Build accepts
`--out`, `--strict`, and `--no-changes`. Publish accepts `--endpoint`, `--token`,
`--repository`, `--upload-concurrency`, `--strict`, and `--no-changes`.
Value options accept both separate and assigned values. Empty values and
boolean assignments fail. `--no-changes` conflicts with an explicit `--base`.

The reporter implements output-mode precedence, fixed error categories,
recovery hints, control escaping, token redaction, ASCII fallback, and display
width bounds that preserve ANSI sequences. Command subsystems share the Rust
core. The binary owns catalogue work and file writes. Build and publish support
`--debug-timings` with the same structured trace as Serve. `MOKLY_DIAGNOSTIC=1`
adds the redacted cause chain and any supplied sidecar JavaScript stack. `build` renders HTML and React
screens, components, stories, pages, and Markdown
documents into the bounded process cache. It reports all render warnings
before strict-mode failure. `mokly-static` writes the shell, canonical index and details, documents,
referenced resources, and matching viewer bundle. Relative `--out` paths resolve
beside the configuration. Output replacement uses exclusive moves and retains
recovery paths on cleanup failure. Each recovery path has its own detail line
without a width limit. Paths inside the invocation directory are relative;
other paths are absolute. Token redaction and control escaping still apply.
Catalogue counts include variants. Shared-body warnings name
the parent once. Identity diagnostics keep their location continuation
lines in both plain and rich output. A diagnostic omits its inner code tag
only when it equals the command's outer code. Configuration locations are
repository-relative, or use the basename when the root does not contain
the configuration file.

The build service computes Changes unless `--no-changes` is set. After output
admission, it pins the selected base before catalogue validation and rendering.
The comparison uses that same repository, commit, and ref without another lookup.
The phase owner erases its animated row before cache notes and serializes both
streams. Warnings precede the colored Changes status. Nested Git failures keep
the historical commit and Git detail. Changes runs inside the static pipeline before warning gates and output
installation. Build preparation captures the head once, then passes that
generation and the same Changes result to the terminal, static index,
generation writer, and publication metadata. The pipeline uses the summary for
terminal Changes reporting and warning policy before installation. Review timing
spans retain their caller context under `output.write`, including the one
pinned base lookup. Head and base use `mokly-render::Runtime` with one shared
pool and render cache; build capture spans cover both sides.
JavaScript and PostCSS base inputs hold source and dependency leases.
Historical sidecars and PostCSS children use the same parent-death protection
as current rendering, including when consumer code blocks.
CLI cancellation reaches Git, cache waits, installation, source reads,
planning, comparison, and document workers. `--base`
overrides `review.base`; the default ref is `origin/main`. It retains review v8,
snapshot v4, and the two graph generations in memory for static output.
A base source validation failure reports the historical commit and makes
Changes unavailable while the current catalogue remains valid. After a
scripts-off base install, wrapped preparation failures retain their diagnostics
and add the same scripts opt-in hint in build, publish, and fatal-error output.
A missing base configuration means an empty base catalogue, so every current
entry is added. A remaining comparison budget makes Changes unavailable with
the path and limit. A Git failure
aborts the build with `git-failed` and the selected ref. Historical runtime
unavailability and version mismatch make Changes unavailable with typed
diagnostics. A historical runtime timeout makes Changes unavailable with
`base runtime timed out`. Cancellation and protocol failures fail the build. An internal comparison
failure aborts with `review-invalid`. Strict mode counts current-build and
base preparation warnings after comparison, except `base-dependencies`, which
only prints; it omits base authoring warnings. Rich output reports
Changes, moved, and ignored-only counts from the classifier. Plain output
keeps its phase-free contract. The static writer consumes the retained generations for catalogue output.

Publish validates credentials and the committed clean checkout before it calls
the CLI-owned `StaticOutput` adapter. It passes the invocation directory for
configuration discovery. It reports a child output path inside a private
external directory before the build starts. That parent also confines the
output reservation. `mokly-publish` owns the exchange and cached preparation;
`mokly-model` owns output formats and the marker writer. The static adapter calls the same safe output transaction as `build`. It returns
the installed bytes directly to one cached upload preparation. A ready comparison
keeps its pinned merge base, effective ref, and complete generation in that upload.
Unavailable Changes publishes the valid current catalogue with no generation and
null comparison metadata. Checkout failures list at most 20
unique sorted paths and their recovery hint in both output modes. Completed
output and reservations stay in the private directory after a failed or
cancelled upload. Successful and already-published outcomes remove the whole
private directory using its allocated path retained by the command. Cleanup
removes symbolic links without following their targets. A cleanup failure
reports the private directory path without changing the successful receipt. Rich output uses the
shared warning glyph and prints that full path on its own recovery line. Publish warnings
are fatal only with `--strict`. Without it, the command reports warnings and
continues with output installation and upload.
Build preparation owns the single strict-warning check for both commands.

## Quick Start

```bash
cargo run -p mokly-cli --bin mokly -- --help
cargo run -p mokly-cli --bin mokly -- --version
cargo run -p mokly-cli --bin mokly -- build --help
```

## Development

See the [CLI test guide](./tests/README.md) for crate tests, the design matrix,
and process-recovery fixtures. Publish cleanup tests cover the allocated
private directory and symbolic-link boundaries.

### Key Code

- [Static base admission](./src/changes_static.rs) checks input evidence before base document callbacks.
- [Grammar](./src/grammar.rs) and [option validation](./src/options.rs).
- [Output](./src/output.rs), [error copy](./src/errors.rs), and
  [redaction](./src/redaction.rs).
- [Composition root](./src/entry.rs), [native rendering services](./src/render_runtime.rs),
  and [publication orchestration](./src/publication/mod.rs).
- [Native publication adapter](./src/publication_runtime.rs) and
  [shared static pipeline](./src/static_build.rs).
- [Shared Serve services](./src/serve_services.rs), [Serve shutdown](./src/serve_shutdown.rs),
  [Serve preparation](./src/serve.rs) and [Serve terminal output](./src/serve_output.rs).
- [Serve warning scopes](./src/serve_warnings.rs) and [candidate actions](./src/serve_rebuild_action.rs).
- [Serve Changes](./src/serve_changes.rs) and [sidecar admission](./src/serve_pool.rs).
- [Structured timings](./src/serve_trace.rs) and the
  [core stage selection](./src/serve_trace_stages.rs).
- [Build service](./src/build.rs) and [build preparation](./src/build_prepare.rs), with the strict warning count, and
  [build presentation](./src/build_output.rs).
- [Design attribution matrix](./tests/design_attribution_tests.rs).
- [Design behaviour checks](./tests/design_behaviour_tests.rs) pin four design
  contracts and check fixture failure handling.

### Related Docs

- [Package contract](../../docs/protocol/mokly-package.md).
- [Terminal output](../../docs/protocol/mokly-terminal-output.md).
- [Terminal errors](../../docs/protocol/mokly-terminal-errors.md).
