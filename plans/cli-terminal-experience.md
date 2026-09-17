# CLI Terminal Experience

Make `mokly` pleasant to run from a terminal. Today `mokly serve` prints one
line after about two seconds and then stays silent while the catalogue renders,
the derived baseline rebuilds and Changes classify; watched edits, reloads and
restarts print nothing; errors print engineering identifiers such as
`[mokly/cli-invalid] unknown command: frob` with no hint. This plan adds an
interactive reporter for TTY sessions, keyboard shortcuts, humanised errors and
quieter npm scripts, while keeping piped and CI output byte-identical to today
so existing tests, scripts and the diagnostic contract keep working.

## Target experience

Interactive `mokly serve` (rich mode) renders a header, the URL, then one line
per lifecycle event; the spinner line rewrites in place until the event ends:

```text
  mokly 0.10.0                          derived · comparing against origin/main
  examples/basic/mokly.config.ts

  ┌─────────────────────────┐
  │  http://127.0.0.1:4175  │
  └─────────────────────────┘
  watching entries, renderer and styles · press h for shortcuts

  ✔ Catalogue ready · 96 screens · 12 pages · 18 components            4.9s
  ✔ Baseline ready · rebuilt a1b2c3d                                  23.0s
  ✔ Changes ready · 3 changed screens                                  3.6s

  12:04:31  ↻ entries/home.mockup.tsx     rebuilt                      312ms
  12:04:40  ⟳ styles/theme.css            reloaded
  12:05:02  ↺ mokly.config.ts             config reloaded, restarted   1.8s
  12:05:20  ⟲ origin/main moved           comparing again
  12:05:31  ✖ entries/home.mockup.tsx
            Link target "missing-screen" does not exist in the catalogue.
            The last good catalogue is still being served.
```

One-shot commands show a spinner per CLI phase and a summary, for example
`✔ Generated 278 files in examples/basic/generated (5.9s)`. Errors render as
`✖ Unknown command "frob".` followed by a hint such as
`Run mokly --help to see commands.`, with the error code dimmed at the end of
the headline and stacks still behind `MOKLY_DIAGNOSTIC=1`.

Keyboard shortcuts in rich watched Serve: `o` open the URL in the browser,
`r` rebuild from source, `c` clear the screen, `h` list shortcuts, `q` quit.
`serve --open` opens the browser once the URL is ready.

Design rules that every milestone must respect:

- Rich mode requires a TTY stdout; piped output, `CI`, `--debug-timings` and
  `MOKLY_OUTPUT=plain` select plain mode, whose bytes are unchanged from
  today. `MOKLY_OUTPUT=rich` forces the rich layout for tests and unusual
  terminals; colour is separately governed by Node's `util.styleText` stream
  validation (`NO_COLOR`, `FORCE_COLOR`, TTY), so no colour dependency is added.
- One reporter owns the terminal. Every runtime write that currently goes
  straight to stdout or stderr routes through it so log lines never corrupt
  the spinner line; the watched child forwards diagnostics over IPC.
- `MoklyError` messages, codes and HTTP responses are unchanged; humanised
  copy is applied only at the CLI boundary.
- User-facing copy follows the repository copy rules: outcomes first, no
  internal identifiers in headlines, codes only as dimmed secondary detail.

## Milestone 1: Protocol and documentation — completed

Define the complete terminal contract before implementation. The terminal
layouts in the protocol document are the design artefact for this work; no
`docs/mockups` page is involved because nothing renders in the catalogue shell.

