# Native Rust Engine And Host

Status: Active. Created 2026-10-05 with the user's consent after the
measurement step recorded below. Milestone 1 is complete: the native engine
contract and every dependent document name it as the approved target, and the
measurements are recorded in the fixture guide. On 2026-10-06 the user folded
the separate Rust CLI host plan (workspace 242, branch
`calummoore/rust-cli-host-feasibility`) into this plan and added shared type
definitions; the user archives that workspace once this plan owns its scope.
Milestone 2 updates the contracts for both additions before any code changes.
No code has changed. The raw measurement logs and the span aggregator live
under `.context/timings/` on the measuring machine; they are not tracked.

**Goal:** add a Rust engine that the TypeScript CLI loads in its own process
through Node-API bindings built with napi-rs, and make the `mokly` executable
a Rust host that owns the terminal and the process lifecycle. Move the work
that does not need React or consumer JavaScript into Rust, one bounded phase
at a time. Define every shared data shape once, in Rust, and generate the
TypeScript from it. Keep one test suite and the same public CLI, manifest,
review result, and read model.

**Problem (measured on 2026-10-05):** the large synthetic fixture (30 areas,
40 screens, 12 rows, 4 stylesheets; 1,590 entries, 5,550 views, 142 MB of
HTML, a 24 MB manifest) on 8 vCPUs and 16 GB with Node 24.21.0 gave:

| Phase                                           | Build  | Serve background | Export            |
| ----------------------------------------------- | ------ | ---------------- | ----------------- |
| React rendering (`render`)                      | 59.0 s | 75.3 s           | 62.3 s            |
| HTML passes (links, resources, compat, logical) | 20.7 s | 28.6 s           | 31.6 s            |
| Component metadata validation                   | 4.4 s  | 6.0 s            | 7.4 s             |
| esbuild bundle and evaluate                     | 0.6 s  | 0.5 s            | 0.7 s             |
| Output write and path checks                    | 8.5 s  | 13.9 s           | 13.6 s            |
| Comparison (`review.*`)                         | none   | worker died      | 139 s, then crash |

Two scale defects came out of the same runs:

1. In Serve, the Changes worker reached its 1 GB heap cap after about 90 s of
   classification in both runs. Changes became unavailable. The cap is set in
   `src/server/demand/background.ts`.
2. In Export, the same comparison ran in-process. `review.compare-screens`
   reached 139 s, then the process spent about three minutes in garbage
   collection and aborted at the default 4.3 GB heap limit. The resource graph
   traversal ran 15,512 times for 5,520 views.

Rendering stays JavaScript, so a Rust host alone would not change the largest
cost. The comparison engine is pure data work, is the slowest phase once
Changes runs, and is the phase that fails on memory. It is the first engine
phase. The post-render HTML passes and watcher resource discovery are later
candidates and are out of scope here.

**Decisions (from the discussions that led to this plan):**

- The engine runs inside the Node process through napi-rs. There is no
  embedded JavaScript engine, and no catalogue data crosses a process
  boundary.
- The `mokly` executable becomes a Rust host. The topology is shim, host,
  service, child: `node dist/cli/bin.js` gates the Node version and resolves
  the host; `mokly-host` owns argv, output mode, the reporter, the Serve
  shortcuts, interrupts, and the exit code; `node dist/cli/service.js` keeps
  config, build, Serve, Git, baselines, watch, export, and publish; the
  watched HTTP child and the workers are unchanged.
- One platform package per target, `@mokly/native-<target>`, carries both
  native artifacts: the host binary and the engine library. The CLI lists
  the five packages as exact optional dependencies. The host plan's four
  targets gain Linux arm64.
- Every shared data shape has one definition, in Rust, in the `mokly-model`
  crate. TypeScript types are generated from it and committed; hand-written
  copies are removed. Engine functions take only strings, byte buffers, and
  numbers, so the generated declarations describe signatures and the model
  crate describes every shape.
- Validation logic has one owner per boundary: Rust validates what the engine
  reads and writes; the browser viewer keeps its decoder for served data.
  Parity tests on one corpus keep the two decoders equal.
- The first change carried through the native build is the replacement of
  the `koffi` FFI bridge: exclusive directory rename on Linux, macOS, and
  Windows, and the Windows job object for baseline commands. The host reuses
  the same platform crate for its own process group and job object.
- The comparison engine moves to Rust in phases, each proven by differential
  tests against the TypeScript implementation on real outputs.
