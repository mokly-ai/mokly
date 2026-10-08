# Shared Example Rebuild Removal

Status: Active. Planned on 2026-10-08 from the task "remove the shared
example rebuild from Playwright global setup". The plan implements the two
Milestone 27 TODOs of
[Generated Output Simplification](./generated-output-simplification.md)
that start with "Record a comparable full browser run" and "Remove only
shared rebuilt-cache preparation" (review finding 57 B). The task approves
the deletions listed under Inventory, item 1. The user approved Inventory
items 2 and 3 on 2026-10-08 when they asked to implement every milestone and
TODO. This approves deleting `tests/helpers/shared_example_test_source.ts`
and renaming `tests/shared_example_lifecycle.test.ts` to
`tests/owned_example_lifecycle.test.ts`.

## Status And Outcome

Before this change, every browser shard and the hydration job rebuilt the
example in a fixture copy before any test ran. CI run 37758736543 measured the
`browser-global` fixture per job: `npm ci` 5 to 6 s, build 10 to 12 s, 16 to 19 s
in total.
That is five jobs and about 87 s of compute per CI run, and the rebuild is
not the operation under test.

After this plan:

- Playwright global setup keeps only the worker-count check, Serve
  readiness, and the startup report. It builds no example, publishes no
  descriptor, and returns no teardown.
- `tests/browser/static_example.spec.ts` and
  `tests/browser/design_library_export.spec.ts` create their own repository
  with `createCommittedExampleBaseline` from `tests/helpers/example_baseline.ts`
  and use the normal Git-blob baseline selection. Every existing export,
  inspection, Markdown URL, and appearance assertion stays.
- `tests/browser/example_baseline_cold.spec.ts` stays the single real cold
  example-baseline rebuild. `tests/browser/preview_preparation.spec.ts` keeps
  its real cold `npm run preview:build`.
- The shared example, descriptor, and cache-copy helpers and their tests are
  deleted. Cancellation and failure coverage moves to
  `prepareIndependentExample`.
- The protocol docs and the README describe the implemented state.

Evidence lives under `.context/shared-example-rebuild-removal/`. The
before-and-after measurement record lives at
`.context/generated-output-simplification/shared-setup-removal.md`, as the
task requires, and Milestone 27 of the parent plan names that file.

## Contract Owners

- [CI fixture preparation and lifetime](../docs/protocol/ci-fixture-preparation.md)
  owns the export fixture baselines, the cold operations, timing, and cleanup.
- [CI verification](../docs/protocol/ci-verification.md) owns suite
  boundaries and Playwright global setup.
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md) owns fixture
  timing records, the setup budget, concurrency, and cleanup ownership.
- [CI test timing](../docs/protocol/ci-test-timing.md) forbids wall-clock
  assertions.
- [Developer test commands](../docs/protocol/developer-test-commands.md)
  owns the test and gate commands.
- [Baseline addressing](../docs/protocol/mokly-baseline-addressing.md)
  defines the Git-blob and rebuilt v9 readers.

## Scope

Changed: the two export specs, `tests/browser/setup.ts`, the helpers and
tests in the Inventory, three documents, the parent plan's Milestone 27, and
one annotation in `plans/meta-test-reduction.md`.

Unchanged: `tests/browser/example_baseline_cold.spec.ts`,
`tests/browser/preview_preparation.spec.ts`, `tests/example_baseline.test.ts`,
`tests/preview_fixture.test.ts`, `tests/helpers/fixture_timing.ts` including
`FULL_CATALOGUE_SETUP_TIMEOUT_MS = 600_000` and the `expectWarmBaseline`
option that the cold spec still uses, the `shared-export` profile and its name
in `tests/helpers/example_profiles.ts`, the `review.baselineBuild` recipe in
`examples/basic/mokly.config.ts`, `playwright.config.ts`, the workers,
retries, shards, and gate policy, and the strict runners.

Not added: a test that runs `npm ci` or a full build, a retry, a sleep, a
longer time limit, a wall-clock assertion, or an invented zero duration.

## Decisions

