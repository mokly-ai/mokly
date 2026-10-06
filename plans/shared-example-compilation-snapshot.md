# Shared Example Compilation Snapshot

Status: Active. All six milestones are complete on draft PR
[#138](https://github.com/mokly-ai/mokly/pull/138); the plan closes when that
PR merges. Three review findings stay open for the user to decide; Milestone
6 lists them.

## Status And Outcome

Compile the `examples/basic` catalogue once per unit verification run. Load
that result from a repository-local snapshot in every test file that reads the
compiled example. Keep every assertion unchanged, and keep a compile fallback
for test files run by hand without a fresh snapshot.

This change covers test helpers, verification scripts, the xtask unit suite,
and their documentation. It needs no product code, UI, or mockup work. The
product CLI, `prepare:verification`, the package suite, and the browser suites
stay unchanged.

The two attribution tests (`tests/design_library_attribution.test.ts` and
`tests/component_design_attribution.test.ts`) are restructured in a separate
workspace. This plan only changes the fixture they share, and only in a way
that the restructured files inherit automatically. See Milestone 4.

Contract owners:

- [CI suite evidence](../docs/protocol/ci-suite-evidence.md) owns the snapshot
  contract added by Milestone 1.
- [CI verification](../docs/protocol/ci-verification.md) owns the unit gate's
  preparation sequence.
- [Local verification](../xtask/README.md) and the
  [developer section of the README](../README.md#develop-mokly) own the
  developer-facing commands.

## Measured Baseline

Measurements come from the unit reports of the latest green `main` run,
[GitHub Actions run 37354719684](https://github.com/mokly-ai/mokly/actions/runs/37354719684)
(Node 22.14.0, four shards, 2 vCPU runners), and from this VM (8 cores,
Node 22.14.0). Local numbers are observations, not fixed guarantees.

| Measure                                                       |                          Value |
| ------------------------------------------------------------- | -----------------------------: |
| Unit test files observed in CI                                |                            751 |
| Summed per-file unit time in CI                               |                        3,492 s |
| Summed per-file time of shards 1 to 4                         | 1,201 s, 552 s, 492 s, 1,247 s |
| Files that import `designCatalogue` (directly or via helpers) |                             34 |
| Summed CI time of those 34 files                              |                          510 s |
| Per-file CI time of those 34 files                            |               10.7 s to 25.0 s |
| Two attribution tests (separate workspace)                    |                          807 s |
| `tests/design_screen_counts.test.ts` locally, one test        |                         17.0 s |
| `tests/derived_config.test.ts` locally, six tests, no compile |                          0.6 s |
| One `compileCatalogue` of the example locally                 |                         17.4 s |
| `loadConfig` of the example locally                           |                          84 ms |
| Serialize and write a complete compilation locally            |                27.7 MB, 0.46 s |
| Read, parse, and decode that file locally                     |                         0.34 s |

A local experiment proved two properties that this plan depends on:

- A compilation survives the round trip through JSON exactly. The manifest is
  deep-equal, all 472 outputs are byte-equal, and `deliveredStyleSources` and
  `documentMarkdown` are equal.
- A compile of a copy made by `copyExampleSources` is identical to a compile of
  the checked-out example. Only the resolved config differs, in `configPath`,
  `roots`, `mockupsDir`, `renderer`, `postcss`, `repoRoot`, `review`,
  `resolvedFiles`, `protectedFiles`, and `entryModules`.

The request estimated 52 files and about 760 s. The reports show 34 files and
510 s for the shared compile, plus the attribution fixture's before states.
The expected saving is therefore about 460 s from the 34 files and about 90 s
from the fixture, minus about 40 s for the two new tests that compile. Each
affected file should drop from about 15 s to about 1 s to 2 s.

## Where The Compiles Come From

| Helper or test                                                 | Consumers                                                                                  | What it compiles                                              | CI time | Plan                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------: | ----------------------------------------------------- |
| `tests/helpers/design_catalogue.ts`                            | 34 test files; also `design_stacks.ts`, `design_rows.ts`, `design_component_navigation.ts` | The example, once per test process                            |   510 s | Load the snapshot; compile only as fallback           |
| `tests/helpers/design_library_fixture.ts`                      | Two attribution tests, six fixture calls                                                   | A copied example as the before state, then every edited state |   807 s | Before state from the snapshot in the default mode    |
| `tests/helpers/example_baseline.ts`                            | `preview.test.ts`, `example_baseline.test.ts`, browser fixtures                            | Copies with changed config profiles and historical rebuilds   |   109 s | Unchanged; the preparation is the behavior under test |
| `tests/helpers/move_catalogue.ts`                              | Seven move tests                                                                           | A small synthetic catalogue, not the example                  |       — | Unchanged                                             |
| `tests/build.test.ts`                                          | One test                                                                                   | The example, once                                             |    13 s | Unchanged; it is explicit compile coverage            |
| `tests/helpers/design_palette.ts`                              | Appearance tests                                                                           | Nothing; it reads `generated/design.css`                      |       — | Unchanged                                             |
| `route_scoped_catalogue_real`, `server_route_scoped_bootstrap` | Two tests                                                                                  | Nothing; they read the generated manifest                     |       — | Unchanged                                             |

The two native CI jobs run named test files directly. None of those files
imports `designCatalogue`, so they never need the snapshot.

## Design

### Snapshot file

The snapshot is one JSON file at `.context/verification/example-compilation.json`.
The directory is Git-ignored and already holds package artifacts. The file
holds `schemaVersion`, the freshness `key`, the manifest, every output encoded
with `transferGeneratedFile`, `deliveredStyleSources`, and `documentMarkdown`.
The producer writes a temporary file beside it and renames it into place, so a
reader never sees a partial file. It computes the key before and after the
compile and fails without writing when an input changed during the compile.

### Freshness key

The key is a SHA-256 digest over sorted pairs of repository-relative path and
content digest for:

- every tracked or untracked non-ignored file under `examples/basic`,
  `docs/protocol`, and `README.md`, listed with
  `git ls-files --cached --others --exclude-standard`, which is the inventory
  `copyExampleSources` already uses; a tracked file that is missing from the
  working tree hashes as missing instead of failing;
- every regular file under `dist/` and `packages/viewer/dist/`;
- `package-lock.json`, which pins every dependency the example bundles, and
  `tsconfig.json`, which esbuild reads for every example module;
- the snapshot schema version.

A symbolic link hashes as its target text. The key reads files synchronously:
on the implementation VM, synchronous reads hash the 3,736 inputs in about
0.14 s, and asynchronous reads through the four-thread pool take about 1 s.

Generated HTML, the generated manifest, and `generated/mokly-generated/` are
ignored outputs, so they never enter the key. The key covers about 430 example
files and about 3,300 built files, which hashes in about a quarter of a second
including the Git listing.
Producer and consumers share one key function, so a mismatch can only mean
that an input changed after the snapshot was written.

### Producer

`node scripts/verification/example-snapshot.mjs` loads the example config,
compiles once with `compileCatalogue`, and writes the snapshot. When the
existing snapshot already carries the current key, it exits without compiling.
A new `prepare:unit` npm script runs `prepare:verification` and then this
producer. The xtask unit suite and `npm test` use `prepare:unit`. The package,
browser, and hydration suites keep `prepare:verification`, because they never
read the snapshot and the extra compile would cost them about 17 s each.

### Consumers and fallback

A new helper, `tests/helpers/example_compilation.ts`, exports
`exampleCompilation()`. It computes the key, reads the snapshot when the key
matches, and otherwise compiles with `loadConfig` and `compileCatalogue`. It
never writes the snapshot, so test processes never share mutable state. It
emits `[mokly:fixture-timing]` lines through the existing `timeFixturePhase`
helper with fixture `example-compilation`: phase `snapshot` measures the
lookup, and a fallback adds phase `compile:missing`, `compile:stale`, or
`compile:invalid`, so logs show which path ran and why. `designCatalogue` becomes `exampleCompilation()`; its name and
type do not change, so the 34 importers do not change.

A decoded compilation has no retained consumer runtime in the
`component_runtime` WeakMap. No test among the consumers calls
`componentRuntime`; `writeCompilation`, `classifyComponents`, and the parse5
helpers only read `manifest` and `outputs`.

### Preparation and the strict runner

`requirePrepared` gains a `unit` kind that also requires the snapshot file to
exist, with a message that names `npm run prepare:unit`. Both unit runners use
it. The runner only checks existence and never imports the compiler, because
`tests/verification_wrapper.test.ts` runs the copied runner in a harness with
empty placeholder outputs and no `dist`. Freshness stays with the helper, which
falls back to a compile. Per-file timings in the unit reports and the fixture
timing lines show whether the snapshot was used.

### Alternatives considered

- Producing the snapshot inside `prepare:verification`: rejected, because it
  adds one compile to every package, browser, and hydration job.
- Emitting the snapshot from the product `build` command: rejected, because it
  adds a test-only flag to the public CLI.
- Reading `examples/basic/generated/` back as the compilation: rejected, because
  `deliveredStyleSources` and `documentMarkdown` are not on disk and the
  generated tree mixes authored stylesheets with outputs.
- Letting the helper write the snapshot on fallback: rejected, because two
  concurrent test files would race to write 27 MB and tests would own shared
  state.

## Milestone 1: Document the snapshot contract — completed

Define the complete contract before any script or helper changes.

- [x] Add an `Example Compilation Snapshot` section to
      `docs/protocol/ci-suite-evidence.md`: file location and schema, the
      freshness key inputs, the producer command and its skip-when-fresh rule,
      atomic replacement, the `prepare:unit` sequence, the existence check in
      the unit runners, the helper fallback, the fixture timing evidence, and
      the rule that tests never write the snapshot. Mark the contract pending
      until Milestone 5 lands.
- [x] Edit the unit row of the gate table and the "Xtask prepares output per
      suite" paragraph in `docs/protocol/ci-verification.md` in place. The file
      has 247 lines and no reviewed cap; keep it at or under 250 lines, and
      move any overflow to `ci-suite-evidence.md`.
- [x] Update the `Develop Mokly` section of `README.md`: what `npm test` and
      `npm run prepare:unit` produce, where the snapshot lives, how a single
      test file run by hand behaves, and how to refresh a stale snapshot.
- [x] Update the testing paragraph of `examples/basic/README.md`, which says
      that `npm test` builds the example before tests read its generated files.
- [x] Update `xtask/README.md`: the unit suite prepares the snapshot, and add
      the new scripts under `Key Code`.
- [x] Validate the changed Markdown with `npx prettier --check`, run
      `tests/protocol_doc_sizes.test.ts`, check the local links, and review the
      documentation diff.

## Milestone 2: Snapshot key, codec, and producer — completed

Add the shared scripts and prove them with tests before any consumer exists.
The repository keeps working because nothing calls them yet.

- [x] Add failure-first tests in `tests/example_compilation_key.test.ts` using
      a temporary Git repository with a few example-like files, an ignored
      file, and a fake `dist/`: identical trees give the same key; a content
      edit, an added untracked file, a rename, a deleted tracked file, and a
      built-output edit each change the key; an ignored-file edit does not.
- [x] Implement `scripts/verification/example-snapshot-key.mjs`: the input path
      list, the Git inventory, the built-output walk, POSIX path normalization,
      code-unit ordering, and the digest. Export the inventory so
      `tests/helpers/example_sources.ts` can use the same path list.
- [x] Add failure-first tests in `tests/example_compilation_snapshot.test.ts`
      for the codec and producer with a small synthetic compilation that has
      text and binary outputs: exact round trip; rejection of a wrong schema
      version, a missing key, invalid base64, and a manifest that fails
      `parseManifest`; atomic replacement; skip when fresh; rewrite when stale.
- [x] Implement `scripts/verification/example-snapshot.mjs`: the snapshot path,
      `encodeCompilation`, `decodeCompilation` using `parseManifest` and
      `receiveGeneratedFile`, `readExampleSnapshot` returning `fresh`, `stale`,
      `missing`, or `invalid` with the compilation when fresh,
      `writeExampleSnapshot`, and the CLI entry that compiles only when needed.
      Import `dist` modules only inside this module, never from the runner.
- [x] Add `.d.mts` declarations for both scripts and run
      `npm run typecheck:script-declarations` and `npm run lint`.
- [x] Add the real-example equivalence test: run the producer into a temporary
      path, decode it, and compare with the compilation the producer returned.
      Require a deep-equal manifest, byte-equal outputs for every route, and
      equal `deliveredStyleSources` and `documentMarkdown`.
- [x] Keep every new file under 300 lines and run the new tests.

Delivered notes:

- `parseManifest` costs about 2.1 s per decode on the 4.4 MB example manifest
  on the implementation VM, because it re-hashes and re-validates every
  component record. The compile already runs it before it serializes
  `mokly-manifest.json`. `decodeCompilation` therefore requires the manifest
  object to serialize exactly to that output instead, which takes about
  0.47 s and still rejects any manifest that differs from the validated one.
  A full fresh decode now takes about 0.4 s instead of about 2.3 s.
- The compile emits binary assets as plain `Uint8Array` values, while
  `receiveGeneratedFile` returns a `Buffer`. Decoding returns a plain
  `Uint8Array` view, and the real-example test checks the constructor of
  every binary output.
- The key also hashes `tsconfig.json`, because esbuild reads it for every
  example module, and hashes a symbolic link as its target text.
- `readExampleSnapshot` moved to Milestone 3. The unused-internal-export
  ratchet rejects a script export that no module imports, and its only
  consumer is the Milestone 3 helper.
- `tests/helpers/compilation_equality.ts` holds the shared equality assertion,
  and `tests/example_compilation_round_trip.test.ts` holds the real-example
  test, so the fast codec tests stay separate from the 17 s to 45 s compile.

## Milestone 3: Load the snapshot in the test helpers — completed

Switch `designCatalogue` to the snapshot with a compile fallback.

- [x] Add failure-first tests in `tests/example_compilation_loader.test.ts`
      with injected read, compile, and timing dependencies: a fresh snapshot is
      decoded and compile is not called; `missing`, `stale`, and `invalid` each
      call compile once; the timing record carries the phase and status; the
      result is memoized per process.
- [x] Implement `tests/helpers/example_compilation.ts` with
      `exampleCompilation()` and an injectable `loadExampleCompilation`.
- [x] Point `designCatalogue` in `tests/helpers/design_catalogue.ts` at
      `exampleCompilation()` and update its doc comment. Keep the export name
      and type.
- [x] Run all 34 consumer files twice, once with a fresh snapshot present and
      once with it absent, and require identical results on both paths.
- [x] Record interim local timings for `design_screen_counts`,
      `design_variants`, `design_library_inventory`, and `brand_logo` with
      the snapshot present.

Delivered notes:

- The helper emits a `snapshot` timing line for every lookup and, on a
  fallback, a second `compile:missing`, `compile:stale`, or `compile:invalid`
  line. Each line times one real phase with the unchanged `timeFixturePhase`
  helper, which now exports its `FixtureTimingOptions` type.
- `exampleCompilationLoader` memoizes one load per process; the loader tests
  inject the read, compile, clock, and timing writer.
- With a fresh snapshot, all 34 consumer files passed with 143 tests; summed
  time 165.1 s and wall time 83.6 s at concurrency 2. Every file logged only
  phase `snapshot`, which took 1.2 s to 2.4 s. With the snapshot absent, the
  same 34 files passed with the same 143 tests; summed time 1,917.0 s and wall
  time 962.5 s. Every file logged `compile:missing`. Per-file test, pass,
  fail, and skip counts were identical on both paths.
- During the first hours of this work, this VM ran about three times slower
  than later in the session: one consumer file took about 44 s instead of
  14 s, and the no-compile control file took 1.6 s instead of 0.4 s. Each
  before-and-after pair in this plan was measured back to back, under the
  same conditions.

Interim timings, each file run alone with `node --import tsx --test` on Node
22.14.0 with a fresh snapshot:

| File                                     | Before (this VM) | With snapshot |
| ---------------------------------------- | ---------------: | ------------: |
| `tests/design_screen_counts.test.ts`     |           43.1 s |         3.2 s |
| `tests/design_variants.test.ts`          |           43.7 s |         3.4 s |
| `tests/design_library_inventory.test.ts` |           45.2 s |         4.3 s |
| `tests/brand_logo.test.tsx`              |           43.8 s |         3.2 s |

## Milestone 4: Use the snapshot for the design library fixture — completed

Give the attribution fixture its before state from the snapshot in the default
mode. Keep the diff in `design_library_fixture.ts` to a few lines so the
attribution restructure in the other workspace merges without conflicts.

- [x] Add `tests/design_library_fixture_snapshot.test.ts`: copy the example
      with `copyExampleSources`, load the copied config, compile, and compare
      with `exampleCompilation()`. Require identical manifest, outputs,
      `deliveredStyleSources`, and `documentMarkdown`, and require that the
      config differs only in the ten root-dependent fields listed above.
- [x] Change `designLibraryFixture` to take `before` from
      `exampleCompilation()` when no mode is given. Keep compiling the copy when
      a mode is given, because `generatedOutput` changes the style inventory in
      `src/build/styles`. Keep every after-state `build()` as a real compile.
- [x] Run both attribution tests once and confirm that every assertion still
      passes. Record the before-state saving per fixture call.
- [x] Tell the attribution workspace that the fixture's default-mode before
      state now comes from the snapshot, so files split from those tests pay no
      compile for it. Sent as an information-only message to the
      "Attribution Test Consolidation" session of the "tests: attribution test
      consolidation" workspace, naming draft PR #138 and the changed lines.

Delivered notes:

- The equivalence test also requires each of the ten differing config fields
  to become equal once the copy root is replaced with the repository root.
  It passed in 50.8 s, of which 1.6 s loaded the snapshot.
- Both attribution tests passed on this VM with the snapshot:
  `tests/component_design_attribution.test.ts` with 10 tests in 318.9 s and
  `tests/design_library_attribution.test.ts` with 33 tests in 1,485.3 s.
  Each process loaded the before state once, in 2.5 s.
- Before-state saving per default-mode fixture call: the first call in a
  process now costs one snapshot load (2.5 s here) instead of one copy
  compile (about 49 s here and about 17 s in CI), and every later call in the
  same process costs nothing because the load is memoized. The five
  default-mode calls in the two files therefore save about 240 s here and
  about 80 s in CI. The committed-mode call keeps its compile.

## Milestone 5: Produce the snapshot during unit preparation — completed

Wire the producer into the unit suite and the developer test command.

- [x] Add failure-first tests: `tests/verification_prepared.test.ts` for the
      `unit` kind of `requirePrepared` and its message; update the exact
      `npm test` script assertion in `tests/verification_entrypoints.test.ts`;
      add the empty snapshot placeholder to the harness in
      `tests/verification_wrapper.test.ts`; update the unimock expectations in
      `xtask/src/_tests_/check_tests.rs` so the unit suite runs
      `npm run prepare:unit` and then `npm run test:prepared`.
- [x] Add the `prepare:unit` npm script and switch `test` to it. Leave
      `prepare:verification`, `test:browser`, and the package scripts alone.
- [x] Make both unit runners call `requirePrepared(repositoryRoot, "unit")`.
- [x] Change the unit suite in `xtask/src/check.rs` to prepare with
      `prepare:unit`; run `cargo fmt --all -- --check`, Clippy, and the xtask
      tests.
- [x] Smoke on Node 22.14.0: `npm test` from a clean `.context` produces the
      snapshot and every consumer logs phase `snapshot`; a second `npm test`
      skips the compile; an edit to an example source makes the next run
      rewrite the snapshot; `cargo xtask check --suite unit --shard 1/4`
      passes; one consumer file run by hand uses the fallback when the
      snapshot is stale and the snapshot when it is fresh.
  - [x] With the snapshot deleted, `npm test -- --shard 1/4` wrote it
        (`previous snapshot: missing`). All 9 consumers in that shard logged
        only phase `snapshot`. 1,139 of 1,141 tests passed; the two others
        are listed below.
  - [x] A second `npm run prepare:unit`, the preparation half of `npm test`,
        printed `is fresh; skipped the example compile`.
  - [x] After a one-line edit to `examples/basic/theme.ts`,
        `tests/design_screen_counts.test.ts` run by hand logged
        `compile:stale` (43.1 s) and passed; the next `npm run prepare:unit`
        rewrote the snapshot (`previous snapshot: stale`); the same file then
        logged `snapshot` and passed in 2.8 s. Reverting the edit repeated the
        rewrite, and the file passed again from the snapshot in 3.4 s.
  - [x] `cargo xtask check --suite unit --shard 1/4` passes. Locally, shard 1
        holds the two failures below, so CI's identical shard command is the
        confirmation: it passed in CI run 37457988316.
- [x] Remove the pending marks added by Milestone 1 and align every document
      with the delivered behavior.

Load-dependent local failures. While the VM ran slowly, these two tests
failed both on this branch and on a clean `origin/main` worktree (`f66c274`),
so they are not caused by this change. Both passed in the later full local
unit run and in CI:

- `tests/component_controls_watch.test.ts` exceeds its 25 s test timeout
  (28.7 s alone here; 17.4 s in CI run 37354719684).
- `tests/watched_child_startup.test.ts` waits only 1 s for the forked CLI
  child's first message, but the CLI takes about 1.5 s to start here.

Integration notes:

- `origin/main` gained `f66c274` (build warnings) during this work. The merge
  commit `982580b` has exactly two parents. Its only conflict was
  `README.md`, where both sides added a paragraph after the same line; the
  resolution keeps main's pull-request title paragraph and then this branch's
  unit snapshot paragraph. No other path needed a decision, and nothing on
  main was deleted.
- `f66c274` added the required `Compilation.diagnostics` field. The snapshot
  now stores it, decoding validates it with `normalizeBuildDiagnostics` and
  rejects records with other fields, `assertSameCompilation` compares it, and
  the protocol field table lists it. The real example compiles with zero
  diagnostics; the synthetic codec tests cover a non-empty list.

## Milestone 6: Measure, verify, commit, push, and review — completed

Collect the acceptance evidence on the branch before the merge.

- [x] Record a before-and-after table in this plan for
      `tests/design_screen_counts.test.ts`, `tests/design_variants.test.ts`,
      `tests/design_library_inventory.test.ts`, and
      `tests/brand_logo.test.tsx`, each run alone with
      `node --import tsx --test` on Node 22.14.0, with the baseline values from
      this plan.
- [x] Run the complete `npm run test:prepared` locally and compare the summed
      per-file time of the 34 files with the 510 s CI baseline.
- [x] Run the complete `cargo xtask check` on Node 22.14.0 or 24.19 or later,
      because the CLI refuses Node 24.14.x. Fix every failure.
- [x] Inspect the diff and deletions against `origin/main`; no test file may be
      removed.
- [x] After the checks pass, run `git add -A`, commit with a Conventional
      Commits message, and push the branch with every new script, declaration,
      helper, test, and document.
- [x] Confirm with a CI run on the branch: download the `verification-unit-*`
      artifacts, compare the summed per-file time and the slowest shard with
      run 37354719684, confirm the `fullFiles` count did not shrink, and record
      the result in this plan.
- [x] Only after the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against `origin/main`. Report numbered findings with severity, context,
      the impact of doing nothing, lettered options, and a recommendation. Do
      not change the implementation or fix findings automatically.

CI confirmation. Draft PR
[#138](https://github.com/mokly-ai/mokly/pull/138) ran
[CI run 37457988316](https://github.com/mokly-ai/mokly/actions/runs/37457988316)
for branch head `790421e`; its reports name the pull-request merge commit
`8f385ac` (Node 22.14.0). Every job passed, including `Required CI`. The unit reports compare with the baseline run as follows:

| Measure                                 |                Run 37354719684 |            Run 37457988316 |
| --------------------------------------- | -----------------------------: | -------------------------: |
| `fullFiles` (observed)                  |                            751 |                        768 |
| Tests                                   |                          4,214 |                      4,370 |
| Summed per-file unit time               |                        3,492 s |                    1,836 s |
| Summed per-file time of shards 1 to 4   | 1,201 s, 552 s, 492 s, 1,247 s | 617 s, 449 s, 433 s, 337 s |
| Test-process wall time of shards 1 to 4 |     691 s, 331 s, 290 s, 768 s | 398 s, 268 s, 259 s, 211 s |
| Unit job time of shards 1 to 4          |     789 s, 405 s, 356 s, 835 s | 450 s, 320 s, 317 s, 264 s |
| The 34 `designCatalogue` consumers      |  510 s (10.7 s to 25.0 s each) | 19 s (0.3 s to 1.7 s each) |
| `design_library_attribution.test.ts`    |                          615 s |                      319 s |
| `component_design_attribution.test.ts`  |                          192 s |                       69 s |
| New tests that compile the example      |                              — |          10.9 s and 10.0 s |

No baseline file is missing on the branch; the 17 extra files are the 11
that `f66c274` added and the 6 that this plan adds. The slowest unit job fell
from 835 s to 450 s. The attribution files fell by more than their saved
before-state compiles alone, because their neighbours on the same 2 vCPU
runner now compile far less; the other jobs and file counts also changed
with `f66c274`, so only the unit numbers above are attributed to this plan.

Final local timings, each file run alone with `node --import tsx --test` on
Node 22.14.0 on the final tree, with the VM idle. The "Compile" column moves
the snapshot aside, so the helper compiles the example as every file did
before this change; the plan baseline comes from the planning VM.

| File                                     | Plan baseline | Compile | Snapshot |
| ---------------------------------------- | ------------: | ------: | -------: |
| `tests/design_screen_counts.test.ts`     |        17.0 s |  14.4 s |    1.0 s |
| `tests/design_variants.test.ts`          |             — |  14.0 s |    1.1 s |
| `tests/design_library_inventory.test.ts` |             — |  14.9 s |    1.3 s |
| `tests/brand_logo.test.tsx`              |             — |  14.0 s |    1.1 s |
| `tests/derived_config.test.ts` (control) |         0.6 s |  0.42 s |   0.44 s |

The snapshot lookup took 0.5 s to 0.7 s per file.

Local `npm run test:prepared`, run by the complete `cargo xtask check` on
head `9d15e6d` with the strict runner: 768 files and 4,370 tests, all
passed; summed per-file time 1,884 s and test-process wall time 1,101 s.
The 34 consumer files summed 26.4 s (0.5 s to 2.6 s each), against 510 s for
the same files in the CI baseline and 19 s in CI on this branch. The two new
tests that compile took 14.3 s and 15.1 s. All 37 snapshot users logged phase
`snapshot`, and none fell back.

An earlier local run on head `790421e`, while the VM was slow and busy,
passed 4,369 of 4,370 tests; the 34 consumer files summed 52.8 s. Its one
failure, `tests/postcss_dependency_review.test.ts`, asserts that a
20,000-file collection takes less than 2,500 ms. It took 2,823.7 ms on the
loaded VM, 1,472.3 ms on the idle VM, and passed in CI and in the complete
gate.

Complete local gate. `cargo xtask check` passed on head `9d15e6d` on Node
22.14.0 in 57 minutes (exit 0): the repository suite, the package suite, the
unit suite (4,370 tests), the browser suite (844 tests), and the hydration
suite (263 tests) all passed with no skipped tests. An earlier local browser
run, while the VM was slow, timed out in the five-minute ordinary-preview
fixture setup; it passed here and in CI.

Review findings. The review used
[the implementation review prompt](../docs/implementation-review-prompt.md)
on head `9d15e6d` against `origin/main` `f66c274`, after the push. It made no
changes. The open findings, for the user to decide:

1. Medium: the codec copies `Compilation` fields by name, so a field that a
   later change adds to `Compilation` would be dropped from the snapshot
   without a failing test. Recommended: compare the field names in
   `assertSameCompilation`, and make `encodeCompilation` throw on an unknown
   field so `prepare:unit` fails closed.
2. Low: a snapshot that is invalid or stale falls back silently, so a codec
   disagreement or a key-input write during the gate could remove the saving
   without a failure. Recommended: decode before writing in the producer, and
   let the strict runner make the helper fail instead of compiling.
3. Low: `docs/protocol/ci-suite-evidence.md` and
   `docs/protocol/ci-verification.md` still say prepared output belongs to
   one suite invocation, but a fresh snapshot can outlive a run; three
   sentences also describe the snapshot loosely. Recommended: make the xtask
   unit suite always write a new snapshot, and correct the wording.

## Post-merge follow-up (non-blocking)

- Compare the first green `main` run after the merge with run 37354719684 and
  record the shard wall-clock times.
- If the attribution restructure splits its tests into many files, confirm
  that each new file reports phase `snapshot` for its before state.
- Consider whether browser fixtures that compile the unmodified example can use
  the same snapshot. They are outside this plan.

## Open Questions

1. Should the unit runners fail when the snapshot exists but is stale? This
   plan recommends no: the producer runs immediately before the runner, the
   helper falls back safely, and a strict check would need the runner to hash
   inputs in the wrapper harness. Per-file timings expose a silent fallback.
   Review finding 2 reopens this question: the strict runner could set an
   environment flag that makes the helper fail instead of compiling, which
   needs no input hashing in the runner.
2. Should the committed-mode fixture call also use the snapshot? This plan
   recommends no. Only one call uses that mode, and `generatedOutput` changes
   compile inputs, so the saving is one compile and the risk is a hidden
   divergence.
3. Should `tests/build.test.ts` keep its real compile of the example? This plan
   recommends yes, as the one unit test that proves the compile path on the
   real example.
