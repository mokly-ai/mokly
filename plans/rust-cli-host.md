# Rust CLI Host

Status: Active

Make the `mokly` executable a native Rust host that owns the terminal and the
process lifecycle for every command, including Serve. The existing Node CLI
becomes a service that the host spawns. The host parses arguments, selects the
output mode, renders plain and rich output, owns the Serve shortcuts, forwards
interrupts as an ordered shutdown, and returns the exit code. Configuration,
build, Serve, Git, baselines, watch, export, and publish logic stay in Node and
do not change. This is the first step toward moving non-rendering logic to
Rust; it creates the host-to-service channel that later steps build on.

The cut works because `run()` in `src/cli/run.ts` already takes an injected
`CliReporter`. The Node side needs one reporter implementation that sends
those calls to the host as events instead of writing to the terminal.

## Target architecture

```text
node dist/cli/bin.js            shim: Node version gate, host resolution
  └─ mokly-host                 Rust: argv, mode, reporter, shortcuts, lifecycle
       └─ node dist/cli/service.js   Node: config, build, Serve, export, publish
            └─ node dist/cli/child.js      unchanged watched HTTP child and workers
```

Design rules that every milestone must respect:

- **One terminal owner.** The host owns stdout, stderr, and stdin. The service
  receives pipes for stdout and stderr. In plain mode the host copies service
  bytes to the matching stream unchanged, so CI logs, `[mokly/<code>]` error
  lines, and `--debug-timings` JSON lines keep their bytes. In rich mode each
  complete service line becomes a diagnostic line through the reporter, after
  the spinner erase defined in the terminal output contract.
- **Plain output is byte-identical to today.** The test files and helpers that
  spawn `dist/cli/bin.js` are the conformance suite. Rich output follows the
  existing terminal output contract glyph for glyph.
- **The host owns the grammar.** Clap defines every public command and option.
  The hidden `__serve-child` command and its reserved options leave the public
  grammar. The service and the watched child receive validated arguments as
  JSON and decode them with one strict TypeScript decoder; no TypeScript
  grammar remains.
- **Only presentation-ready strings cross the channel.** Error humanisation in
  `src/cli/errors.ts`, plain summary strings, and build-warning lines stay in
  TypeScript. The service sends headline, hint, code, and plain text. No
  manifest, review result, or catalogue data crosses the channel in this plan,
  so no shared schema generation is needed yet.
- **One shutdown owner.** The host starts the service in a new process group
  on Unix and a new process group inside a kill-on-close job object on
  Windows, so terminal interrupts reach only the host. The host translates
  `SIGINT`, `SIGTERM`, and `SIGHUP` into one `shutdown` command, waits for the
  drain deadline, then terminates the group or job. Repeated interrupts inside
  the deadline are coalesced. The shim never exits before the host and
  forwards `SIGTERM` to it.
- **Fail closed.** A missing platform package, an unsupported platform, a
  version mismatch between the CLI package and the platform package, a missing
  `MOKLY_NODE`, a channel protocol violation, or a service crash without an
  `error` event ends with exit status 1 and a `[mokly/host-failed] <message>`
  plain line. No JavaScript fallback path exists.
- **Secrets never reach the terminal.** The host redacts every `--token` value
  and `MOKLY_TOKEN` from everything it writes, including the plain passthrough.
  The service keeps `redactCliSecrets` for the events it sends.
- **Hermetic Rust tests.** `cargo test --workspace` runs before the npm build
  in the repository suite, so host unit tests mock every impure boundary with
  `unimock` and never need `dist/` or Node. End-to-end host behaviour is
  verified by the existing TypeScript suites through the shim.

Environment contract between the three processes:

| Variable                | Set by  | Meaning                                              |
| ----------------------- | ------- | ---------------------------------------------------- |
| `MOKLY_HOST_BINARY`     | user/CI | Absolute host binary path; overrides package lookup  |
| `MOKLY_NODE`            | shim    | `process.execPath` of the gated Node runtime         |
| `MOKLY_SERVICE`         | shim    | Absolute path of `dist/cli/service.js`               |
| `MOKLY_PACKAGE_VERSION` | shim    | CLI package version the host prints for `--version`  |
| `MOKLY_HOST_CHANNEL`    | host    | Local socket path or named pipe the service connects |

The shim resolves the host in this order: `MOKLY_HOST_BINARY`, then the
optional platform package for `process.platform` and `process.arch`. It reads
that package's `package.json`, requires its version to equal the CLI version,
and spawns the host with inherited stdio. The host requires `MOKLY_NODE`,
`MOKLY_SERVICE`, and `MOKLY_PACKAGE_VERSION` and fails closed without them.