1. Fixture shape. Both export specs use a worker-scoped Playwright fixture
   built on `startOwnedPreviewFixture` and `previewFixtureContextRoot` from
   `tests/browser/preview_fixture_owner.ts`, as
   `tests/browser/ordinary_preview_fixture.ts` does. One new helper module,
   `tests/browser/committed_export_fixture.ts`, holds the shared code so each
   spec stays small. The owner root is a `mkdtemp` directory under the
   inherited verification resource root, or under `.context/` without one.
   The build step creates the committed baseline in the owner root, applies
   the optional source edit, and exports into `.context/site` inside it. The
   serve step uses `serveStaticFiles` and keeps the server handle so the
   static-example spec can still read `server.requests`. The fixture closes
   the server and removes the owner root on success, on failure, and when
   the worker is interrupted; the export runs in-process, so there is no
   child process to drain. The export receives
   `AbortSignal.timeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS)`, as the cold
   preview helper does, and the fixture timeout stays
   `FULL_CATALOGUE_SETUP_TIMEOUT_MS`.
2. Git-blob selection evidence. Before the export, each fixture calls
   `prepareReviewRepository(config, "HEAD", { builder })` with a typed
   `BaselineBuilder` whose `build` rejects immediately if requested. Assert
   `selection` is `"blobs"` and `reader` is a `CommittedBaselineReader`.
   Keep the loaded config and the existing profiles. The loader supplies a
   default recipe in `src/config/generated_output.ts`; the reviewer decided
   to use this guard on 2026-10-08 after the targeted run failed.
   This replaces `validateWarmExample` and
   `expectWarmBaseline: true` in the two specs. The design-library fixture
   runs this check after the baseline commit and before its source edit.
3. Timing records. Each fixture reports `baseline`, `export`, and `serve`
   phases with `timeFixturePhase` and `operationUnderTest: false`. The
   specs stop using `timeExportPreparation`, so no `install`, `build`, or
   `baseline` summary line is written for work that does not run. Global
   setup keeps the `browser-suite` `global-setup`, `serve-readiness`, and
   `startup` records. The `browser-global`, `template-teardown`,
   `template-validation`, `copy`, `cache-validation`, and `global-teardown`
   records disappear with the code that produced them.
4. Global setup ownership. Global setup creates no verification owner after
   this change, so it sets and restores no environment keys and returns no
   teardown. Owner cleanup stays where a fixture owns a resource:
   `createOwnedExample().close()` in the cold spec and the
   `startOwnedPreviewFixture` cleanup in the export fixtures. The strict
   runners keep draining their hierarchical ownership subtree.
5. Lifecycle coverage. `tests/shared_example_lifecycle.test.ts` becomes
   `tests/owned_example_lifecycle.test.ts`. Its three `prepareSharedExample`
   cases become `prepareIndependentExample(fixture, operationUnderTest, options)`
   cases with the same `createOwner` and `createSource` options and the same
   assertions. Remove shared, descriptor and "global setup" wording from
   their titles. The reviewer corrected the earlier narrow title instruction
   on 2026-10-08 and chose "stop independent preparation" for both the
   cancellation reason and its assertion pattern.
   Its two `createOwnedExample` cases and the 600-second ceiling
   case stay. This keeps the cancellation and failure coverage that the
   contract requires.
6. Measurement. Both full runs use `npm run test:browser`, the same
   `MOKLY_PLAYWRIGHT_WORKERS` value, the same warm `node_modules`, and the
   same test inventory. The record names Node, npm, Chrome, the CPU count,
   the worker count, and the cache state, and keeps every
   `[mokly:fixture-timing]` line and the suite wall time. It does not claim
   a controlled improvement when those inputs differ.
   The reviewer confirmed that the workspace HEAD cache was cold before the
   first run. They approved removing only
   `.mokly-cache/baselines/9d108fc4ca99a2b338c5af938cd2363f6c47919d`
   immediately before the after run, after confirming that no Serve or
   Playwright process runs. Keep `node_modules` and the npm cache warm.

## Inventory

Removed names, their files, and the live references found on 2026-10-08.

1. Approved by the task: `tests/helpers/shared_example.ts`,
   `tests/helpers/example_descriptor.ts`, `tests/shared_example.test.ts`,
   `tests/shared_example_failures.test.ts`, the unused parts of
   `tests/helpers/example_preparation.ts` (`EXAMPLE_CONFIG_PATH`; the
   exports that only `prepareIndependentExample` uses become module-private),
   and the unused `environment` option of `createOwnedExample` in
   `tests/helpers/owned_example.ts`.