- On a supported platform the native packages are required, like the native
  Lightning CSS binary is required today. An unsupported platform fails with
  one actionable error. There is no JavaScript fallback for the host or for
  an engine-backed operation.
- Removals need the user's explicit approval before their TODO runs. Record
  each approval in this Status before deleting:
  1. `koffi`, `src/export/rename.ts`, and `src/baseline/windows_job.ts`.
  2. The TypeScript comparison implementation, after the engine owns every
     phase.
  3. The TypeScript CLI grammar and reporter that the host replaces:
     `src/cli/arguments.ts`, `help.ts`, `browser.ts`, `main.ts`,
     `src/cli/reporter/plain.ts`, `rich.ts`, `rich_phase.ts`, `select.ts`,
     `serve_lines.ts`, `serve_ready.ts`, `shortcuts.ts`, `terminal.ts`,
     `environment.ts`, and the tests `cli_arguments`, `cli_reporter`, and
     `cli_terminal_copy`, which Rust tests replace.
  4. The hand-written TypeScript interfaces that generated files replace.

**Design constraints for Milestone 2 to settle precisely:**

- One operation per engine call is coarse: one rename, one job action, one
  resource closure, one classification. No per-file callbacks cross the
  boundary. Progress, timings, and diagnostics come back through one typed
  event callback; the existing `[mokly:timing]` JSON-lines contract is
  unchanged for consumers of `--debug-timings`.
- Everything that crosses into the engine is UTF-8 text, JSON text, or byte
  buffers. No object graph crosses, so a 24 MB manifest is parsed once in
  Rust instead of being read property by property. Buffers are handed over
  without copying where Node-API allows it. React nodes, functions, consumer
  modules, and PostCSS plugins never cross.
- Every engine error carries a stable code. The TypeScript side maps codes to
  existing `MoklyError` codes and messages; no user-facing wording leaks
  implementation names.
- Long engine operations run off the event loop on an engine-owned thread,
  accept an `AbortSignal`, and stop the Git child process they own on abort.
- The host owns the terminal. The service receives pipes. In plain mode the
  host copies service bytes unchanged, so CI logs, `[mokly/<code>]` lines, and
  timing lines keep their bytes. Rich output follows the terminal output
  contract glyph for glyph. Plain output stays byte-identical to today, and
  the test files that spawn `dist/cli/bin.js` are the conformance suite.
- The host owns the grammar. Clap defines every public command and option.
  The hidden `__serve-child` command leaves the public grammar; the service
  and the child receive validated arguments as JSON and decode them with one
  strict decoder generated from the model crate.
- Only presentation-ready strings cross the host channel: headline, hint,
  code, and plain text. Error wording stays in TypeScript. No manifest,
  review result, or catalogue data crosses the channel.
- The host is the single shutdown owner. It starts the service in a new
  process group on Unix and inside a kill-on-close job object on Windows,
  turns `SIGINT`, `SIGTERM`, and `SIGHUP` into one `shutdown` command, waits
  for a 10 second drain deadline, then terminates the group or job. The shim
  never exits before the host and forwards `SIGTERM` to it.
- The host fails closed with exit status 1 and one `[mokly/host-failed]` line
  on a missing platform package, an unsupported platform, a version mismatch,
  a missing `MOKLY_NODE`, a channel violation, or a service crash without an
  `error` event. The host redacts every `--token` value and `MOKLY_TOKEN`.
- The engine and host versions must equal the CLI package version. A mismatch
  fails the load with the actionable error, not a silent fallback.
- Crates follow the repository Rust rules: trait seams for every impure
  dependency, `unimock` mocks, `thiserror` enums with the `[crate/mod]`
  prefix, `tracing` only in the engine, user-facing writes only in the host,
  no `unwrap`/`expect`/`panic` outside tests, `_tests_` directories, 300-line
  files, and crate READMEs with the required sections. `unsafe` is confined
  to the FFI functions of the platform crate with safety comments.

## Native shape

