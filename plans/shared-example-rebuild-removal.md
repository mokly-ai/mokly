# Shared Example Rebuild Removal

Status: Active. Planned on 2026-10-08 from the task "remove the shared
example rebuild from Playwright global setup". The plan implements the two
unticked Milestone 27 TODOs of
[Generated Output Simplification](./generated-output-simplification.md)
that start with "Record a comparable full browser run" and "Remove only
shared rebuilt-cache preparation" (review finding 57 B). The task approves
the deletions listed under Inventory, item 1. Inventory items 2 and 3 were
found during planning and need the user's approval before Milestone 4.

## Status And Outcome

Every browser shard and the hydration job rebuild the example in a fixture
copy before any test runs. CI run 37758736543 measured the `browser-global`
fixture per job: `npm ci` 5 to 6 s, build 10 to 12 s, 16 to 19 s in total.
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
  boundaries and the paragraph that still describes the shared setup.
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
option that the cold spec still uses, the `review.baselineBuild` recipe in
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
   `prepareReviewRepository(config, "HEAD")` and asserts `selection` is
   `"blobs"`, that `reader` is a `CommittedBaselineReader`, and that
   `config.review.baselineBuild` is undefined, because the committed-output
   profile strips the recipe. This replaces `validateWarmExample` and
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
   `tests/owned_example_lifecycle.test.ts`. Its two `prepareSharedExample`
   cases become `prepareIndependentExample` cases with the same `createOwner`
   and `createSource` options and the same assertions, minus the descriptor
   wording. Its three `createOwnedExample` cases and the 600-second ceiling
   case stay. This keeps the cancellation and failure coverage that the
   contract requires.
6. Measurement. Both full runs use `npm run test:browser`, the same
   `MOKLY_PLAYWRIGHT_WORKERS` value, the same warm `node_modules`, and the
   same test inventory. The record names Node, npm, Chrome, the CPU count,
   the worker count, and the cache state, and keeps every
   `[mokly:fixture-timing]` line and the suite wall time. It does not claim
   a controlled improvement when those inputs differ.

## Inventory

Removed names, their files, and the live references found on 2026-10-08.

1. Approved by the task: `tests/helpers/shared_example.ts`,
   `tests/helpers/example_descriptor.ts`, `tests/shared_example.test.ts`,
   `tests/shared_example_failures.test.ts`, the unused parts of
   `tests/helpers/example_preparation.ts` (`EXAMPLE_CONFIG_PATH`; the
   exports that only `prepareIndependentExample` uses become module-private),
   and the unused `environment` option of `createOwnedExample` in
   `tests/helpers/owned_example.ts`.
2. Needs approval: delete `tests/helpers/shared_example_test_source.ts`.
   Only the two deleted test files import it.
3. Needs approval: rename `tests/shared_example_lifecycle.test.ts` to
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

- [ ] In `docs/protocol/ci-fixture-preparation.md`, change the Delivery
      Status from approved target to implemented. Add one sentence to Export
      Fixture Baselines: each export fixture asserts that its baseline
      preparation selects committed Git blobs and that its config has no
      `review.baselineBuild` recipe. Name the `baseline`, `export`, and
      `serve` records under Timing And Cleanup.
- [ ] In `docs/protocol/ci-verification.md`, replace the paragraph that
      starts "Global setup currently prepares one baseline and cache" with the
      implemented state: global setup keeps only Serve readiness and the
      startup report; export fixtures own committed-output repositories; the
      600-second limit stays. The page is 229 lines; stay under 250.
- [ ] In `README.md`, rewrite the paragraph that starts "Browser global setup
      prepares one real example baseline and cache" for the implemented state
      and keep its link to the fixture preparation contract.
- [ ] Validate the changed Markdown with `npx prettier --check` on the
      changed files and `node --import tsx --test tests/markdown_links.test.ts`.

## Milestone 2: Measure before

Record the full browser suite and every fixture timing before any test code
changes. The run is evidence only.

- [ ] Run `npm run test:browser 2>&1 | tee .context/shared-example-rebuild-removal/before-browser-run.log`
      with a fixed `MOKLY_PLAYWRIGHT_WORKERS` value and the wall time from
      `time`. Record the Node, npm, and Google Chrome versions, the `nproc`
      count, the worker count, and whether `node_modules` and the npm cache
      were warm.
- [ ] Create `.context/generated-output-simplification/shared-setup-removal.md`
      with the conditions, the suite wall time, and every
      `[mokly:fixture-timing]` line grouped by fixture, with the
      `browser-suite` and `browser-global` phases first.
- [ ] Tick the parent plan's Milestone 27 TODO that starts "Record a
      comparable full browser run" only when Milestone 3 completes, because
      that TODO also covers the fixture replacement.

## Milestone 3: Committed-output export fixtures

Replace `acquireSharedExample` in both export specs. After this milestone
global setup still builds the shared example, so the suite keeps working.

- [ ] Add `tests/browser/committed_export_fixture.ts` under Decision 1 with a
      function that takes a profile (`static-example` or `design-library`), a
      `mkdtemp` prefix, an optional source edit callback, and the shell path
      for `assertServedShellMarker`. It returns the owned fixture, the
      resolved config, the fixture commit from `git rev-parse HEAD`, and the
      static server handle. Keep the file under 300 lines.