- [x] Add `docs/protocol/mokly-terminal-output.md` (about 250 lines) defining: mode selection (TTY, `CI`, `MOKLY_OUTPUT`, `--debug-timings` forcing plain); colour via `util.styleText` and `NO_COLOR`/`FORCE_COLOR`; the glyph set with an ASCII fallback for legacy Windows consoles; the exact header, URL, event, change-log and error line layouts for Serve; the spinner rules (single in-place line, 80 ms frames, unref'd timer, cleared before any other write, cursor never hidden, lines truncated to the terminal width); duration and timestamp formatting; the one-shot command phases and summaries for `build`, `check`, `export` and `publish`; the plain-mode contract listing every exact string that must remain byte-identical (`Mokly listening at <url>[ (watching)]`, `Generated <n> Mokly files.`, both Check messages, the Export lines, `Published Mokly catalogue.`, `[mokly/<code>] <message>` on stderr, empty stderr for successful plain commands); the humanised error table mapping each `MoklyErrorCode` to headline copy and a hint, including the closest-command suggestion for unknown commands; the keyboard shortcuts, their availability rules and `--open`; and the child IPC diagnostic message.
- [x] Update `docs/protocol/mokly-package.md`: link the terminal contract from the CLI section, add `--open` to the Serve options, state that `--help` and `--version` are unaffected, and keep the exit-code and stack rules.
- [x] Update `docs/protocol/mokly-watch.md`: document the event lines and the change log as presentation of existing watch actions, the `r` shortcut using the serialized action queue, and the quieter `npm run -s dev` recommendation.
- [x] Update `docs/protocol/mokly-timings.md` to state that `--debug-timings` forces plain mode so the JSON lines contract is untouched, and `docs/protocol/mokly-upload.md` so Publish success is described per mode.
- [x] Add the new contract to `docs/protocol/README.md`, update the README CLI section, Developer Setup and Troubleshooting, and add `src/cli` to the README Key Code list.
- [x] Add this plan to `plans/README.md` and validate the changed Markdown with `npx prettier --check` on the changed files.

## Milestone 2: Reporter core and one-shot commands — completed

Introduce the reporter seam and mode selection, keep plain output identical,
and apply rich rendering and humanised errors to `build`, `check`, `export`,
`publish`, argument errors and configuration errors.

- [x] Add failing tests first: plain-mode byte parity for every existing stdout and stderr string; rich rendering with an injected fake terminal (fixed columns, `NO_COLOR`) for spinner start/update/clear, summary lines, duration formatting and width truncation; mode selection for TTY, `CI`, `MOKLY_OUTPUT` and `--debug-timings`; the error table for every `MoklyErrorCode` including the closest-command suggestion; secret redaction still applied to rich error output.
- [x] Create `src/cli/reporter/` with a `CliReporter` interface, a `PlainReporter` reproducing today's bytes, a `RichReporter` for TTYs, a `selectReporter` decision function and a `terminal.ts` glyph/colour/width helper built on `util.styleText`; keep every file under about 300 lines.
- [x] Extend `run(argv, cwd)` with an injectable terminal environment (streams, `isTTY`, columns, env) defaulting to the real process so tests never touch real stdio.
- [x] Route `run.ts`, `bin.ts`, `export.ts` and `publish.ts` output through the reporter; add CLI-level phases (load config, render catalogue, write or check output, export, upload) without changing the order of work.
- [x] Add `src/cli/errors.ts` (or similar) that maps a `MoklyError` to headline, hint and dimmed code for rich mode while plain mode still prints `[mokly/<code>] <message>`.
- [x] Add `src/cli/README.md` in the repository README style (responsibilities, behaviour, quick start, key code, related docs) and update `src/server/README.md` where it describes CLI output.
- [x] Run the CLI, timings, export and publish test files and `npm run example:check`; confirm `tests/cli_timings.test.ts` still sees empty stderr and identical stdout.

## Milestone 3: Serve lifecycle events — completed

Report watched and snapshot Serve progress, watched edits and runtime failures
through the reporter, including diagnostics raised in the supervised child.

- [x] Add failing tests first: a `ServeReporter` fake receiving ready, catalogue-complete (with kind counts from the manifest), baseline preparing/ready/cache-hit, changes ready/unavailable, watch burst started/finished/failed with paths and durations, git-reference refresh, and child diagnostics; a `WatchDebouncer`/`WatchActionQueue` test proving paths accumulate across coalesced bursts; a supervisor test parsing the IPC diagnostic message; an integration test spawning `serve` with `MOKLY_OUTPUT=rich`, `NO_COLOR=1` and fixed `COLUMNS` through pipes and asserting the ready, catalogue, baseline and changes lines appear in order; the existing stderr expectations in `tests/server.test.ts` and `tests/baseline_maintenance.test.ts` must keep passing in plain mode.
- [x] Define a `ServeReporter` interface in `src/server` (a subset of the CLI reporter) and add it to `ServeDependencies` with a plain default that writes exactly what the runtime writes today.
- [x] Emit events from `serve.ts` and `serve_watched.ts` at the existing `completeCatalogue`, `baselineStatus`, `baselinePrepared`, `notifyUpdate` and restart points; derive counts from `compilation.manifest.entries` kinds and omit zero groups.
- [x] Carry candidate paths through `WatchDebouncer` and `WatchActionQueue` so the change log can name up to three paths (then `+n more`) and label rebuild, reload, restart, config reload and evidence actions with their measured duration.
- [x] Replace every direct runtime write to stderr with reporter calls: `server/watcher.ts`, `server/serve_watched.ts`, `server/demand/generation.ts`, `server/demand/resources.ts`, `server/resource_watcher.ts` callers, `baseline/maintenance.ts` and `baseline/process_worker.ts` output surfaced in the parent; keep plain bytes identical.
- [x] Add a `diagnostic` IPC message from the child (`server/child.ts`, `server/controls/http.ts`) parsed in `update_messages.ts` and forwarded by `supervisor.ts` through a new `onDiagnostic` callback; the child still writes directly when it is not forked.
- [x] Render the watched-edit failure line with the last-good reassurance copy and keep the unchanged recovery behaviour.
- [x] Update `src/server/README.md` and the watch contract if any event boundary was discovered to differ; run the server, watch, ports, timings and browser watch tests.

## Milestone 4: Keyboard shortcuts and `--open` — completed

Add interactive controls to rich watched Serve without affecting piped runs.

- [x] Add failing tests first: key handling with a fake stdin emitter (`o`, `r`, `c`, `h`, `q`, Ctrl+C, unknown keys ignored); no stdin listener when the mode is plain or stdin has ended; raw mode applied only for a TTY stdin and restored on close; `r` enqueues a `rebuild` through the serialized queue; `o` and `--open` call an injected opener with the served URL; `--open` argument parsing and its rejection outside `serve`; a spawned plain-mode Serve exits promptly on SIGINT with piped stdin.
- [x] Add a `BrowserOpener` seam (platform command `open`, `xdg-open` or `start` chosen per platform, spawned detached with ignored stdio) injected through the CLI environment; failures render as a warning line, never an exit.
- [x] Add `--open` to `arguments.ts`, help text and validation.
- [x] Implement `src/cli/reporter/shortcuts.ts` owning stdin: enable only in rich mode, pause stdin and restore the terminal on shutdown, and print the shortcut list on `h` and once beneath the URL at startup.
- [x] Wire `r` to the watch action queue via a `RunningServe` hook so it cannot race authored changes, and make `c` clear the screen then reprint the header and URL.
- [x] Update the terminal contract, package contract and README if any shortcut behaviour changed during implementation.

## Milestone 5: npm scripts, verification and delivery — completed

Quiet the npm banners, smoke-test the real terminal, and deliver.

- [x] Change the nested calls in the `build` and `dev` package scripts to `npm run -s …` so `npm run dev` shows one banner, and recommend `npm run -s dev` in the README; confirm failures still exit non-zero with the script's own error output visible.
- [x] Smoke-test under a pseudo-terminal (`script -qec` or a small `pty` driver): `npm run -s dev`, `mokly build`, `mokly check`, an unknown command, a missing config, an authored error while watching, each shortcut, `--open`, `--no-watch`, `--debug-timings` forcing plain mode, `NO_COLOR`, a narrow terminal and piped output parity; save representative captures under `.context/` for the final message.
- [x] Update `CHANGELOG`-adjacent release notes only if the release tooling requires it; otherwise leave release-please to generate them from the commit.
- [x] Run `npm run typecheck`, `npm run lint`, `npm run format:check`, the full `npm test`, `npm run test:browser` and `cargo xtask check`; resolve failures.
- [x] After checks pass, `git add -A`, commit with Conventional Commits and push the branch.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md) to review the complete local diff against `origin/main`; report numbered, severity-rated findings with lettered options and a recommendation without changing the implementation.

## Milestone 6: Prominent Serve URL panel — completed

Make the local address the unmistakable primary action in rich Serve output
without changing plain-mode bytes or lifecycle behavior.

- [x] Update the terminal protocol and target experience to put only the URL in
      a compact bordered panel, with watch state and shortcut guidance as
      secondary copy beneath it.
- [x] Add reporter tests first for watched, snapshot, non-interactive, and
      narrow-terminal URL panel output.
- [x] Implement the width-aware URL panel and dim secondary status line, then
      smoke-test watched Serve in a pseudo-terminal and save a capture under
      `.context/`.
- [x] Run focused tests, `npm run typecheck`, `npm run lint`,
      `npm run format:check`, the full `npm test`, `npm run test:browser`, and
      `cargo xtask check`; resolve failures.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Consider friendlier plain-mode error copy for CI logs once downstream
  scripts that parse `[mokly/<code>]` are confirmed; this plan keeps plain
  output byte-identical.
- Consider printing phase lines in plain mode for CI visibility after the
  stdout parsers in `scripts/package`, `scripts/large` and the browser tests
  are switched to a structured readiness signal.