| Crate                   | Owns                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/mokly-model`    | Every shared shape: manifest, review result, review artifact, change snapshot, preview metadata, markers, engine request and event records, host channel frames, and canonical JSON. Pure data, with TypeScript export. |
| `crates/mokly-engine`   | The `cdylib` Node-API binding. Thin `#[napi]` functions over strings and buffers, error-code mapping, event callback, async wiring. No logic.                                                                           |
| `crates/mokly-host`     | The `mokly-host` binary: clap grammar, help and version, output modes, terminal rendering, reporter, channel listener, service lifecycle, shortcuts, browser opening.                                                   |
| `crates/mokly-platform` | `ExclusiveRename` (`renameat2`, `renamex_np`, `MoveFileExW`), `ProcessJob` (Windows job object), and process-group placement, shared by the engine and the host.                                                        |
| `crates/mokly-git`      | `GitCommandRunner` trait, spawned `git` with the existing batching and output bounds, merge-base, changed paths, batched object reads, and cancellation.                                                                |
| `crates/mokly-review`   | Reader traits, resource graph traversal, materiality, CSS rule attribution, component classification, move pairing, and artifact assembly. Split into more crates when a family grows.                                  |

npm layout:

- `packages/native/<target>/` holds one platform package per target:
  `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, and
  `win32-x64-msvc`. Each is an npm workspace named `@mokly/native-<target>`,
  carries the CLI version, declares `os`, `cpu`, and `libc`, and contains
  `mokly-host` and `mokly-engine.node`. `@mokly/mokly` lists all five under
  `optionalDependencies` at the exact version, as it does for the viewer.
- `src/engine/` owns the engine loader and the committed generated
  declarations. `src/cli/bin.ts` becomes the shim, `src/cli/service.ts` the
  service entry, and `src/cli/child.ts` the watched-child entry.
- `cargo xtask build-native` builds both artifacts for the host target and
  installs them into the workspace package. The `build` npm script runs it, so
  `npm run dev`, tests, and packed smokes use them. The `generate-types`
  xtask command writes the generated TypeScript, and the repository suite
  requires regeneration to be byte-identical.

## Sequencing

Three workspaces that merge soon rewrite the comparison engine and its
formats: Generated Output Simplification (manifest v9, review result v6,
snapshot v3, no output modes), Remove Source-Path Evidence (changed review
evidence and component stylesheets), and Inline Style Ownership with Scalable
Analysis (47 new review files and a rewritten benchmark). Milestones 3 to 5
and 7 to 8 do not depend on them and can proceed. Milestone 6 targets the
formats that are current when it starts and is repeated for a later format
only once. Milestones 9 to 15 start after those branches merge, so the
differential tests have a stable target. The CLI move into `packages/mokly`
changes the `src/` paths named here; apply the new paths when it merges.

## Milestone 1: Contracts and documentation

Define the complete native boundary before any code.

- [x] Create `docs/protocol/mokly-native-engine.md` (at most 250 lines): the
      package layout above, the supported platforms, the loader rules and the
      version check, the exact unavailable-platform error, the data that may
      cross, the event callback shape and its timing mapping, the error-code
      list and its `MoklyError` mapping, cancellation, and each operation's
      inputs and outputs: `engineVersion`, `renameExclusive`, `createProcessJob`
      with `assign`/`terminate`/`dispose`, `resourceClosure`,
      `analyzeStylesheetChange`, `compareCatalogue`, and `classifyChanges`.
- [x] Update `mokly-export-recovery.md` and `mokly-baseline-storage.md`: the
      exclusive rename and the Windows job come from the engine, with the same
      primitives, flags, path rules, synchronous error capture, and fail-closed
      behavior as today. Remove the Koffi references and update the primary
      references.
- [x] Update `mokly-package.md`, `npm-release.md`, `npm-release-operations.md`,
      `npm-release-evidence.md`, and `dependency-security.md`: platform
      packages, exact-version pairing, the publish order (platform packages,
      viewer, CLI), the registry guard for every package, the Rust advisory
      audit and its exception rules, and the removal of `koffi`.
- [x] Update `ci-workflow.md`, `ci-verification.md`,
      `ci-verification-security.md`, and `ci-suite-evidence.md`: the native
      build step in every verification job, the Cargo build cache, the
      release build matrix for the five targets, and the native platform job
      changes.
- [x] Update `mokly-timings.md`: engine spans keep their names and nesting;
      the `review.*` stages report from the engine through the event callback
      with the same session and role; add `engine.load`.
- [x] Update `mokly-changes.md`, `mokly-component-review.md`,
      `mokly-component-changes.md`, `mokly-css-attribution.md`, and
      `mokly-moves.md` Delivery Status lines: the producer is the engine; the
      result schemas are unchanged.
- [x] Update `docs/architecture/package-boundary.md`, `README.md` (Develop
      Mokly, Packages, Documentation), `xtask/README.md`,
      `src/review/README.md`, `src/export/README.md`, and
      `src/baseline/README.md`. README Key code entries for `crates/` and
      `src/engine/` are added when those directories exist.
- [x] Add the new document to `docs/protocol/README.md` and list the supported
      platforms in `docs/guides/start/install.md`.
- [x] Keep this plan's `Status:` paragraph current; there is no plans index
      file.
- [x] Record the 2026-10-05 measurements in `tests/fixtures/large/README.md`
      and point the diagnostic contract at them.
- [x] Validate Prettier, links, anchors, protocol sizes, and the
      protocol-reading tests.
- [x] Commit.

## Milestone 2: Host and shared-definition contracts

Define the host, the package set, and the shared definitions before any code.

- [ ] Update `docs/protocol/mokly-native-engine.md`: rename the packages to
      `@mokly/native-<target>` under `packages/native/`, state that each
      carries the host binary and the engine library, make the engine
      functions take only strings, buffers, and numbers, name `mokly-model` as
      the single source of every shared shape, and point every record shape at
      the generated TypeScript file instead of hand-written interfaces.
- [ ] Add `docs/protocol/mokly-shared-definitions.md` (at most 250 lines):
      the model crate's scope, the generator and its invocation, the output
      files and their byte-identity check, serde and naming rules (tagged
      enums, optional fields, readonly arrays), the one-owner-per-boundary
      validation rule, the parity corpus, and how a format version bump
      changes the Rust types first and the generated files second.
- [ ] Add `docs/protocol/mokly-host.md` (at most 250 lines): process
      topology, shim resolution order with `MOKLY_HOST_BINARY`, the
      environment table (`MOKLY_NODE`, `MOKLY_SERVICE`,
      `MOKLY_PACKAGE_VERSION`, `MOKLY_HOST_CHANNEL`), the fail-closed
      conditions with their exact `[mokly/host-failed]` messages, the
      `--version` source, the shutdown ordering with the 10 second drain
      deadline, process-group and job-object rules, exit status mapping, and
      the supported platforms.
- [ ] Add `docs/protocol/mokly-host-channel.md` (at most 250 lines): socket
      and named-pipe creation, newline-delimited JSON framing with the 1 MiB
      cap, the `hello` and `arguments` handshake, every event and command with
      its fields as generated from the model crate, the `catalogue-ready`
      counted kinds, ordering rules, and failure handling.
- [ ] Update `docs/protocol/mokly-terminal-output.md`: the host is the single
      reporter, service lines cross the channel or the passthrough, the colour
      rule is explicit (`FORCE_COLOR` other than `0` or `false` turns colour
      on; otherwise `NO_COLOR`, `NODE_DISABLE_COLORS`, `TERM=dumb`, or a
      non-TTY stream turns it off), and the legacy Windows console detection
      for the ASCII glyph fallback is exact. Move channel detail into the new
      documents to stay at or below 250 lines.
- [ ] Update `docs/protocol/mokly-terminal-errors.md` with the `host-failed`
      plain lines and their rich headline and hint copy.
- [ ] Update `docs/protocol/mokly-package.md`: the executable is a shim plus
      native host, `__serve-child` and its reserved options leave the public
      grammar, help and version are host-owned, and the package set.
- [ ] Update `npm-release.md`, `npm-release-management.md`,
      `npm-release-operations.md`, `npm-release-evidence.md`,
      `ci-verification.md`, `ci-workflow.md`, and `dependency-security.md` for
      the renamed packages, both artifacts, linked versions, the build matrix,
      the publish order, and the audit scope of first-party optional packages.
- [ ] Update `docs/guides/start/install.md` and
      `docs/guides/cli/options-and-exit-status.md` with the supported
      platforms and the host failure exit status.
- [ ] Update `docs/architecture/build-pipeline.md` and
      `docs/architecture/package-boundary.md` with the process topology and
      the shared-definition rule; add the new documents to
      `docs/protocol/README.md`; update `README.md`.
- [ ] Search `docs/` for `bin.js`, `__serve-child`, `main.js`, and
      `@mokly/engine-` and align every mention.
- [ ] Validate Prettier, links, anchors, protocol sizes, and the
      protocol-reading tests.
- [ ] Commit.

## Milestone 3: Native build skeleton

Both artifacts exist, build, and report their versions. No behavior changes.

- [ ] Add `crates/mokly-model`, `crates/mokly-engine`, `crates/mokly-host`,
      and `crates/mokly-platform` to the Cargo workspace with
      `#![warn(unreachable_pub)]`, module doc comments, READMEs, and `_tests_`
      directories. Use `cargo add` for external crates (`napi`, `napi-derive`,
      `napi-build`, `clap`, `tokio`, `serde`, `serde_json`, `ts-rs`,
      `thiserror`, `tracing`, `windows-sys`, `libc`; `unimock` and `insta` for
      tests) and workspace references for internal crates. The host crate is
      an unpublished binary that prints only `--help`, `--version`, and the
      fail-closed message at this stage.
