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

## What This Crate Does

Help describes configuration discovery through `mokly.config.json`.
`--help` and `--version` write plain stdout in every output mode.

Serve validates an HTML, JavaScript, or mixed catalogue before it reserves a loopback port. It
serves its initial state through `mokly-server`, with lazy document rendering,
canonical public JSON, authenticated live prop previews, and clean signal
shutdown. A background pass fills usage after readiness and yields to foreground
renders. A completed pass publishes complete consumer lists. In rich watched
mode, `r` enqueues a complete manual rebuild and restarts that pass. A
valid candidate replaces the public state and backend with the next revision;
a failed candidate keeps the last good state. Preparation and projection run
outside the serving task. A revision race stamps the same candidate again
without repeating projection. Port 0 requests a free port. An occupied concrete port advances to
the next available port through 65535. Repeated SIGINT requests coalesce.
The browser bundle comes from the matching installed `@mokly/viewer` package.

One injected terminal writer handles startup, shortcuts, rebuilds, and render
diagnostics. It reports listener backoff and recovery in both output modes.
It preserves carriage returns in raw mode and ignores shortcut
release events. `--debug-timings` emits structured stage spans and background
counts without source text, props, or error payloads.

Common options are `--config`, `--base`, `--sidecars`, and `--debug-timings`.
The composition root constructs a
lazy sidecar pool with the normalized `--sidecars` or environment count.
The npm shim supplies its package root and Node executable. Direct binary
execution checks the adjacent installed package and development ancestors.
An HTML-only catalogue without a renderer or PostCSS starts no sidecar and
needs no package lookup result. A configured renderer contributes its complete
bundle source inventory even when the catalogue has only HTML entries. Direct execution uses `node` from `PATH` when the shim has not
supplied `MOKLY_NODE_EXECUTABLE`.
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
immediately. The interval uses an injected monotonic clock. The pool starts in
the resolved repository root and uses the embedded npm version for hello and
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

Publish validates credentials and the committed clean checkout before it calls
the CLI-owned `StaticOutput` adapter. It passes the invocation directory for
configuration discovery. It reports a child output path inside a private
external directory before the build starts. That parent also confines the
output reservation. `mokly-publish` owns the exchange and cached preparation;
`mokly-model` owns output formats and the marker writer. The static adapter calls the same safe output transaction as `build`. It returns
the installed bytes directly to one cached upload preparation. Checkout failures list at most 20
unique sorted paths and their recovery hint in both output modes. Completed
output stays in the private directory after an upload failure. The warning
policy waits for a user decision. The isolated `warnings_are_fatal` function
makes publish warnings fatal with either value of `--strict`. The command prints
`with --strict` only when the user supplied that option.

## Quick Start

```bash
cargo run -p mokly-cli --bin mokly -- --help
cargo run -p mokly-cli --bin mokly -- --version
cargo run -p mokly-cli --bin mokly -- build --help
```

## Development

```bash
cargo test -p mokly-cli
cargo clippy -p mokly-cli --all-targets -- -D warnings
```

Process recovery tests use the [debug fault adapters](./src/test_faults/mod.rs).
`MOKLY_TEST_STATIC_FAULTS` selects injected filesystem failures or signal gates.
The optional `MOKLY_TEST_STATIC_READY`, `MOKLY_TEST_STATIC_EVENTS`,
`MOKLY_TEST_STATIC_PREVIOUS`, and `MOKLY_TEST_STATIC_COLUMNS` values provide
isolated test paths and terminal width. Release builds compile none of these
adapters or hooks. The compiler probe checks only that the fault module erases
itself without debug assertions and cannot be referenced in that mode. It does
not inspect a packed release binary. The signal-session probe creates and drops
both build and publish signal handlers. Normal source and output operations
still use their injected trait boundaries.

### Key Code

- [Grammar](./src/grammar.rs) and [option validation](./src/options.rs).
- [Output](./src/output.rs), [error copy](./src/errors.rs), and
  [redaction](./src/redaction.rs).
- [Composition root](./src/entry.rs), [native rendering services](./src/render_runtime.rs),
  and [static output adapter](./src/publication/mod.rs).
- [Shared Serve services](./src/serve_services.rs), [Serve shutdown](./src/serve_shutdown.rs),
  [Serve preparation](./src/serve.rs) and [Serve terminal output](./src/serve_output.rs).
- [Build service](./src/build.rs) and [build presentation](./src/build_output.rs).

### Related Docs

- [Package contract](../../docs/protocol/mokly-package.md).
- [Terminal output](../../docs/protocol/mokly-terminal-output.md).
- [Terminal errors](../../docs/protocol/mokly-terminal-errors.md).
