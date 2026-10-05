# Native Rust Engine

Status: Active. Created 2026-10-05 with the user's consent after the
measurement step recorded below. Milestone 1 is complete: the native engine
contract and every dependent document name it as the approved target, and the
measurements are recorded in the fixture guide. No code has changed. The raw
measurement logs and the span aggregator live under `.context/timings/` on the
measuring machine; they are not tracked.

**Goal:** add a Rust engine that the TypeScript CLI loads in its own process
through Node-API bindings built with napi-rs. Move the work that does not need
React or consumer JavaScript into that engine, one bounded phase at a time.
Keep one runtime, one test suite, one copy of every schema, and the same
public CLI, manifest v8, review result v5, and read model v4.

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

Rendering stays JavaScript, so a Rust host would not change the largest cost.
The comparison engine is pure data work, is the slowest phase once Changes
runs, and is the phase that fails on memory. It is the first engine phase.
The post-render HTML passes and watcher resource discovery are later
candidates and are out of scope here.

**Decisions (from the discussion that led to this plan):**

- Rust runs inside the Node process through napi-rs. There is no sidecar
  process and no embedded JavaScript engine.
- The first change carried through the new native build is the replacement of
  the `koffi` FFI bridge: exclusive directory rename on Linux, macOS, and
  Windows, and the Windows job object for baseline commands.
- The comparison engine moves to Rust next, in phases, each proven by
  differential tests against the TypeScript implementation on real outputs.
- The viewer package keeps the canonical TypeScript schemas. Rust mirrors them
  and proves parity by round-trip tests on real outputs; a drift fails tests.
- On a supported platform the engine is required, like the native Lightning
  CSS binary is required today. An unsupported platform fails the engine-backed
  command with one actionable error. There is no copy fallback for rename.
- Removals need the user's explicit approval before their TODO runs: (1)
  `koffi`, `src/export/rename.ts`, and `src/baseline/windows_job.ts`; (2) the
  TypeScript comparison implementation after the Rust engine owns every phase.
  Record each approval in this Status before deleting.

**Design constraints for Milestone 1 to settle precisely:**

- One operation per engine call is coarse: one rename, one job action, one
  resource closure, one classification. No per-file callbacks cross the
  boundary. Progress, timings, and diagnostics come back through one typed
  event callback; the existing `[mokly:timing]` JSON-lines contract is
  unchanged for consumers of `--debug-timings`.
- Everything that crosses is JSON-serializable data, UTF-8 strings, or byte
  buffers. React nodes, functions, consumer modules, and PostCSS plugins never
  cross. Byte buffers are handed over without copying where Node-API allows it.
- Every engine error carries a stable code. The TypeScript side maps codes to
  existing `MoklyError` codes and messages; no new user-facing wording leaks
  implementation names such as napi, cdylib, or crate names.
- Long operations run on a Node-API async task, accept an `AbortSignal`, and
  stop the Git child process they own on abort.
- The engine version must equal the CLI package version. A mismatch fails the
  load with the actionable error, not a silent fallback.
- Crates follow the repository Rust rules: trait seams for every impure
  dependency, `unimock` mocks, `thiserror` enums with the `[crate/mod]` prefix,
  `tracing` only, no `unwrap`/`expect`/`panic` outside tests, `_tests_`
  directories, 300-line files, crate READMEs with the required sections.
  `unsafe` is confined to the FFI functions of the platform crate with safety
  comments.

## Engine shape

| Crate                       | Owns                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/mokly-engine`       | The `cdylib` Node-API binding. Thin `#[napi]` functions and classes, error-code mapping, event callback, async task wiring. No logic.                                                  |
| `crates/mokly-platform`     | `ExclusiveRename` (`renameat2`, `renamex_np`, `MoveFileExW`) and `ProcessJob` (Windows job object) traits with the platform implementations.                                           |
| `crates/mokly-review-model` | `serde` types for manifest v8, review result v5, the review artifact, the catalogue change snapshot v2, and canonical JSON output. Pure data.                                          |
| `crates/mokly-git`          | `GitCommandRunner` trait, spawned `git` with the existing batching and output bounds, merge-base, changed paths, batched object reads, and cancellation.                               |
| `crates/mokly-review`       | Reader traits, resource graph traversal, materiality, CSS rule attribution, component classification, move pairing, and artifact assembly. Split into more crates when a family grows. |

npm layout:

- `src/engine/` owns the loader and the committed generated declarations. The
  loader resolves `@mokly/engine-<platform>` from the CLI package, checks the
  version, and exposes typed functions. It never falls back to another
  implementation of an engine-only operation.