- [ ] Add the five platform workspace packages, `optionalDependencies` on
      `@mokly/mokly`, the `.gitignore` entries for `target/`, `*.node`, and
      the host binaries, and the release-please `extra-files` entries that
      bump the platform package versions and the exact `optionalDependencies`
      versions together.
- [ ] Add `src/engine/load.ts` with the platform key resolution, the version
      check, the unavailable-platform error, and `engineVersion()`. Commit the
      generated declarations and add a test that regeneration is byte-identical.
- [ ] Add the `build-native [--target <triple>]` xtask command (both
      artifacts, release profile, install into the workspace package) and
      the `generate-types` xtask command. Call `build-native` from the
      `build` npm script and keep that script runnable from source without
      downloading binaries.
- [ ] Extend the repository suite: `cargo fmt`, Clippy, tests, and file-length
      already cover `crates/`; add the Rust advisory audit after the npm audit
      with the documented exception file and expiry rules, and the generated
      TypeScript byte-identity check.
- [ ] CI: add the Rust setup and the native build step to the package, unit,
      browser, hydration, and native jobs; add the pinned Cargo cache action;
      update `tests/ci_workflow.test.ts`.
- [ ] Package suite: pack the host platform package with the viewer and CLI;
      inspect its manifest, `os`/`cpu`/`libc`, both artifacts, files, and
      license; install it explicitly in every packed consumer so no
      unpublished package is resolved from the registry; confirm how npm
      treats the other, unpublished optional packages and document the
      result.