Channel contract: one local socket in a private directory on Unix, or a named
pipe with a random suffix on Windows. The host listens, the service connects
once, and both sides exchange newline-delimited JSON frames of at most 1 MiB.
The service sends `hello` with `protocol: 1` and its pid. The host answers
with `arguments`, the validated argument object plus the selected output mode.
Events from the service mirror `CliReporter` and `ServeReporter`: `write`,
`phase-start`, `phase-update`, `phase-succeed`, `phase-fail`, `summary`,
`warning`, `diagnostic`, `build-warnings`, `error`, `serve-ready`,
`catalogue-ready` with counted entry kinds, `baseline-preparing`,
`baseline-ready`, `changes-ready`, `changes-unavailable`,
`git-reference-refresh`, `incompatible-baseline`, `runtime-diagnostic`,
`watch-started`, `watch-finished`, and `watch-failed`. Commands from the host
are `rebuild` and `shutdown`. Clear, help, and open are host-local actions.
Unknown frame types fail the channel; unknown fields are ignored.

Supported host platforms: Linux x64 glibc, macOS arm64, macOS x64, and Windows
x64. Musl and other targets stay unsupported, the same position Lightning CSS
already imposes.

## Scope boundaries

In scope: the host crate, the shim, the service and child entries, the channel,
the platform packages, release and CI plumbing, docs, and the test migration
listed below.

Out of scope: Git, baselines, watch, the output transaction, export, publish,
HTTP, the worker model inside the service, esbuild, both `koffi` paths, and
TypeScript type generation from Rust.

### Deletions that need approval

Milestone 4 removes these files from `origin/main` because the host replaces
them. Approval of this plan records approval of these deletions:

- `src/cli/arguments.ts`, `src/cli/help.ts`, `src/cli/browser.ts`,
  `src/cli/main.ts`
- `src/cli/reporter/plain.ts`, `rich.ts`, `rich_phase.ts`, `select.ts`,
  `serve_lines.ts`, `serve_ready.ts`, `shortcuts.ts`, `terminal.ts`, and
  `environment.ts`
- `tests/cli_arguments.test.ts`, `tests/cli_reporter.test.ts`, and
  `tests/cli_terminal_copy.test.ts`, replaced by Rust tests

`src/cli/errors.ts`, `secrets.ts`, `bootstrap.ts`, `version.ts`, `run.ts`,
`export.ts`, `publish.ts`, `publish_output.ts`, `publish_failure.ts`,
`keep_alive.ts`, `reporter/types.ts`, and `reporter/phase.ts` stay.

## Milestone 1: Protocol and documentation

Define the complete host contract before any code changes. Every later
milestone implements these documents without guesswork.

- [ ] Add `docs/protocol/mokly-host.md` (at most 250 lines): process topology,
      shim resolution order, the environment contract table, the fail-closed
      conditions with their exact `[mokly/host-failed]` messages, the
      `--version` source, the shutdown ordering with a 10 second drain
      deadline, process-group and job-object rules, exit status mapping, the
      supported platforms, and the `MOKLY_HOST_BINARY` override.
- [ ] Add `docs/protocol/mokly-host-channel.md` (at most 250 lines): socket
      and named-pipe creation, framing and the 1 MiB cap, the `hello` and
      `arguments` handshake, every event and command with its fields, the
      `catalogue-ready` counted kinds, ordering rules, and failure handling.
- [ ] Update `docs/protocol/mokly-terminal-output.md`: the host is the single
      reporter, service lines cross the channel or the passthrough, and the
      colour rule becomes explicit: colour is on when `FORCE_COLOR` is set to
      a value other than `0` or `false`; otherwise it is off when `NO_COLOR` or
      `NODE_DISABLE_COLORS` is set, when `TERM` is `dumb`, or when the stream is
      not a TTY; otherwise it is on. Document the exact legacy Windows console
      detection used for the ASCII glyph fallback. Keep the file at or below
      250 lines by moving channel detail into the new documents.
- [ ] Update `docs/protocol/mokly-terminal-errors.md` with the `host-failed`
      plain lines and their rich headline and hint copy.
- [ ] Update `docs/protocol/mokly-package.md`: the executable is a shim plus
      native host, `__serve-child` and its reserved options leave the public
      grammar, help and version are host-owned, and the supported platforms.
- [ ] Update `docs/protocol/npm-release.md`,
      `docs/protocol/npm-release-management.md`,
      `docs/protocol/ci-verification.md`, and
      `docs/protocol/dependency-security.md` for the four platform packages,
      linked versions, the host build matrix, the publish order, and the audit
      scope of first-party optional packages.
- [ ] Update `docs/guides/start/install.md` and
      `docs/guides/cli/options-and-exit-status.md` with the supported host
      platforms and the host failure exit status.
- [ ] Update `docs/architecture/build-pipeline.md` with a short process
      topology section, and add the new protocol documents to
      `docs/protocol/README.md`.
