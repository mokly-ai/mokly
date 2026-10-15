# mokly-cli

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-cli` provides the `mokly` binary. It owns argument parsing and terminal
presentation. The npm shim starts this binary with inherited streams.

## Responsibilities

- Parse `serve`, `build`, and `publish` with clap.
- Use watched Serve when the command is omitted.
- Select plain or rich output and protect terminal diagnostics.
- Keep success and failure exit statuses at 0 and 1.
- Load JSON configuration, validate the catalogue, and render every HTML view.

## What This Crate Does

Help describes configuration discovery through `mokly.config.json`.
`--help` and `--version` write plain stdout in every output mode.

Serve validates an HTML catalogue before it reserves a loopback port. It
serves its initial state through `mokly-server`, with lazy document rendering,
canonical public JSON, authenticated live prop previews, and clean signal
shutdown. In rich watched mode, `r` enqueues a complete manual rebuild. A
valid candidate replaces the public state and backend with the next revision;
a failed candidate keeps the last good state. Port 0 requests a free port. An occupied concrete port advances to
the next available port through 65535. Repeated SIGINT requests coalesce.
The browser bundle comes from the matching installed `@mokly/viewer` package.

Common options are `--config`, `--base`, `--sidecars`, and `--debug-timings`.
Serve accepts `--port`, `--watch`, `--no-watch`, and `--open`. Build accepts
`--out`, `--strict`, and `--no-changes`. Publish accepts `--endpoint`, `--token`,
`--repository`, `--upload-concurrency`, `--strict`, and `--no-changes`.
Value options accept both separate and assigned values. Empty values and
boolean assignments fail. `--no-changes` conflicts with an explicit `--base`.

The reporter implements output-mode precedence, fixed error categories,
recovery hints, control escaping, token redaction, ASCII fallback, and display
width bounds that preserve ANSI sequences. Command subsystems share the Rust
core. The binary owns catalogue work and file writes. `build` renders HTML
screens, components, pages, and Markdown
documents into the bounded process cache. It reports all render warnings
before strict-mode failure. Static output belongs to `mokly-static`.
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
`mokly-model` owns output formats and the marker writer. The static output adapter reports a single `build-invalid` line
when its implementation is unavailable. Checkout failures list at most 20
unique sorted paths and their recovery hint in both output modes. Completed
output stays in the private directory after an upload failure. The warning
policy waits for a user decision. The isolated `warnings_are_fatal` function
makes publish warnings fatal with either value of `--strict`.

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

### Key Code

- [Grammar](./src/grammar.rs) and [option validation](./src/options.rs).
- [Output](./src/output.rs), [error copy](./src/errors.rs), and
  [redaction](./src/redaction.rs).
- [Composition root](./src/entry.rs), [native rendering services](./src/render_runtime.rs),
  and [static output adapter](./src/publication/mod.rs).
- [Serve preparation](./src/serve.rs) and [Serve terminal output](./src/serve_output.rs).
- [Build service](./src/build.rs) and [build presentation](./src/build_output.rs).

### Related Docs

- [Package contract](../../docs/protocol/mokly-package.md).
- [Terminal output](../../docs/protocol/mokly-terminal-output.md).
- [Terminal errors](../../docs/protocol/mokly-terminal-errors.md).