- [ ] Failure-first tests: loader without a platform package, version
      mismatch, wrong platform key, and a successful load.
- [ ] Smoke: `npm run build`, `npm run dev`, `node dist/cli/bin.js --version`,
      and `mokly-host --version` from the workspace package.
- [ ] Commit.

## Milestone 4: Platform primitives replace koffi

- [ ] Implement `ExclusiveRename` in `crates/mokly-platform`: Linux
      `renameat2(RENAME_NOREPLACE)`, macOS `renamex_np(RENAME_EXCL)`, Windows
      `MoveFileExW` with no replace or copy flags and the wide namespaced path.
      Capture `errno`/`GetLastError` synchronously. Reject relative or NUL
      paths before the call. Typed errors carry the OS code.
- [ ] Implement `ProcessJob` for Windows: non-inheritable kill-on-close job,
      `assign(pid)`, `terminate()`, and `dispose()` that waits until the job
      has no active processes. Other platforms return the unsupported error.
      Implement process-group placement for Unix beside it; the host uses both.
- [ ] Expose both through `crates/mokly-engine` and `src/engine/`. Switch
      `src/export/operations.ts` and `src/baseline/process_scope.ts` to the
      engine. Keep the same `MoklyError` codes and messages.
- [ ] Rust unit tests with `unimock` for the error paths; real-filesystem tests
      in the crate for directory moves, Unicode paths, and every competing
      destination kind (empty, populated, file, symlink).
- [ ] Keep `tests/export_rename.test.ts`, the destination-race tests, and the
      baseline platform and process-tree tests green on Linux, macOS, and
      Windows through the native CI job. Replace their direct `koffi` imports.
- [ ] With the user's recorded approval, delete `src/export/rename.ts`,
      `src/baseline/windows_job.ts`, their tests that only exercised koffi, and
      the `koffi` dependency. Update the lockfile and the audit scope.
- [ ] Smoke: export twice into the same directory, then with a competing
      destination; cancel a derived baseline rebuild on Windows CI.
- [ ] Commit.

## Milestone 5: Release packaging

- [ ] Add a release build matrix that builds both artifacts for all five
      targets on GitHub-hosted runners of their own operating system, loads
      the engine and runs `mokly-host --version` on each, uploads the
      artifacts, and lets the publish job download them. Keep the publish job
      on the trusted-publishing runner.
- [ ] Extend `scripts/release/pack.mjs`, `registry.mjs`, `verify-ref.mjs`,
      `scripts/package/pair.mjs`, `archive.mjs`, `manifest.mjs`,
      `packed_manifest.mjs`, and `package-smoke.mjs` from a pair to the
      package set: viewer, five platform packages, CLI. Guard and verify each
      registry package; publish platform packages first, then viewer, then
      CLI.