- [ ] Search `docs/` for `bin.js`, `__serve-child`, and `main.js` and align
      every mention with the new entries.
- [ ] Run `npm run format:check` and
      `node --import tsx --test tests/protocol_doc_sizes.test.ts`;
      `cargo xtask check` is optional for this documentation-only milestone.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report findings
      without changing the implementation.

## Milestone 2: Host crate

Build and test the host binary without wiring it to the package. The product
is unchanged at the end of this milestone.

- [ ] Add `crates/mokly-host` to the Cargo workspace as an unpublished binary
      crate with `#![warn(unreachable_pub)]`, module-level docs, and a README
      with the required sections.
- [ ] Add dependencies with `cargo add`: `clap` with derive, `tokio`, `serde`,
      `serde_json`, and `thiserror`, plus `unimock` and `insta` as dev
      dependencies. Add the Windows job-object API crate as a target-specific
      dependency. The host does not use `tracing`; every write is user-facing
      terminal output.
- [ ] Define the `thiserror` error enum with typed variants for every
      fail-closed condition and the `[mokly-host/<module>]` message prefix.
- [ ] Implement the clap grammar in `cli.rs` and the validated argument type in
      `arguments.rs` with the exact option-ownership rules and messages from
      `src/cli/arguments.ts`, serialized as JSON for the service.
- [ ] Implement `help.rs` and `version.rs` with byte-identical help text and
      the `MOKLY_PACKAGE_VERSION` version line.
- [ ] Implement `mode.rs` with the five output-mode rules and the colour rule.
- [ ] Implement `redact.rs` for `--token` values and `MOKLY_TOKEN`, including
      the URL-encoded form.
- [ ] Implement the `terminal` module: ANSI-aware width measurement, ellipsis
      truncation with style reset, glyph tables with the legacy Windows
      fallback, the 80 millisecond spinner, and the `\r\x1b[2K` erase rule,
      behind a `Terminal` trait.
- [ ] Implement the `reporter` module: plain passthrough, rich phases, one-shot
      summaries, duration formatting, the Serve header panel, lifecycle lines,
      watch lines with timestamp and path joining, warnings, diagnostics, and
      error headline and hint rendering.
- [ ] Implement the `channel` module: listener creation for Unix sockets and
      Windows named pipes, frame codec with the size cap, handshake, typed
      event and command structs, and protocol-violation errors, behind a
      `ChannelTransport` trait.
- [ ] Implement the `service` module: spawn through a `ProcessSpawner` trait
      with the environment contract, process-group and job-object placement,
      stdout and stderr pumps, interrupt coalescing, the shutdown command,
      the drain deadline through a `Clock` trait, forced termination, and
      exit-status mapping.
- [ ] Implement `shortcuts.rs` with raw-mode stdin handling, the key table,
      and restoration on close, and `browser.rs` with the three platform
      launchers behind a `BrowserOpener` trait.
- [ ] Keep every file at or below 300 lines; split modules before they grow.
- [ ] Add `_tests_` unit tests with `unimock` for every trait boundary: grammar
      acceptance and rejection messages, mode and colour selection, redaction,
      width and truncation, every reporter line against the terminal output
      contract, duration formatting, channel codec and handshake, lifecycle
      ordering, shutdown deadline, and forced termination.
- [ ] Add `insta` file snapshots under `snapshots/` for `--help` and the rich
      Serve header panel.
- [ ] Add a hermetic binary integration test under `tests/` that runs
      `mokly-host --help` and `--version`, and checks the fail-closed message
      when `MOKLY_NODE` is missing.
- [ ] Run the Rust formatting check, the workspace clippy check with warnings
      denied, `cargo test --workspace`, and
      `cargo xtask rust-file-length-lint --all`, then `cargo xtask check`.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report findings
      without changing the implementation.

## Milestone 3: Distribution and release plumbing

Ship the host binary for the four platforms. The binary is installed but still
unused by the shim at the end of this milestone, so the product is unchanged.

- [ ] Add `packages/host/linux-x64`, `darwin-arm64`, `darwin-x64`, and
      `win32-x64`, each with a `package.json` that declares `os`, `cpu`, the
      binary in `files`, MIT license, and the CLI version, plus a short README.
- [ ] Add exact-version `optionalDependencies` on the four packages to the CLI
      `package.json`, and update `package-lock.json`.
- [ ] Add the four packages to `release-please-config.json` and
      `.release-please-manifest.json` with a `linked-versions` group that keeps
      them equal to the CLI version.
- [ ] Add `scripts/host/build.mjs` that builds the host crate in release mode
      for the current platform and copies the binary into the matching
      platform package directory; call it from `prepare:verification` and the
      `example:*` scripts.
