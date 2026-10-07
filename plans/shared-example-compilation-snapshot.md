# Shared Example Compilation Snapshot

Status: Active. Milestones 1 to 8 are complete on draft PR
[#138](https://github.com/mokly-ai/mokly/pull/138); Milestone 9 adapts the
snapshot to main's generated output change. The plan closes when the PR
merges. Review findings 2 and 3 stay open for the user to decide; Milestone
7 lists them.

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

- [CI example compilation snapshot](../docs/protocol/ci-example-snapshot.md)
  owns the snapshot contract. Milestone 1 added it to `ci-suite-evidence.md`;
  it moved to its own page when main's #148 grew that page toward the
  250-line protocol limit.
- [CI verification](../docs/protocol/ci-verification.md) owns the unit gate's
  preparation sequence.
- [Local verification](../xtask/README.md) and the
  [developer section of the README](../README.md#develop-mokly) own the
  developer-facing commands.

## Rationale

In the green `main` CI run 37354719684, the 34 unit files that read
`designCatalogue` spent 510 s of the 3,492 s summed unit time, almost all of it
compiling the same example again; the two attribution tests spent another
807 s. Two properties make a shared snapshot safe, and tests now prove both:

- A compilation survives the round trip through JSON exactly.
- A compile of a copy made by `copyExampleSources` equals a compile of the
  checked-out example. Only ten root-dependent fields of the resolved config
  differ: `configPath`, `roots`, `mockupsDir`, `renderer`, `postcss`,
  `repoRoot`, `review`, `resolvedFiles`, `protectedFiles`, and `entryModules`.

Baseline measurements: `.context/shared-example-compilation-snapshot/baseline.md`.

## Where The Compiles Come From

| Helper or test                                                 | Consumers                                                                                  | What it compiles                                              | Plan                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------- |
| `tests/helpers/design_catalogue.ts`                            | 34 test files; also `design_stacks.ts`, `design_rows.ts`, `design_component_navigation.ts` | The example, once per test process                            | Load the snapshot; compile only as fallback           |
| `tests/helpers/design_library_fixture.ts`                      | Two attribution tests, six fixture calls                                                   | A copied example as the before state, then every edited state | Before state from the snapshot in the default mode    |
| `tests/helpers/example_baseline.ts`                            | `preview.test.ts`, `example_baseline.test.ts`, browser fixtures                            | Copies with changed config profiles and historical rebuilds   | Unchanged; the preparation is the behavior under test |
| `tests/helpers/move_catalogue.ts`                              | Seven move tests                                                                           | A small synthetic catalogue, not the example                  | Unchanged                                             |
| `tests/build.test.ts`                                          | One test                                                                                   | The example, once                                             | Unchanged; it is explicit compile coverage            |
| `tests/helpers/design_palette.ts`                              | Appearance tests                                                                           | Nothing; it reads `generated/design.css`                      | Unchanged                                             |
| `route_scoped_catalogue_real`, `server_route_scoped_bootstrap` | Two tests                                                                                  | Nothing; they read the generated manifest                     | Unchanged                                             |

The two native CI jobs run named test files directly. None of those files
imports `designCatalogue`, so they never need the snapshot.

## Design

### Snapshot file

The snapshot is one JSON file at `.context/verification/example-compilation.json`.
The directory is Git-ignored and already holds package artifacts. The file
holds `schemaVersion`, the freshness `key`, the build `diagnostics`, the
manifest, every output encoded with `transferGeneratedFile`,
`deliveredStyleSources`, and `documentMarkdown`.
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

A symbolic link hashes as its target text. The key reads files synchronously,
because thousands of small reads through the four-thread pool are several
times slower.

Generated HTML, the generated manifest, and `generated/mokly-generated/` are
ignored outputs, so they never enter the key. The key covers about 430 example
files and about 3,300 built files and costs well under a second.
Producer and consumers share one key function, so a mismatch can only mean
that an input changed after the snapshot was written.

### Producer

`node scripts/verification/example-snapshot.mjs` loads the example config,
compiles once with `compileCatalogue`, and writes the snapshot. When the
existing snapshot already carries the current key, it exits without compiling.
A new `prepare:unit` npm script runs `prepare:verification` and then this
producer. The xtask unit suite and `npm test` use `prepare:unit`. The package,
browser, and hydration suites keep `prepare:verification`, because they never
read the snapshot and the extra compile would only slow them down.

### Consumers and fallback

A new helper, `tests/helpers/example_compilation.ts`, exports
`exampleCompilation()`. It computes the key, reads the snapshot when the key
matches, and otherwise compiles with `loadConfig` and `compileCatalogue`. It
never writes the snapshot, so test processes never share mutable state. It
emits `[mokly:fixture-timing]` lines through the existing `timeFixturePhase`
helper with fixture `example-compilation`: phase `snapshot` measures the
lookup, and a fallback adds phase `compile:missing`, `compile:stale`, or
`compile:invalid`, so logs show which path ran and why. `designCatalogue`
becomes `exampleCompilation()`; its name and type do not change, so the 34
importers do not change.

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

Decisions:

- `decodeCompilation` requires the manifest object to serialize exactly to the
  compiled `mokly-manifest.json` output instead of re-running `parseManifest`,
  which costs seconds per test process. The compile runs `parseManifest`
  before it serializes that output.
- Decoding returns binary outputs as plain `Uint8Array` values, like a fresh
  compile, not as the `Buffer` values that `receiveGeneratedFile` returns.
- The key also hashes `tsconfig.json`, because esbuild reads it for every
  example module, and hashes a symbolic link as its target text.
- `readExampleSnapshot` moved to Milestone 3, because the
  unused-internal-export ratchet rejects a script export that no module
  imports.
- `tests/helpers/compilation_equality.ts` holds the shared equality
  assertion, and the real-example test has its own file, so the fast codec
  tests never wait for a compile.

Evidence: `.context/shared-example-compilation-snapshot/milestone-2.md`.

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

Decisions:

- The helper times each real phase with the unchanged `timeFixturePhase`
  helper, which now exports its `FixtureTimingOptions` type.
- `exampleCompilationLoader` memoizes one load per process; the loader tests
  inject the read, compile, clock, and timing writer.

Evidence: `.context/shared-example-compilation-snapshot/milestone-3.md`.

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

Decision: the equivalence test also requires each of the ten differing config
fields to become equal once the copy root is replaced with the repository root.

Evidence: `.context/shared-example-compilation-snapshot/milestone-4.md`.

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
- [x] Remove the pending marks added by Milestone 1 and align every document
      with the delivered behavior.

Decision: `f66c274` added the required `Compilation.diagnostics` field. The
snapshot stores it, decoding validates it with `normalizeBuildDiagnostics`,
and `assertSameCompilation` compares it.

Evidence: `.context/shared-example-compilation-snapshot/milestone-5.md`. Merge
justifications: `.context/shared-example-compilation-snapshot/merges.md` and
the PR #138 description.

## Milestone 6: Measure, verify, commit, push, and review — completed

Collect the acceptance evidence on the branch before the merge.

- [x] Record a before-and-after timing table for
      `tests/design_screen_counts.test.ts`, `tests/design_variants.test.ts`,
      `tests/design_library_inventory.test.ts`, and
      `tests/brand_logo.test.tsx`, each run alone with
      `node --import tsx --test` on Node 22.14.0, against the planning
      baseline.
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
      run 37354719684, confirm the `fullFiles` count did not shrink, and save
      the result with the Milestone 6 evidence.
- [x] Only after the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against `origin/main`. Report numbered findings with severity, context,
      the impact of doing nothing, lettered options, and a recommendation. Do
      not change the implementation or fix findings automatically.

Evidence: `.context/shared-example-compilation-snapshot/milestone-6.md` holds
the CI comparison with run 37354719684, the final local timings, and the
complete local gate result. Full review report:
`.context/shared-example-compilation-snapshot/review.md`.

Review summary. The post-push review used
[the implementation review prompt](../docs/implementation-review-prompt.md)
on head `9d15e6d` and reported three findings; Milestone 7 applies the
review-fix rule that main's #147 added.

## Milestone 7: Apply the review-fix rule — completed

Main's #147 replaced the rule that review findings wait for the user. Findings
that the reviewer tags `Auto-fix: yes` are fixed, the review runs once more on
the fix, and the other findings wait for the user.

- [x] Ask the reviewer to grade the findings under the new rule. Two wording
      errors split from finding 3 became findings 4 and 5, both
      `Auto-fix: yes`; findings 1, 2, and 3 are `Auto-fix: no`.
- [x] Fix finding 4: the README now says that `prepare:unit` skips the
      compile when the saved snapshot is still fresh.
- [x] Fix finding 5: the snapshot contract now states the exact first hashed
      line, `mokly-example-compilation-snapshot 1`.
- [x] Run `cargo xtask check`, commit with the fixed findings named in the
      message, and push.
- [x] Re-run [the implementation review prompt](../docs/implementation-review-prompt.md)
      once on the fix against `origin/main`. Fix new `Auto-fix: yes` findings
      once, then stop and report. The re-review confirmed findings 4 and 5
      and reported finding 6, `Auto-fix: yes`: the example README now says
      that `npm test` keeps a fresh snapshot. The fix round then stopped.
  - Finding 1 (Medium, test): the codec names `Compilation` fields by hand,
    so a new field can drop out of the snapshot while every test passes. The
    user chose option B; Milestone 8 fixes it.
  - Open finding 2 (Low, performance): a broken or stale snapshot falls back
    to a compile silently; recommended: decode before writing in the producer,
    and make the strict runner fail instead of compiling.
  - Open finding 3 (Low, docs or spec): two protocol sentences say prepared
    output belongs to one run, but a fresh snapshot can outlive a run;
    recommended: make the xtask unit suite always write a new snapshot, and
    correct the docs.

## Milestone 8: Fix review finding 1 with option B — completed

User decision: fix review finding 1 with option B. The test helper compares the
field sets of two compilations, and the snapshot encoder rejects a compilation
field that the snapshot format does not store, so `npm run prepare:unit` fails
instead of writing a snapshot that drops the field.

- [x] Update the snapshot contract in `docs/protocol/ci-example-snapshot.md`:
      encoding rejects a compilation field that the field table does not list.
- [x] Add failure-first tests in `tests/example_compilation_snapshot.test.ts`:
      the encoder rejects an unknown compilation field; the producer then
      fails and writes no snapshot; `assertSameCompilation` rejects two
      compilations whose field sets differ, in both directions.
- [x] Make `encodeCompilation` reject unknown compilation fields, compare the
      field sets in `tests/helpers/compilation_equality.ts`, and update the
      `.d.mts` declaration.
- [x] Run the snapshot, loader, round-trip, and fixture equivalence tests.
- [x] Run `cargo xtask check`, commit with finding 1 named in the message, and
      push.
- [x] Only after the push, review the change with
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against `origin/main`, then apply the review-fix rule: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest. The
      review of `c51b896` confirmed the finding 1 fix and reported no new
      findings, so no fix round followed.

Evidence: `.context/shared-example-compilation-snapshot/milestone-6.md`
(Milestone 8 section). Merge justifications:
`.context/shared-example-compilation-snapshot/merges.md` and the PR #138
description.

## Milestone 9: Adapt to main's generated output change — in progress

Main's #156 moved the generated example output to
`examples/basic/mokly-generated/`, moved the authored CSS out of
`examples/basic/generated/`, removed the design library fixture's committed
mode, moved to manifest v9, and made the example read
`examples/imported-assets/`. This milestone merges main and adapts the
snapshot so that the key and the test copy cover the same inputs.

- [x] Merge `origin/main` one commit at a time with the preservation checks,
      and record the justifications in the PR description.
- [x] Add `examples/imported-assets` to the shared source list, so the key and
      `copyExampleSources` cover the same inputs, and add a key test for an
      edited imported asset.
- [x] Take the fixture's before state from the snapshot for every call.
- [x] Update the tests for manifest v9, the new manifest path, the new example
      layout, and the new root-dependent config field `generatedDir`.
- [x] Update the snapshot contract for the new inputs, manifest v9, and the
      fixture, and keep `docs/protocol/README.md` at 250 lines.
- [x] Run `cargo xtask check`, commit, and push.
- [ ] Only after the push, review the change with
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      against `origin/main`, then apply the review-fix rule: fix the
      `Auto-fix: yes` findings, re-review once, and report the rest.

Evidence: `.context/shared-example-compilation-snapshot/merges.md` (merge 9)
and `.context/shared-example-compilation-snapshot/milestone-9.md`.

## Post-merge follow-up (non-blocking)

- Compare the first green `main` run after the merge with run 37354719684 and
  save the shard wall-clock times under
  `.context/shared-example-compilation-snapshot/`.
- If the attribution restructure splits its tests into many files, confirm
  that each new file reports phase `snapshot` for its before state.
- Consider whether browser fixtures that compile the unmodified example can use
  the same snapshot. They are outside this plan.

## Open Questions

1. Should the unit runners fail when the snapshot exists but is stale? This
   plan recommends no: the producer runs immediately before the runner, the
   helper falls back safely, and a strict check would need the runner to hash
   inputs in the wrapper harness. Per-file timings expose a silent fallback.
   Open review finding 2 reopens this question: the strict runner could set
   an environment flag that makes the helper fail instead of compiling, which
   needs no input hashing in the runner.
2. Should the committed-mode fixture call also use the snapshot? Resolved by
   main's #156: the committed mode no longer exists, so every fixture call now
   takes its before state from the snapshot.
3. Should `tests/build.test.ts` keep its real compile of the example? This plan
   recommends yes, as the one unit test that proves the compile path on the
   real example.