- [ ] Add the platform packages to `release-please-config.json` and
      `.release-please-manifest.json` with a `linked-versions` group that
      keeps them equal to the CLI version.
- [ ] Update `tests/release_packages.test.ts`, `tests/package.test.ts`,
      `tests/release_config.test.ts`, `tests/release_bootstrap.test.ts`, and
      `tests/helpers/release_fixture.ts` for every manifest, allowlist,
      license, exact version, and the archive contents of a platform package.
- [ ] Extend the package smoke with a step that runs the installed host binary
      with `--help` from the consumer fixture.
- [ ] Dry-run the release workflow logic locally with `workflow_dispatch`
      inputs or script-level tests; a real publication is post-merge.
- [ ] Commit.

## Milestone 6: Shared data model

Rust becomes the single source of every shared shape; TypeScript is generated.

- [ ] Define in `crates/mokly-model` the manifest, review result, review
      artifact, catalogue change snapshot, removed preview metadata, baseline
      completion marker, accepted output snapshot, engine request, event, and
      error records, and the host channel frames, at the format versions that
      are current when this milestone starts. Derive `serde` and `ts-rs` on
      every type with the documented naming and tagging rules.
- [ ] Implement the canonical JSON writer that matches `canonicalJson` byte
      for byte, and the Rust validators for the formats the engine reads.
- [ ] Generate TypeScript with `cargo xtask generate-types` into
      `packages/viewer/src/generated/` and `src/generated/`, with readonly
      arrays and the existing export names. Replace the hand-written
      interfaces in `packages/viewer/src/registry/types.ts`,
      `packages/viewer/src/review/types.ts`,
      `packages/viewer/src/review/component_types.ts`, and the CLI-side copies
      with imports of the generated files, with the user's recorded approval.
      Keep the TypeScript decoders; they now validate against generated types.
- [ ] Parity corpus: every protocol fixture, the example catalogue's manifest
      and review output, and results produced by the existing test producers.
      Rust parses each, re-serializes canonically, and must match the bytes.
      Every rejection fixture of the TypeScript decoders must be rejected by
      the Rust validators.
- [ ] Add the byte-identity check for every generated file to the repository
      suite, and a test that the protocol documents name the generated files
      as the normative shapes.
- [ ] Commit.

## Milestone 7: Host crate

Build and test the host without wiring it to the package. No behavior changes.

- [ ] Define the `thiserror` error enum with typed variants for every
      fail-closed condition and the `[mokly-host/<module>]` message prefix.
- [ ] Implement the clap grammar in `cli.rs` and the validated argument type
      in `arguments.rs` with the exact option-ownership rules and messages from
      `src/cli/arguments.ts`, serialized as JSON for the service through the
      model crate.
- [ ] Implement `help.rs` and `version.rs` with byte-identical help text and
      the `MOKLY_PACKAGE_VERSION` version line.
- [ ] Implement `mode.rs` with the five output-mode rules and the colour rule,
      and `redact.rs` for `--token` values and `MOKLY_TOKEN`, including the
      URL-encoded form.
- [ ] Implement the `terminal` module behind a `Terminal` trait: ANSI-aware
      width measurement, ellipsis truncation with style reset, glyph tables
      with the legacy Windows fallback, the 80 millisecond spinner, and the
      `\r\x1b[2K` erase rule.
- [ ] Implement the `reporter` module: plain passthrough, rich phases,
      one-shot summaries, duration formatting, the Serve header panel,
      lifecycle lines, watch lines with timestamp and path joining, warnings,
      diagnostics, and error headline and hint rendering.
- [ ] Implement the `channel` module behind a `ChannelTransport` trait:
      Unix socket and Windows named-pipe listeners, the frame codec with the
      size cap, the handshake, the typed frames from the model crate, and
      protocol-violation errors.
- [ ] Implement the `service` module: spawn through a `ProcessSpawner` trait
      with the environment contract, process-group and job-object placement
      through `mokly-platform`, stdout and stderr pumps, interrupt coalescing,
      the shutdown command, the drain deadline through a `Clock` trait, forced
      termination, and exit-status mapping.
- [ ] Implement `shortcuts.rs` with raw-mode stdin handling, the key table,
      and restoration on close, and `browser.rs` with the three platform
      launchers behind a `BrowserOpener` trait.
