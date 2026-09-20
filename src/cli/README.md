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

`run.ts` loads configuration and invokes the existing package services. The
reporter directory preserves stable plain output for pipes, CI, and timing
diagnostics while rendering progress, lifecycle events, and actionable errors
for interactive terminals. Rich success ticks are green when the terminal
supports colour and remain unstyled when colour is disabled. `bin.ts` is the
process boundary: it selects the reporter before parsing arguments, applies
secret redaction, and controls the exit code.

Publish-only modules are loaded after command selection. Build, Check, Export,
and supervised Serve children therefore do not initialize the upload archiver.

Rich presentation never changes `MoklyError`, generated output, HTTP responses,
or timing JSON. The supervised Serve child stays plain and forwards diagnostics
to the parent so only one reporter owns the terminal.

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
- `run.ts` composes command work and reports its phases and summaries.
- `reporter/` contains mode selection, terminal helpers, plain/rich output, and
  interactive controls.
- `errors.ts` maps every typed Mokly error to rich headline and hint copy.
- `bin.ts` owns process exit, stack opt-in, and secret-safe failure rendering.
- `export.ts` and `publish.ts` own signal-aware one-shot command lifecycles.

### Related Docs

- [Terminal output contract](../../docs/protocol/mokly-terminal-output.md)
- [Package and CLI contract](../../docs/protocol/mokly-package.md)
- [Timing diagnostics](../../docs/protocol/mokly-timings.md)
- [Watched development](../../docs/protocol/mokly-watch.md)