- `crates/mokly-engine/npm/<target>/` holds one platform package per target:
  `linux-x64-gnu`, `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`,
  `win32-x64-msvc`. Each is an npm workspace, carries the CLI version, and
  declares `os`, `cpu`, and `libc`. `@mokly/mokly` lists them under
  `optionalDependencies` at the exact version, as it does for the viewer.
- `npm run build` builds the host target and installs the binary into its
  workspace package, so `npm run dev`, tests, and packed smokes use it.

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

## Milestone 2: Native build skeleton

The engine exists, loads, and reports its version. No behavior changes.

- [ ] Add `crates/mokly-engine` and `crates/mokly-platform` to the Cargo
      workspace with `#![warn(unreachable_pub)]`, module doc comments, READMEs,
      and `_tests_` directories. Use `cargo add` for external crates
      (`napi`, `napi-derive`, `napi-build`, `thiserror`, `tracing`,
      `windows-sys`, `libc`) and workspace references for internal crates.
- [ ] Add the five platform workspace packages, `optionalDependencies` on
      `@mokly/mokly`, the `.gitignore` entries for `target/` and `*.node`, and
      the release-please `extra-files` entries that bump the platform package
      versions and the exact `optionalDependencies` versions together.
- [ ] Add `src/engine/load.ts` with the platform key resolution, the version
      check, the unavailable-platform error, and `engineVersion()`. Commit the
      generated declarations and add a test that regeneration is byte-identical.
- [ ] Add `cargo xtask build-engine` (host target, release profile, install into
      the workspace package). Call it from the `build` npm script and keep
      that script runnable without a network.
- [ ] Extend the repository suite: `cargo fmt`, Clippy, tests, and file-length
      already cover `crates/`; add the Rust advisory audit after the npm audit
      with the documented exception file and expiry rules.
- [ ] CI: add the Rust setup and the native build step to the package, unit,
      browser, hydration, and native jobs; add the pinned Cargo cache action;
      update `tests/ci_workflow.test.ts`.
- [ ] Package suite: pack the host platform package with the viewer and CLI;
      inspect its manifest, `os`/`cpu`/`libc`, files, and license; install it
      explicitly in every packed consumer so no unpublished package is resolved
      from the registry; confirm how npm treats the other, unpublished optional
      packages and document the result.
- [ ] Failure-first tests: loader without a platform package, version
      mismatch, wrong platform key, and a successful load.
- [ ] Smoke: `npm run build`, `npm run dev`, `node dist/cli/bin.js --version`.
- [ ] Commit.

## Milestone 3: Platform primitives replace koffi

- [ ] Implement `ExclusiveRename` in `crates/mokly-platform`: Linux
      `renameat2(RENAME_NOREPLACE)`, macOS `renamex_np(RENAME_EXCL)`, Windows
      `MoveFileExW` with no replace or copy flags and the wide namespaced path.
      Capture `errno`/`GetLastError` synchronously. Reject relative or NUL
      paths before the call. Typed errors carry the OS code.
- [ ] Implement `ProcessJob` for Windows: non-inheritable kill-on-close job,
      `assign(pid)`, `terminate()`, and `dispose()` that waits until the job
      has no active processes. Other platforms return the unsupported error.
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

## Milestone 4: Release packaging

- [ ] Add a release build matrix that builds all five targets on GitHub-hosted
      runners, uploads the binaries as artifacts, and lets the publish job
      download them. Keep the publish job on the trusted-publishing runner.
- [ ] Extend `scripts/release/pack.mjs`, `registry.mjs`, `verify-ref.mjs`,
      `scripts/package/pair.mjs`, and `package-smoke.mjs` from a pair to the
      full set: viewer, five platform packages, CLI. Guard and verify each
      registry package; publish platform packages first, then viewer, then CLI.
- [ ] Update `tests/release_packages.test.ts` and `tests/package.test.ts` for
      every manifest, allowlist, license, exact version, and the archive
      contents of a platform package.
- [ ] Dry-run the release workflow logic locally with `workflow_dispatch`
      inputs or script-level tests; a real publication is post-merge.
- [ ] Commit.

## Milestone 5: Review data model in Rust

- [ ] Add `crates/mokly-review-model` with `serde` types for manifest v8,
      review result v5, the review artifact, the catalogue change snapshot v2,
      removed preview metadata v3, and the canonical JSON writer that matches
      `canonicalJson` byte for byte.