- [ ] Add `_tests_` unit tests with `unimock` for every trait boundary:
      grammar acceptance and rejection messages, mode and colour selection,
      redaction, width and truncation, every reporter line against the
      terminal output contract, duration formatting, channel codec and
      handshake, lifecycle ordering, shutdown deadline, and forced
      termination. Add `insta` file snapshots under `snapshots/` for `--help`
      and the rich Serve header panel.
- [ ] Add a hermetic binary integration test under `tests/` that runs
      `mokly-host --help` and `--version` and checks the fail-closed message
      when `MOKLY_NODE` is missing.
- [ ] Run the Rust formatting check, Clippy with warnings denied,
      `cargo test --workspace`, and `cargo xtask rust-file-length-lint --all`.
- [ ] Commit.

## Milestone 8: Host switch-over

The host runs every command. This is the only host milestone that changes
behavior.

- [ ] Replace `src/cli/arguments.ts` with a strict decoder for the validated
      argument object generated from the model crate, and change `run()` to
      accept decoded arguments instead of argv.
- [ ] Add `src/cli/service.ts`: connect to `MOKLY_HOST_CHANNEL`, send `hello`,
      receive `arguments`, build a `HostReporter` that implements
      `CliReporter` and `ServeReporter` as channel events, run the command,
      handle the `rebuild` and `shutdown` commands, redact before sending, and
      flush the channel before exit.
- [ ] Add `src/cli/child.ts` as the watched-child entry that decodes its
      arguments from one JSON argv item, and change
      `src/server/serve_lifecycle.ts` to fork it instead of `bin.js`.
- [ ] Rewrite `src/cli/bin.ts` as the shim: keep `bootstrapCli`, resolve the
      host, check the platform package version, set the environment contract,
      spawn with inherited stdio, forward `SIGTERM`, never exit first, and
      return the host status.
- [ ] With the user's recorded approval, delete the files listed under
      removal 3 and remove their exports; lower the unused-internal-export
      baseline if the ratchet reports it.
- [ ] Add `tests/helpers/recording_reporter.ts` and switch the tests that
      imported the deleted modules (`link_control_cli`, `cli_build_warnings`,
      `publish_output`, `build_warning_compatibility`, `cli_shortcuts`,
      `export_cli`, `publish_cli`, `changes`, `timings`, `package`, and
      `tests/helpers/serve_ready_signal_preload.ts`) to the helper, the
      decoder, or a help-text fixture. Update `watched_child_startup` and
      `watch_child_exit` for the child entry and its JSON argument.
- [ ] Export `MOKLY_HOST_BINARY` from `scripts/verification/unit-runner.mjs`,
      `run-browser.mjs`, `scripts/large/cli.mjs`, and a new
      `scripts/host/run.mjs` used by `npm run dev`, pointing at the local
      release build; the package smoke must not set it.
- [ ] Add host end-to-end TypeScript tests through the shim: `--help` bytes,
      `--version`, every `cli-invalid` message, plain passthrough bytes for
      `build`, `check`, and `--debug-timings`, service stdout and stderr
      ordering, interrupt during Serve, forced termination after an
      unresponsive service, missing `MOKLY_NODE`, missing platform package,
      and version mismatch. Run the lifecycle tests in the native CI job so
      interrupt handling runs on macOS and Windows.
- [ ] Run a pseudo-terminal smoke for rich Serve: header panel, lifecycle
      lines, every shortcut, Ctrl+C, and a service diagnostic while the
      spinner runs; record the transcript under `.context/`.
- [ ] Update `src/cli/README.md`, `crates/mokly-host/README.md`, the root
      `README.md` develop and key-code sections, and `xtask/README.md`.
- [ ] Commit.

## Milestone 9: Scale evidence tests

Capture the two defects as failing acceptance tests before fixing them.

- [ ] Adopt the rewritten `scripts/large/benchmark.mjs` from the inline style
      branch once it merges, or repair the stale colour-scheme toggle wait if
      it has not; make the opt-in benchmark pass through the shell pages.
- [ ] Add Changes-ready and peak-memory assertions to the opt-in benchmark and
      an export run with a memory budget; reuse the `heapPeakMiB` counter where
      it exists; record the budget in `mokly-timings.md`. Both fail today.
- [ ] Add a resource-graph occurrence accounting test on a small generated
      fixture: count `review.resource-graph` occurrences per view and compare
      with the allowance in the timing contract. Record any excess from the
      large run as a defect with a covering test.
- [ ] Add a bridge benchmark: register a 150 MB generation and a 25 MB
      manifest through the engine and assert the transfer stays under 5% of
      the classification time.