- [ ] Add the Git-blob selection check of Decision 2 to that helper, with
      `CommittedBaselineReader` from `dist/review/committed.js`.
- [ ] Rewrite `tests/browser/static_example.spec.ts` on a worker-scoped
      fixture with profile `static-example`. Keep the three tests and every
      assertion: unchanged-HEAD `Unmodified` status and hidden diff toolbar at
      both viewports, the welcome frame heading, the screenshots, no failed
      responses, no `/mokly-viewer/events` request, the variant disclosure
      test, and the Markdown document URL forms with the dark appearance
      frame source.
- [ ] Rewrite `tests/browser/design_library_export.spec.ts` on the same
      helper with profile `design-library`. Apply the `tag-chip.view.tsx`
      edit after the baseline commit and after the selection check. Keep
      both viewport tests and every assertion: disabled read-only props,
      the search value, the Tag picker variant and its revised chip, the
      changed and unchanged navigation rows, the Usage panel, and no failures.
- [ ] Run `npm run test:browser -- tests/browser/static_example.spec.ts tests/browser/design_library_export.spec.ts`
      and require every test to pass. Save the output under
      `.context/shared-example-rebuild-removal/`.
- [ ] Tick the parent plan's first Milestone 27 TODO.

## Milestone 4: Global setup and unused helpers

Remove the shared rebuilt-cache preparation and the code that only it used.
Both Playwright projects use the same global setup, so this covers the
hydration job.

- [ ] In `tests/browser/setup.ts`, remove the `prepareSharedExample` call,
      the `SharedExample` state, the descriptor and owner environment keys
      with their save and restore, and the teardown. Keep the worker-count
      check, the `global-setup` and `serve-readiness` phases, and
      `reportBrowserStartup()`. Return no teardown function.
- [ ] Delete `tests/helpers/shared_example.ts`,
      `tests/helpers/example_descriptor.ts`, `tests/shared_example.test.ts`,
      `tests/shared_example_failures.test.ts`, and, with approval,
      `tests/helpers/shared_example_test_source.ts`.
- [ ] Trim `tests/helpers/example_preparation.ts` to what
      `prepareIndependentExample`, `validateWarmExample`, and the cold spec
      need. Remove `EXAMPLE_CONFIG_PATH`. Keep `ExamplePreparationOptions`
      for the lifecycle tests. Remove the `environment` option from
      `createOwnedExample` in `tests/helpers/owned_example.ts`.
- [ ] With approval, rename `tests/shared_example_lifecycle.test.ts` to
      `tests/owned_example_lifecycle.test.ts` and retarget its two shared
      preparation cases to `prepareIndependentExample` under Decision 5.
- [ ] Search `docs/`, `plans/`, and every `README.md` for each removed name
      and phase name. Annotate the live `plans/meta-test-reduction.md` review
      line under Inventory item 4. Confirm no other live reference remains.
- [ ] Run the changed unit files with `npm test -- tests/owned_example_lifecycle.test.ts tests/example_baseline.test.ts tests/preview_fixture.test.ts tests/verification_process_owner.test.ts`
      and the cold spec with `npm run test:browser -- tests/browser/example_baseline_cold.spec.ts`.
      Require a 100% pass rate.
- [ ] Run `cargo xtask check --suite repository` and fix every finding,
      including file length, lint, and unused-export findings.

## Milestone 5: Measure after, gate, commit, push, and review

- [ ] Run the same full browser suite as Milestone 2 with the same
      conditions into `after-browser-run.log`. Add the after numbers and the
      list of records that no longer appear to the measurement record. Report
      `global-setup`, `browser-global`, and suite wall time side by side.
- [ ] Add one line under the parent plan's Milestone 27 that names
      `.context/generated-output-simplification/shared-setup-removal.md`, and
      tick the second Milestone 27 TODO. Change no other words in that plan.
- [ ] Run the mainline preservation audit from
      [`docs/dev/git.md`](../docs/dev/git.md) before and after the commit.
      Save `git diff --name-status origin/main` and the deletion list under
      `.context/shared-example-rebuild-removal/preservation-audit.txt`.
- [ ] Run one complete `cargo xtask check`. On a failure, fix it, rerun the
      narrowest command that covers it, then rerun the complete gate. Report
      an unrelated flaky test under the flaky-test rule in
      [`docs/dev/review.md`](../docs/dev/review.md) without fixing it here.
- [ ] Run `git add -A`, commit with Conventional Commits, for example
      `test(browser): drop shared example rebuild from global setup`, list
      every deleted and renamed file in the commit body, and push. Open a PR
      against `main` that links this plan, the parent plan's Milestone 27,
      and the fixture preparation contract, and that lists the deleted and
      renamed files and the plan edits.
- [ ] Review: after the push, use
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Report the
      findings. Apply the review-fix rule in
      [`docs/dev/review.md`](../docs/dev/review.md): fix the `Auto-fix: yes`
      findings, run the checks, commit, push, re-run the review once, and
      report the rest. Add each open finding as one line below.

## Post-merge follow-up (non-blocking)

- Compare the `browser-global` and `global-setup` evidence of the first
  merged CI run with run 37758736543, and add the CI numbers to the
  measurement record.