- [ ] Extend `scripts/package/pair.mjs`, `archive.mjs`, `manifest.mjs`, and
      `packed_manifest.mjs` into a package set that packs the current
      platform's host package beside the CLI and viewer, validates its
      `optionalDependencies` pin, and installs it in every consumer smoke.
- [ ] Extend `scripts/release/pack.mjs` and `registry.mjs` to pack, guard,
      verify, and publish each platform package with provenance, in the order
      viewer, platform packages, CLI.
- [ ] Add a release workflow job that builds the host on `ubuntu-24.04`,
      `blacksmith-6vcpu-macos-15` for both Apple targets, and
      `blacksmith-2vcpu-windows-2025`, uploads artifacts, and feeds the publish
      job.
- [ ] Add Rust setup to the `native` CI job and run `cargo test -p mokly-host`
      there.
- [ ] Update the dependency audit, `tests/package.test.ts`,
      `tests/release_config.test.ts`, `tests/release_bootstrap.test.ts`, and
      `tests/helpers/release_fixture.ts` for the package set.
- [ ] Extend the package smoke with a step that runs the installed host binary
      with `--help` from the consumer fixture.
- [ ] Run `cargo xtask check`.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report findings
      without changing the implementation.

## Milestone 4: Switch-over to the host

Make the host run every command. This is the only milestone that changes
behaviour.

- [ ] Replace `src/cli/arguments.ts` with `src/cli/arguments_codec.ts`, a strict
      JSON decoder for the validated argument object, and change `run()` to
      accept decoded arguments instead of argv.
- [ ] Add `src/cli/service.ts`: connect to `MOKLY_HOST_CHANNEL`, send `hello`,
      receive `arguments`, build a `HostReporter` that implements `CliReporter`
      and `ServeReporter` as channel events, run the command, handle the
      `rebuild` and `shutdown` commands, redact before sending, and flush the
      channel before exit.
- [ ] Add `src/cli/child.ts` as the watched-child entry that decodes its
      arguments from one JSON argv item, and change
      `src/server/serve_lifecycle.ts` to fork it instead of `bin.js`.
- [ ] Rewrite `src/cli/bin.ts` as the shim: keep `bootstrapCli`, resolve the
      host, check the platform package version, set the environment contract,
      spawn with inherited stdio, forward `SIGTERM`, never exit first, and
      return the host status.
- [ ] Delete the files listed under deletions and remove their exports; lower
      the unused-internal-export baseline if the ratchet reports it.
- [ ] Add `tests/helpers/recording_reporter.ts` and switch
      `tests/link_control_cli.test.ts`, `cli_build_warnings.test.ts`,
      `publish_output.test.ts`, `build_warning_compatibility.test.ts`,
      `cli_shortcuts.test.ts`, `export_cli.test.ts`, `publish_cli.test.ts`,
      `changes.test.ts`, `timings.test.ts`, `package.test.ts`, and
      `tests/helpers/serve_ready_signal_preload.ts` from the deleted modules
      to the helper, the codec, or a help-text fixture.
- [ ] Update `tests/watched_child_startup.test.ts` and `watch_child_exit.test.ts`
      for the child entry and its JSON argument.
- [ ] Export `MOKLY_HOST_BINARY` from `scripts/verification/unit-runner.mjs`,
      `run-browser.mjs`, `scripts/large/cli.mjs`, and a new `scripts/host/run.mjs`
      used by `npm run dev`, pointing at the local release build; the package
      smoke must not set it.
- [ ] Add host end-to-end TypeScript tests through the shim: `--help` bytes,
      `--version`, every `cli-invalid` message, plain passthrough bytes for
      `build`, `check`, and `--debug-timings`, service stdout and stderr
      ordering, interrupt during Serve exits cleanly, forced termination after
      an unresponsive service, missing `MOKLY_NODE`, missing platform package,
      and version mismatch.
- [ ] Add the host lifecycle TypeScript tests to the `native` CI job so
      interrupt handling runs on macOS and Windows.
- [ ] Run a pseudo-terminal smoke for rich Serve: header panel, lifecycle
      lines, every shortcut, Ctrl+C, and a service diagnostic while the spinner
      runs; record the transcript under `.context/`.
- [ ] Update `src/cli/README.md`, `crates/mokly-host/README.md`, the root
      `README.md` develop and key-code sections, and `xtask/README.md`.
- [ ] Run `cargo xtask check`.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Verify the published platform packages install through the public composite
  GitHub Action on an ubuntu runner and through `npx --package @mokly/mokly`.
- Verify the first release-please pull request keeps the four platform
  packages at the CLI version.
- Plan the next step: move the baseline process runner, exclusive rename, Git
  evidence, watch, and the output transaction into the host, which removes
  both `koffi` paths.
