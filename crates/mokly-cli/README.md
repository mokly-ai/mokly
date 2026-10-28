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
- Compose one rendering runtime, sidecar pool, and render cache per command.

## What This Crate Does

The [CLI reference](../../docs/guides/cli/options-and-exit-status.md) lists
the commands, the options, the exit statuses, and the error categories. The
[help contract](../../docs/protocol/mokly-terminal-help.md) fixes the help and
version bytes. `--help` and `--version` write plain stdout in every output
mode.

Build and Serve share the same runtime composition. Each command owns one
lazy sidecar pool, sized from `--sidecars`, `MOKLY_SIDECARS`, or the core
count. It also creates one render cache at its entry point and uses it
across catalogue preparation, document rendering, and live prop previews.
The timing layer of `--debug-timings` reads the same cache for its cache
counts. Head and base renders use `mokly_render::runtime::Runtime` with that
shared pool and cache. The npm shim supplies its package root and Node
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
attaches the new lease before catalogue and graph preparation.

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
Both source roots share the configured sidecar pool bound. A shared admission
gate lets foreground requests finish their sidecar calls before more base
requests start. The base preparation bundles its stylesheet roots on the
classification thread, not on the shared render workers. A base root that
waits at the gate then never holds a worker that a foreground render needs.
Serve captures one warning sink per preparation attempt and
reports each warning once under the
[build warnings contract](../../docs/protocol/mokly-build-warnings.md).
Shutdown follows the [runtime shutdown order](../../docs/protocol/mokly-runtime.md).

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
outside the repository and returns the installed bytes to one cached upload
preparation. `mokly-publish` owns the exchange. The
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
events. Catalogue counts include variants. The reporter implements output-mode precedence, fixed error
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

### Key Code

- [`src/main.rs`](./src/main.rs) and [`src/entry.rs`](./src/entry.rs) start
  the binary, select the command and the output mode, and map the result to
  the exit status.
- [`src/grammar.rs`](./src/grammar.rs) defines `Cli`, `Verb`, and `Common`,
  the clap grammar, and [`src/options.rs`](./src/options.rs) normalizes
  options and environment fallbacks.
- [`src/render_runtime.rs`](./src/render_runtime.rs) creates the render cache
  and composes the shared JavaScript and HTML rendering services of one
  command.
- [`src/entry_serve.rs`](./src/entry_serve.rs) and
  [`src/serve.rs`](./src/serve.rs) compose, prepare, and close Serve.
- [`src/serve_services.rs`](./src/serve_services.rs) shares one pool and
  cache across Serve preparation and live views.
- [`src/build.rs`](./src/build.rs) defines `BuildService` and
  `CatalogueBuild`, which validate and render the catalogue before static
  output.
- [`src/static_build.rs`](./src/static_build.rs) defines `StaticBuild`, the
  shared pipeline between rendered catalogues, static assembly, and
  transactions.
- [`src/publication/mod.rs`](./src/publication/mod.rs) holds the
  `StaticOutput` adapter and the publish orchestration.
- [`src/output.rs`](./src/output.rs), [`src/codes.rs`](./src/codes.rs), and
  [`src/redaction.rs`](./src/redaction.rs) select the reporter, fix the error
  categories and recovery copy, and redact tokens and terminal controls.
- [`src/changes_static.rs`](./src/changes_static.rs) checks input evidence
  before base document callbacks.

### Related Docs

- [CLI options and exit status](../../docs/guides/cli/options-and-exit-status.md),
  [serve](../../docs/guides/cli/serve.md), [build](../../docs/guides/cli/build.md),
  and [publish](../../docs/guides/cli/publish.md) guides.
- [Package contract](../../docs/protocol/mokly-package.md).
- [Terminal help](../../docs/protocol/mokly-terminal-help.md).
- [Terminal output](../../docs/protocol/mokly-terminal-output.md).
- [Terminal errors](../../docs/protocol/mokly-terminal-errors.md).
- [On-demand Serve](../../docs/protocol/mokly-on-demand.md) and
  [watch runtime](../../docs/protocol/mokly-watch-runtime.md).
- [Static build](../../docs/protocol/mokly-export.md) and
  [upload](../../docs/protocol/mokly-upload.md).
- [Rust core architecture](../../docs/architecture/rust-core.md).