2. Approved on 2026-10-08: delete `tests/helpers/shared_example_test_source.ts`.
   Only the two deleted test files import it.
3. Approved on 2026-10-08: rename `tests/shared_example_lifecycle.test.ts` to
   `tests/owned_example_lifecycle.test.ts` under Decision 5.
4. Live references to update in the same change: the README paragraph that
   starts "Browser global setup prepares one real example baseline"; the
   "Global setup currently prepares" paragraph in
   [CI verification](../docs/protocol/ci-verification.md); the Delivery
   Status of [CI fixture preparation](../docs/protocol/ci-fixture-preparation.md);
   and the unchecked review line in `plans/meta-test-reduction.md`
   Milestone 4 that names `tests/shared_example.test.ts`,
   `tests/helpers/shared_example.ts`, and `tests/helpers/owned_example.ts`.
   Annotate that line; do not change its words. The references in checked
   TODOs of `plans/baseline-relative-dependency-audit.md` and
   `plans/generated-output-simplification.md` are history.

## Milestone 1: Documentation

Align the three documents with the implemented state before the code
changes. Keep every protocol page at or under 250 lines.

- [x] Merge `origin/main` at `a90badb` as `9d108fc` under Mainline Feature
      Preservation. The reviewer completed the merge without conflicts and
      recorded the audit in
      `.context/shared-example-rebuild-removal/merge-main-audit.txt`.
- [x] In `docs/protocol/ci-fixture-preparation.md`, change the Delivery
      Status from approved target to implemented. Add one sentence to Export
      Fixture Baselines: each export fixture asserts that its baseline
      preparation selects committed Git blobs and that its config has no
      `review.baselineBuild` recipe. Name the `baseline`, `export`, and
      `serve` records under Timing And Cleanup.
- [x] In `docs/protocol/ci-verification.md`, replace the paragraph that
      starts "Global setup currently prepares one baseline and cache" with the
      implemented state: global setup keeps the worker-count check, Serve
      readiness and the startup report; export fixtures own committed-output
      repositories; the 600-second limit stays. The page is 234 lines; stay
      under 250.
- [x] In `README.md`, rewrite the paragraph that starts "Browser global setup
      prepares one real example baseline and cache" for the implemented state
      and keep its link to the fixture preparation contract.
- [x] Validate the changed Markdown with `npx prettier --check` on the
      changed files and `node --import tsx --test tests/markdown_links.test.ts`.

Evidence: `.context/shared-example-rebuild-removal/merge-main-audit.txt`, `.context/shared-example-rebuild-removal/milestone-1-markdown-links.log`, and `.context/shared-example-rebuild-removal/milestone-1-markdown-links-rerun.log`.

## Milestone 2: Measure before

Record the full browser suite and every fixture timing before any test code
changes. The run is evidence only.

- [x] Run `npm run test:browser 2>&1 | tee .context/shared-example-rebuild-removal/before-browser-run.log`
      with a fixed `MOKLY_PLAYWRIGHT_WORKERS` value and the wall time from
      `time`. Record the Node, npm, and Google Chrome versions, the `nproc`
      count, the worker count, and whether `node_modules` and the npm cache
      were warm.
- [x] Create `.context/generated-output-simplification/shared-setup-removal.md`
      with the conditions, the suite wall time, and every
      `[mokly:fixture-timing]` line grouped by fixture, with the
      `browser-suite` and `browser-global` phases first.
- [x] Tick the parent plan's Milestone 27 TODO that starts "Record a
      comparable full browser run" only when Milestone 3 completes, because
      that TODO also covers the fixture replacement.

Evidence: `.context/generated-output-simplification/shared-setup-removal.md`, `.context/shared-example-rebuild-removal/before-browser-run.log`, and `.context/shared-example-rebuild-removal/before-browser-conditions.json`.

## Milestone 3: Committed-output export fixtures

Replace `acquireSharedExample` in both export specs. After this milestone
global setup still builds the shared example, so the suite keeps working.