- [ ] Parity corpus: every protocol fixture, the example catalogue's manifest
      and review output, and results produced by the existing test producers.
      Rust parses each, re-serializes canonically, and must match the bytes.
      Every rejection fixture of the TypeScript validators must be rejected.
- [ ] Expose `parseReviewResult` and `parseManifest` through the engine for the
      corpus test only; they are not public operations.
- [ ] Commit.

## Milestone 6: Scale evidence tests

Capture the two defects as failing acceptance tests before fixing them.

- [ ] Repair `scripts/large/benchmark.mjs`: it waits for a color-scheme toggle
      that the current Appearance selector no longer renders. Make the opt-in
      benchmark pass on the committed-mode fixture through the shell pages.
- [ ] Add Changes-ready and peak-memory assertions to the opt-in benchmark and
      an export run with a memory budget; record the budget in
      `mokly-timings.md`. Both fail today.
- [ ] Add a resource-graph occurrence accounting test on a small generated
      fixture: count `review.resource-graph` occurrences per view and compare
      with the allowance in the timing contract. Record any excess from the
      large run as a defect with a covering test.
- [ ] Commit.

## Milestone 7: Resource closure in Rust

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

## Milestone 8: Entry comparison loop in Rust

- [ ] Port ignore normalization, material keys, document and page materiality,
      the unchanged-view fast path decision, and the screen, document, page,
      and flow comparison loop.
- [ ] Expose `compareCatalogue` for a catalogue without registered components;
      keep component catalogues on the TypeScript path until Milestone 10.
- [ ] Differential tests over the corpus; the `review.compare-screens` counts
      record must match.
- [ ] Commit.

## Milestone 9: CSS rule attribution in Rust

- [ ] Port rule collection, the multiset diff, selector matching with the
      ordered keep policy through the `selectors` crate against the
      `html5ever` tree, and the reduction to one outcome.
- [ ] Expose `analyzeStylesheetChange`; differential tests over the CSS
      fixtures and the review CSS test corpus, including every unresolved
      construct in the keep-list.
- [ ] Commit.

## Milestone 10: Component classification in Rust

- [ ] Port ownership projection, range validation, instance pairing, affected
      consumers, variant classification, path evidence, and source validation.
- [ ] `compareCatalogue` now handles component catalogues; differential tests
      over the corpus and the component fixtures.
- [ ] Commit.

## Milestone 11: Moves, Git evidence, and artifact assembly in Rust

- [ ] Port merge-base resolution, changed-path discovery, baseline manifest
      reading, move pairing with its similarity passes, artifact assembly, and
      the removed-page preview capture. Return resource bytes without copying.
- [ ] Expose `classifyChanges`: one call does the whole classification for
      Serve, export, publication, and the preview scripts, with cancellation
      and progress events.
- [ ] Differential tests over the corpus; the Serve snapshot and the export
      artifact must be identical.
- [ ] Commit.

## Milestone 12: Engine owns Changes

- [ ] Switch the background worker, export, publication, and the preview
      scripts to `classifyChanges`. Remove the 1 GB worker cap or replace it
      with the engine's documented budget.
- [ ] With the user's recorded approval, delete the TypeScript comparison
      implementation, the transitional switch, and the dependencies no other
      module uses. `parse5` stays for build validation.
- [ ] Update every README and protocol Delivery Status touched by the removal.
- [ ] Commit.

## Milestone 13: Verification, close-out, and review

- [ ] Run the opt-in large fixture: Serve reaches Changes ready inside the
      budget without a worker death; export completes; record the new spans
      beside the 2026-10-05 numbers in `mokly-timings.md`.
- [ ] Smoke on the example catalogue: `npm run dev`, build, check, export, and
      a preview build with Changes.
- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md`. Report findings with numbers,
      severities, impact, lettered options, and a recommendation; do not change
      the implementation.

## Post-merge follow-up (non-blocking)

- The first release after the merge publishes the five platform packages
  before the viewer and the CLI. Verify each registry package and run
  `npx @mokly/mokly --version` and an export on Linux, macOS, and Windows.
- Decide on a WebAssembly build of the engine as the fallback for platforms
  without a native package, and on `linux-*-musl` and `win32-arm64` targets.
- Consider the next engine phases from the measurements: the post-render HTML
  passes (21 to 32 s per command) and watcher resource discovery (29 to 33 s
  per Serve start).
- Decide whether an interim TypeScript mitigation for the Serve worker cap is
  wanted before the Rust engine lands; it would be a separate plan.