- [ ] Commit.

## Milestone 10: Resource closure in Rust

- [ ] Add `crates/mokly-review` reader traits: current outputs (in-memory map
      or output directory), public files with exclusions, baseline reads, and
      the confinement rules. Add `crates/mokly-git` with the batched object
      reads, bounds, and cancellation.
- [ ] Port reference extraction (HTML through `html5ever`, CSS through the
      `lightningcss` crate) and the transitive traversal with the 64 MiB bound,
      alias handling, and verified-deletion checks.
- [ ] Expose `resourceClosure`; call it from `resource_graph.ts` when the
      engine is available, behind the transitional `MOKLY_NATIVE_ENGINE`
      switch documented in the protocol.
- [ ] Differential tests: run both implementations over the parity corpus and
      the test fixtures; closures must be identical. Timing events must match
      the contract.
- [ ] Commit.

## Milestone 11: Entry comparison loop in Rust

- [ ] Port ignore normalization, material keys, document and page materiality,
      the unchanged-view fast path decision, and the screen, document, page,
      and flow comparison loop.
- [ ] Expose `compareCatalogue` for a catalogue without registered components;
      keep component catalogues on the TypeScript path until Milestone 13.
- [ ] Differential tests over the corpus; the `review.compare-screens` counts
      record must match.
- [ ] Commit.

## Milestone 12: CSS rule attribution in Rust

- [ ] Port rule collection, the multiset diff, selector matching with the
      ordered keep policy through the `selectors` crate against the
      `html5ever` tree, and the reduction to one outcome. Include the inline
      style attribution engine, shared page parses, and the style-only route
      once the inline style branch has merged.
- [ ] Expose `analyzeStylesheetChange`; differential tests over the CSS
      fixtures and the review CSS test corpus, including every unresolved
      construct in the keep-list.
- [ ] Commit.

## Milestone 13: Component classification in Rust

- [ ] Port ownership projection, range validation, instance pairing, affected
      consumers, variant classification, path evidence, and source validation.
- [ ] `compareCatalogue` now handles component catalogues; differential tests
      over the corpus and the component fixtures.
- [ ] Commit.

## Milestone 14: Moves, Git evidence, and artifact assembly in Rust

- [ ] Port merge-base resolution, changed-path discovery, baseline manifest
      reading, move pairing with its similarity passes, artifact assembly, and
      the removed-page preview capture. Return resource bytes without copying.
- [ ] Expose `classifyChanges`: one call does the whole classification for
      Serve, export, publication, and the preview scripts, with cancellation
      and progress events. A generation is registered once and later calls
      name it by id.
- [ ] Differential tests over the corpus; the Serve snapshot and the export
      artifact must be identical.
- [ ] Commit.

## Milestone 15: Engine owns Changes

- [ ] Switch the background worker, export, publication, and the preview
      scripts to `classifyChanges`. Remove the 1 GB worker cap or replace it
      with the engine's documented budget.
- [ ] With the user's recorded approval, delete the TypeScript comparison
      implementation, the transitional switch, and the dependencies no other
      module uses. `parse5` stays for build validation.
- [ ] Update every README and protocol Delivery Status touched by the removal.
- [ ] Commit.

## Milestone 16: Verification, close-out, and review

- [ ] Run the opt-in large fixture: Serve reaches Changes ready inside the
      budget without a worker death; export completes; record the new spans
      beside the 2026-10-05 numbers in the fixture guide.
- [ ] Smoke on the example catalogue through the host: `npm run dev`, build,
      check, export, a preview build with Changes, and an interrupted Serve.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report findings with numbers,
      severities, impact, lettered options, and a recommendation; do not change
      the implementation.

## Post-merge follow-up (non-blocking)

- The first release after the merge publishes the five platform packages
  before the viewer and the CLI. Verify each registry package, verify that the
  release-please pull request keeps them at the CLI version, and run
  `npx @mokly/mokly --version` and an export on Linux, macOS, and Windows,
  including through the public composite GitHub Action on an Ubuntu runner.
- Decide on a WebAssembly build of the engine as the fallback for platforms
  without a native package, and on `linux-*-musl` and `win32-arm64` targets.
- Consider the next engine phases from the measurements: the post-render HTML
  passes (21 to 32 s per command) and watcher resource discovery (29 to 33 s
  per Serve start).
- Decide whether an interim TypeScript mitigation for the Serve worker cap is
  wanted before the engine lands; it would be a separate plan.