- [x] Correct Decision 2 under the reviewer's 2026-10-08 decision. Add a
      rejecting `BaselineBuilder` guard to the selection check. Remove the
      undefined-recipe assertion and keep the real loaded config. Change
      the Export Fixture Baselines protocol sentence to assert committed
      Git-blob selection and no requested baseline rebuild. Keep the checked
      Milestone 1 TODO unchanged.
- [x] Add `tests/browser/committed_export_fixture.ts` under Decision 1 with a
      function that takes a profile (`static-example` or `design-library`), a
      `mkdtemp` prefix, an optional source edit callback, and the shell path
      for `assertServedShellMarker`. It returns the owned fixture, the
      resolved config, the fixture commit from `git rev-parse HEAD`, and the
      static server handle. Keep the file under 300 lines.
- [x] Add the Git-blob selection check of Decision 2 to that helper, with
      `CommittedBaselineReader` from `dist/review/committed.js`.
- [x] Rewrite `tests/browser/static_example.spec.ts` on a worker-scoped
      fixture with profile `static-example`. Keep the three tests and every
      assertion: unchanged-HEAD `Unmodified` status and hidden diff toolbar at
      both viewports, the welcome frame heading, the screenshots, no failed
      responses, no `/mokly-viewer/events` request, the variant disclosure
      test, and the Markdown document URL forms with the dark appearance
      frame source.
- [x] Rewrite `tests/browser/design_library_export.spec.ts` on the same
      helper with profile `design-library`. Apply the `tag-chip.view.tsx`
      edit after the baseline commit and after the selection check. Keep
      both viewport tests and every assertion: disabled read-only props,
      the search value, the Tag picker variant and its revised chip, the
      changed and unchanged navigation rows, the Usage panel, and no failures.
- [x] Run `npm run test:browser -- tests/browser/static_example.spec.ts tests/browser/design_library_export.spec.ts`
      and require every test to pass. Save the output under
      `.context/shared-example-rebuild-removal/`.
- [x] Tick the parent plan's first Milestone 27 TODO.
- [x] Run the controlled missing-shell-marker smoke under `.context/`.
      Verify that the static server closes and the owner tree is removed.
- [x] Run `cargo xtask check --suite repository` before checkpoint 2 and
      fix every finding.

Evidence: `.context/shared-example-rebuild-removal/milestone-3-browser-rerun.log`, `.context/shared-example-rebuild-removal/milestone-3-marker-failure-smoke.log`, and `.context/shared-example-rebuild-removal/milestone-3-repository.log`.

## Milestone 4: Global setup and unused helpers

Remove the shared rebuilt-cache preparation and the code that only it used.
Both Playwright projects use the same global setup, so this covers the
hydration job.

- [x] In `tests/browser/setup.ts`, remove the `prepareSharedExample` call,
      the `SharedExample` state, the descriptor and owner environment keys
      with their save and restore, and the teardown. Keep the worker-count
      check, the `global-setup` and `serve-readiness` phases, and
      `reportBrowserStartup()`. Return no teardown function. Update the doc
      comment to describe Serve readiness.
- [x] Delete `tests/helpers/shared_example.ts`,
      `tests/helpers/example_descriptor.ts`, `tests/shared_example.test.ts`,
      `tests/shared_example_failures.test.ts`, and, with approval,
      `tests/helpers/shared_example_test_source.ts`.
- [x] Trim `tests/helpers/example_preparation.ts` to what
      `prepareIndependentExample`, `validateWarmExample`, and the cold spec
      need. Remove `EXAMPLE_CONFIG_PATH`. Keep `ExamplePreparationOptions`
      for the lifecycle tests. Remove the `environment` option from
      `createOwnedExample` in `tests/helpers/owned_example.ts`.
- [x] With approval, rename `tests/shared_example_lifecycle.test.ts` to
      `tests/owned_example_lifecycle.test.ts` and retarget its three shared
      preparation cases to `prepareIndependentExample` under Decision 5.
- [x] Search `docs/`, `plans/`, every `README.md`, `scripts/`, `xtask/`,
      `.github/`, `tests/`, and `src/` for every removed name and phase name.
      Classify each hit as live content or history and record it under
      `.context/`. Annotate the live `plans/meta-test-reduction.md` review
      line under Inventory item 4 without changing its words. Confirm no
      obsolete live reference remains.
