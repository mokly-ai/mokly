# Mokly CLI

The CLI composes Mokly's configuration, build, Serve, export, and publish
boundaries into the `mokly` executable. Depend on the public authoring API from
`src/index.ts`; use this directory when changing command behavior or terminal
presentation.

## Responsibilities

- Parse and validate public command options before doing consumer work.
- Select one plain or rich reporter for the full process lifetime.
- Compose build, check, Serve, export, and publish without duplicating their
  domain logic.
- Humanise typed failures at the terminal boundary and redact credentials.
- Own interactive watched-Serve shortcuts and default-browser opening.

## What This Code Does

`bin.ts` loads only the dependency-free Node compatibility bootstrap. Supported
runtimes then load `main.ts`, which owns reporter setup and error presentation;
affected and otherwise unsupported runtimes stop before the application module
graph is evaluated. `run.ts` loads configuration and invokes the existing
package services. The reporter directory preserves stable plain output for
pipes, CI, and timing diagnostics while rendering progress, lifecycle events,
and actionable errors for interactive terminals. Serve arms graceful shutdown
before reporting its ready URL, so any announced process can accept an immediate
interrupt. Rich success ticks are green when the terminal supports colour and
remain unstyled when colour is disabled. `main.ts` is the application process
boundary: it selects the reporter before parsing arguments, applies secret
redaction, and controls the exit code.

Publish updates the active rich upload phase as missing blobs complete, then
renders its counted or already-published `PublishResult`. Plain mode emits only
the stable result line and optional credential-safe viewer URL. One terminal
count formatter owns singular and plural nouns for publish and Serve output.
Every in-place TTY frame erases the full current line before drawing, so shorter
progress labels and re-plan resets cannot retain stale characters.

Publish cancellation and transport exhaustion retain the `upload-failed` code
but carry distinct typed presentation variants. Plain mode prints each complete
actionable message; rich mode splits it into a non-repeating headline and hint.
`publish_failure.ts` preserves a typed cancellation object, while `main.ts`
selects the fixed publish cancellation copy only for terminal rendering and
keeps the original for diagnostics. The export boundary explicitly marks
failures in its pre-installation window after one event-loop turn gives
already-delivered signals time to run. It marks the original typed error,
preserving its class, fields, message and diagnostic stack. Transaction setup,
generated-output writes and every recovery or cleanup error retain their
guidance. Export and publish also hold a referenced handle for the lifetime of
their signal listeners, so an interrupted unreferenced helper cannot make Node
exit before the reporter sets status 1.

Publish-only modules are loaded after command selection. Build, Check, Export,
and supervised Serve children therefore do not initialize the upload exchange.

Build warnings are non-fatal compile diagnostics carried on the compilation
result. `run.ts` prints them through the reporter after the rendering phase.
`build`, `check`, `export`, and `publish` accept `--strict`, which reports every
warning and then fails before the next write, comparison, staging, or upload
boundary. Serve refuses the flag. Plain and rich warning lines both use stderr,
so plain stdout and rich summaries retain their established bytes. Watched Build
reports each compilation before writing; strict warning failures retain the
last-good output and follow the existing watch error/recovery path.

Rich presentation never changes `MoklyError`, generated output, HTTP responses,
or timing JSON. The supervised Serve child stays plain and forwards diagnostics
to the parent so only one reporter owns the terminal.
`run.ts` also owns one structured warning sink per invocation. It flushes
sorted, deduplicated diagnostics before one-shot summaries and Catalogue ready,
redacts credentials, and starts each watched attempt's warning scope before
config or consumer preparation. A failed attempt keeps old previews without
restoring their warning scope. The supervised child forwards render warnings
with the attempt captured from its rendering inputs. A full-manifest child
captures its own config-warning generation before loading config. A child that
receives retained config does not replay the parent's config warnings. Only
the parent reports IPC warnings to the terminal. Main's `buildWarnings` reporter
formats both routes and typed subjects. Strict commands count every producer
and fail before writes or upload; Serve refuses `--strict`.

## Quick Start

```bash
npm run build
node dist/cli/bin.js --help
MOKLY_OUTPUT=rich NO_COLOR=1 node dist/cli/bin.js build \
  --config examples/basic/mokly.config.ts
node dist/cli/bin.js serve --open \
  --config examples/basic/mokly.config.ts
```

Use `MOKLY_OUTPUT=plain` when capturing stable command output. Add
`--debug-timings` for JSON timing lines; it always forces plain mode.

## Development

Run focused CLI, export, publish, timing, and server tests after changing this
directory. Interactive behavior also needs a pseudo-terminal smoke test because
ordinary test runners pipe stdout and intentionally select plain mode.

### Key Code

- `arguments.ts` validates the command grammar and option ownership.
- `bootstrap.ts` owns the supported Node range and gates application loading.
- `main.ts` owns process-level reporter setup, redaction, and exit behavior.
- `run.ts` composes command work and reports its phases and summaries.
- `reporter/` contains mode selection, terminal helpers, plain/rich output, and
  interactive controls.
- `errors.ts` maps every typed Mokly error to rich headline and hint copy.
- Publish's `git-uncommitted` and `build-stale` errors retain headline, bounded
  path detail, and recovery hint in both plain and rich output.
- `bin.ts` is the minimal executable that runs the compatibility bootstrap.
- `export.ts` and `publish.ts` own signal-aware one-shot command lifecycles.

### Related Docs

- [Terminal output contract](../../docs/protocol/mokly-terminal-output.md)
- [Build warnings](../../docs/protocol/mokly-build-warnings.md)
- [Package and CLI contract](../../docs/protocol/mokly-package.md)
- [Timing diagnostics](../../docs/protocol/mokly-timings.md)
- [Watched development](../../docs/protocol/mokly-watch.md)

The approved [watch-writer contract](../../docs/protocol/mokly-watch-writers.md)
shares summaries across writing commands and sends successful plain baseline
notes to stdout. [Check boundaries](../../docs/protocol/mokly-boundary-results.md#git-state-for-check)
use machine-readable Git results without matching localized messages.