- [x] Run the changed unit files with `npm test -- tests/owned_example_lifecycle.test.ts tests/example_baseline.test.ts tests/preview_fixture.test.ts tests/verification_process_owner.test.ts`
      and the browser set with `MOKLY_PLAYWRIGHT_WORKERS=1 npm run test:browser -- tests/browser/example_baseline_cold.spec.ts tests/browser/static_example.spec.ts tests/browser/design_library_export.spec.ts tests/browser/preview_preparation.spec.ts`.
      Confirm no `browser-global` or `global-teardown` timing record appears.
      Require a 100% pass rate.
- [x] Save every deleted test title and each old and new lifecycle title
      under `.context/shared-example-rebuild-removal/` for the PR description.
- [x] Run `cargo xtask check --suite repository` and fix every finding,
      including file length, lint, and unused-export findings.

Evidence: `.context/shared-example-rebuild-removal/milestone-4-unit.log`, `.context/shared-example-rebuild-removal/milestone-4-browser.log`, `.context/shared-example-rebuild-removal/milestone-4-removal-reference-audit.md`, `.context/shared-example-rebuild-removal/removed-and-renamed-test-titles.md`, and `.context/shared-example-rebuild-removal/milestone-4-repository.log`.

## Milestone 5: Measure after, gate, commit, push, and review

- [x] Apply the checkpoint 3 review corrections: remove stale shared and
      global-setup wording from the lifecycle case, correct the before-state
      tense and wrapping, and link the meta-test annotation to this plan.
      Keep every assertion and rerun the lifecycle file and Markdown links.
- [x] Run the same full browser suite as Milestone 2 with the same
      conditions into `after-browser-run.log`. Add the after numbers and the
      list of records that no longer appear to the measurement record. Report
      `global-setup`, `browser-global`, and suite wall time side by side.
- [x] Add one line under the parent plan's Milestone 27 that names
      `.context/generated-output-simplification/shared-setup-removal.md`, and
      tick the second Milestone 27 TODO. Change no other words in that plan.
- [x] Run the pre-commit mainline preservation audit from
      [`docs/dev/git.md`](../docs/dev/git.md).
      Save `git diff --name-status origin/main` and the deletion list under
      `.context/shared-example-rebuild-removal/preservation-audit.txt`.
- [x] Run one complete `cargo xtask check`. On a failure, fix it, rerun the
      narrowest command that covers it, then rerun the complete gate. Report
      an unrelated flaky test under the flaky-test rule in
      [`docs/dev/review.md`](../docs/dev/review.md) without fixing it here.
- [x] Draft the commit message and PR description under
      `.context/shared-example-rebuild-removal/` before checkpoint 4. Include
      the approved file removals and rename, test titles, plan edits and
      reviewer decisions. Follow the title limits and placeholder rule.
- [x] Run `git add -A`, commit with Conventional Commits, for example
      `test(browser): remove shared example rebuild`, list
      every deleted and renamed file in the commit body, and push. Open a PR
      against `main` that links this plan, the parent plan's Milestone 27,
      and the fixture preparation contract, and that lists the deleted and
      renamed files and the plan edits.
      Opened [PR #188](https://github.com/mokly-ai/mokly/pull/188) against `main`.
- [x] Repeat the mainline preservation audit after the authorized commit.
      Add the committed diff and deletion check to the same audit file.
- [ ] Review: after the push, use
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Report the
      findings. Apply the review-fix rule in
      [`docs/dev/review.md`](../docs/dev/review.md): fix the `Auto-fix: yes`
      findings, run the checks, commit, push, re-run the review once, and
      report the rest. Add each open finding as one line below.

Evidence: `.context/generated-output-simplification/shared-setup-removal.md`, `.context/shared-example-rebuild-removal/after-browser-run.log`, `.context/shared-example-rebuild-removal/preservation-audit.txt`, and `.context/shared-example-rebuild-removal/complete-check.log`.

## Post-merge follow-up (non-blocking)

- Compare the `browser-global` and `global-setup` evidence of the first
  merged CI run with run 37758736543, and add the CI numbers to the
  measurement record.
