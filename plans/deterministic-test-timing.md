# Deterministic Test Timing

Status: Completed. [PR #152](https://github.com/mokly-ai/mokly/pull/152)
merged on 2026-10-06. On 2026-10-06 the user chose option C: convert every
wall-clock limit in the required suites and add a guard against new ones.
Review findings 1 to 5 under Milestone 7 move to
[Deterministic Test Timing Review Fixes](./deterministic-test-timing-review-fixes.md),
which owns them. Finding 6 needs no change: the squash title is within the
limit.

Replace the elapsed-time assertions in the unit, browser and hydration suites
with checks that do not depend on machine speed. Assert the scale contracts
that the protocol already states with operation counts, captured watch
targets, event order and fake clocks. Report durations as text only. Add an
ESLint guard so that new tests cannot measure elapsed time or use short
polling deadlines. The contract will live in
[CI Test Timing](../docs/protocol/ci-test-timing.md). Backend and test tooling
only; no mockup or UI work.

## Background

Before this change, `tests/postcss_dependency_review.test.ts:139` required
20,000 Tailwind-shaped PostCSS reports to collect in less than 2,500 ms.
Finding 13 in [the imported CSS review](https://github.com/mokly-ai/mokly/blob/f66c274/docs/reviews/imported-css-delivery.md)
measured the speed after its fix. The old limit left less than two times
headroom over that measurement. CI passed. Slower machines, such as a
Conductor sandbox, failed the test at random. They failed even when the test
ran alone.

The test now collects 500 and 2,000 reports. It checks fixed-root and sort
counts for equality. Counted totals can grow by at most 4.5 times. It also
checks the inventory size and reports duration as text only.

The test guards against repeated sorts and repeated root projection. A real
quadratic regression at the original size takes minutes. A limit near the
normal time adds failures without adding protection. Time is also a weak signal for
the root cache. When the cache is removed, the work stays linear and only
gets slower by a constant factor. An equal-count check on fixed roots catches
that change exactly.

The repository already rejects this pattern in words:
`docs/protocol/mokly-timings.md` says that CI correctness fixtures have no
machine-specific wall-clock assertion. Earlier reviews made the same point:
[Milestone 17 review](https://github.com/mokly-ai/mokly/blob/f66c274/docs/reviews/imported-css-delivery-milestone-17.md)
finding 12 recommends counting `realpath` calls instead of timing, and the
[Milestone 47 review](https://github.com/mokly-ai/mokly/blob/f66c274/docs/reviews/imported-css-delivery-milestone-47.md)
lists the readiness limits in `tests/watch_postcss_scale.test.ts` as fragile.
Parallel local verification (PR #136) adds load to local runs, which makes
these limits weaker still.

Open PRs touch nearby files. PR #136 changes
`src/build/styles/dependency_inventory.ts`, `src/config/paths.ts`,
`tests/verification_process.test.ts` and `docs/protocol/ci-suite-evidence.md`.
PRs #138 and #139 also change `docs/protocol/ci-suite-evidence.md`. The rule
therefore goes on a new protocol page, and edits to shared pages stay small.

Planning evidence: `.context/deterministic-test-timing/measurements.md`.

## Decisions

### The rule

- Required tests must not assert elapsed wall-clock time, as an upper bound
  or as a lower bound. Machine speed is not a product contract.
- Assert a scale contract with operation counts at two input sizes in a 1:4
  ratio. Work that the protocol says happens once per run must have the same
  count at both sizes. This includes fixed-root projection, sorts, glob
  compilation, index construction and working-directory resolution. Each
  counted total at the larger size must be at most 4.5 times the total at the
  smaller size. Linear work gives 4 times; quadratic work gives 16 times.
- Each count that an assertion uses must be greater than zero at the smaller
  size. A missed interception then fails the test instead of passing it.
- Assert a watch-target contract with the targets that the watcher factory
  receives.
- Assert a non-blocking contract with event order: the fast response settles
  while the slow job is still pending.
- Assert a timeout contract with a fake clock.
- These clock uses stay allowed: test `timeout` options, polling deadlines of
  10 seconds or more that wait for an expected state, and timestamps that are
  test data. They stop hung tests; they do not measure speed.
- Durations can appear in diagnostics and annotations as text from
  `tests/helpers/durations.ts`. A reported duration never fails a test.
- Millisecond thresholds belong only in opt-in benchmarks outside `tests/`,
  such as the `usableMs < 5000` check in `scripts/large/benchmark.mjs`.

### Replacements

The table records the original test locations and removed limits.
The replacement column defines the implemented deterministic checks.

| Original assertion                                        | Removed limit             | Replacement                                                                                                                       | Contract                                                                                     |
| --------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `tests/postcss_dependency_review.test.ts:93`              | 20,000 reports < 2,500 ms | 500 and 2,000 reports: equal fixed-root `realpath` counts, equal sort counts, totals at most 4.5 times                            | `mokly-imported-styles-postcss.md`: resolve fixed roots once, sort each candidate class once |
| `tests/imported_styles_low_dependencies.test.ts:39`       | 8,000 files < 1,500 ms    | 1,000 and 4,000 files: one `Minimatch` compilation per walk                                                                       | `mokly-imported-styles-postcss.md`: each reported glob is compiled once per report           |
| `tests/watch_postcss_scale.test.ts:51`                    | 3,000 lookups < 1,500 ms  | 750 and 3,000 sources: reads of `config.sourceFiles` elements during the lookup loop are at most one per source (one index build) | `mokly-watch.md`: build the required-file index once; callbacks consult it in constant time  |
| `tests/watch_postcss_scale.test.ts:87`                    | ready < 8,000 ms          | The factory receives the directory and no file inside it                                                                          | `mokly-watch.md`: watch targets omit files covered by a PostCSS directory-dependency root    |
| `tests/watch_postcss_scale.test.ts:144`                   | ready < 12,000 ms         | The same target check, plus the existing single-rebuild and single-watcher checks                                                 | `mokly-watch.md`, as above                                                                   |
| `tests/metafile_path_mapper.test.ts:26`                   | 10,000 edges < 400 ms     | 2,500 and 10,000 edges: each metafile input read at most once; one working-directory `realpath` at both sizes                     | `mokly-imported-styles.md`: working-directory and input-read rule                            |
| `tests/metafile_path_mapper.test.ts:60`                   | 3,000 inputs < 2,500 ms   | 750 and 3,000 inputs: one working-directory `realpath` at both sizes; at most one `realpath` per input                            | `mokly-imported-styles.md`, as above                                                         |
| `tests/css_module_selector_plugin_acceptance.test.ts:144` | matrix < 10,000 ms        | Remove the limit. Report the duration with the helper. Keep the 20-second test timeout                                            | No speed contract; the test checks correctness                                               |
| `tests/component_controls_watch.test.ts:74`               | Browse < 1,000 ms         | Browse answers with 200 while the `Hang` render is still pending                                                                  | `mokly-component-controls.md`: a synchronous render failure cannot hang Browse               |
| `tests/browser/frame_adapter_navigation.spec.ts:114`      | elapsed ≥ 4,900 ms        | `page.clock`: the request is pending at 4,999 ms and gives `timeout` at 5,000 ms                                                  | `mokly-frame-adapter.md`: requests time out after five seconds                               |

The original count was nine limits. Planning found the tenth, the lower bound
in the frame adapter spec. Planning also found five polling deadlines under
10 seconds that waited for an expected state, and two browser specs that built
duration text by hand:

- `tests/export_watch.test.ts:160` waited 2 seconds for a real watcher event.
- `tests/component_controls_watch.test.ts:92`,
  `tests/verification_process.test.ts:226`,
  `tests/watch_boundaries.test.ts:293` and
  `tests/watch_child_exit.test.ts:117` waited 5 seconds each.
- `tests/browser/css_module_selector_oracle.spec.ts:136` and
  `tests/browser/css_module_escape_fuzz.spec.ts:184` subtracted clock reads for
  their annotation text.

Those five polling deadlines now allow 15 seconds. Both browser specs use
the shared duration helper for annotation text.

### Helpers

- `tests/helpers/operation_counts.ts` counts the calls that one synchronous
  callback makes to `fs.statSync`, `fs.lstatSync`, `fs.existsSync`,
  `fs.readdirSync`, `fs.realpathSync`, `fs.realpathSync.native`,
  `path.relative`, `path.resolve` and `Array.prototype.sort`. It records
  totals and counts per first path argument. It keeps `realpathSync.native`
  attached to the wrapped `realpathSync`. It restores every original after a
  throw. It rejects a callback that returns a promise, because async work
  escapes the counting window. It also provides the two-size assertion from
  the rule.
- Every `src` module calls `fs` and `path` functions through the default
  import, so the wrappers see those calls. Only `constants` uses a named
  import. A future named import of a function would escape counting; the
  greater-than-zero rule exposes that case.
- `tests/helpers/durations.ts` is the only test module that subtracts clock
  reads. It returns the callback's result and gives the duration only as
  text, for `context.diagnostic` or a Playwright annotation.
- Count glob compilation with
  `context.mock.method(Minimatch.prototype, "make")`. `minimatch` 10 compiles
  each pattern in its constructor through `make`.
- Count element reads of `config.sourceFiles` and `metafile.inputs` with a
  test-owned `Proxy`.

### Guard

Add a `no-restricted-syntax` entry to `eslint.config.js` for every
JavaScript and TypeScript file under `tests/`, except
`tests/helpers/durations.ts`. It rejects two patterns, and its message names
`docs/protocol/ci-test-timing.md`:

- A subtraction whose left side is `performance.now()`, `Date.now()` or
  `process.hrtime.bigint()` and whose right side is not a number literal.
  `new Date(Date.now() - 10_000)` stays allowed as test data.
- `performance.now()` or `Date.now()` plus a number literal below 10,000.

Both selectors are prototyped against ESLint 10.7.0; the exact selector text
is in the planning evidence file. `tests/import_order.test.ts` shows how to
test a rule with `ESLint.lintText`.

### Out of scope

- Product behavior and speed do not change. Faster dependency
  classification is a follow-up.
- Opt-in benchmarks and fixture setup budgets in
  `tests/helpers/fixture_timing.ts` do not change. Test-runner timeouts follow
  the timing contract. Only the controls watch test's runner limit changes.
- Completed plans stay as historical records. Main removed `docs/reviews`
  in PR #147; links to its records are pinned to commit `f66c274`.

## Milestone 1: Define the timing contract — completed

Write the rule and the missing scale contract into the protocol before any
test changes.

Evidence: `.context/deterministic-test-timing/milestone-1.md`.

- [x] Fetch `origin/main`, record the source tip and the branch point, and
      audit main's additions so that the work preserves mainline features.
      Save the audit in the evidence file.
- [x] Add `docs/protocol/ci-test-timing.md` with the rule, the four evidence
      methods, the allowed clock uses, the duration helper, the benchmark
      boundary and the ESLint guard. Add a Delivery Status section that points
      at this plan until the guard lands. Do not name plan milestones, because
      `tests/protocol_doc_history.test.ts` rejects them.
- [x] Index the new page in `docs/protocol/README.md` beside CI suite
      evidence.
- [x] Add one link to the new page in the first paragraph of
      `docs/protocol/ci-suite-evidence.md`. Change no other line on that page.
- [x] In `docs/protocol/mokly-timings.md`, link the sentence about
      wall-clock assertions to the new page. Keep the opt-in benchmark's
      `usableMs < 5000` contract.
- [x] Add the guard to the ESLint description in
      `docs/protocol/ci-verification-repository.md`.
- [x] Add the metafile scale contract to `docs/protocol/mokly-imported-styles.md`:
      resolve esbuild's working directory once per metafile, and read each
      metafile input at most once per root traversal. `src/build/README.md`
      already states the first half.
- [x] Add one line under General in `AGENTS.md`: tests must not assert
      elapsed wall-clock time; link the new page.
- [x] Search `tests/` for other readers of the changed documents and run the
      matching tests.
- [x] Prepare the generated example catalogue required by the documentation
      link test.
- [x] Validate the changed Markdown with `npx prettier --check`. Run
      `tests/protocol_doc_sizes.test.ts`, `tests/protocol_split_links.test.ts`,
      `tests/protocol_structure.test.ts` and
      `tests/protocol_doc_history.test.ts`. Review the diff.

## Milestone 2: Shared evidence helpers — completed

Add the counting and duration helpers with their own tests. No existing test
changes in this milestone.

Evidence: `.context/deterministic-test-timing/milestone-2.md`.

- [x] Write failing tests for `tests/helpers/operation_counts.ts`. The helper
      counts each listed operation, records counts per first path argument,
      keeps `fs.realpathSync.native` callable and counted, restores every
      original after a throw, and rejects a callback that returns a promise.
- [x] Write failing tests for the two-size assertion. Equal once-only counts
      pass. A once-only count that grows fails. A total above 4.5 times fails.
      A zero count at the smaller size fails.
- [x] Split operation-count case data into a test helper so that the test
      file stays at or below 300 lines.
- [x] Implement `tests/helpers/operation_counts.ts` until those tests pass.
- [x] Re-check that each module on the counted paths still calls `fs` and
      `path` functions through the default import. Save the list of checked
      modules in the evidence file.
- [x] Write failing tests for `tests/helpers/durations.ts`. The helper returns
      the result of sync and async callbacks, reports the text once when the
      callback throws, and exposes no number. Then implement it.
- [x] Add a README link to the test timing contract and its shared helpers.
      Document the helper APIs, nested-use rejection, and thenable handling
      in the timing contract. Mark the shared helpers as implemented.
- [x] Run each new helper test file five times. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 3: PostCSS collection guards — completed

Convert the failing test and the directory-walk test to operation counts.

Evidence: `.context/deterministic-test-timing/milestone-3.md`.

- [x] Rewrite the 20,000-report test in
      `tests/postcss_dependency_review.test.ts` as described in Replacements.
      Keep the Tailwind report shape and the inventory-size assertion. Report
      the larger run's duration with the helper. Rename the test after the
      contract that it asserts.
- [x] Rewrite the 8,000-file walk test in
      `tests/imported_styles_low_dependencies.test.ts` as described in
      Replacements. Keep the match-count assertion.
- [x] Prove that each new assertion fails when its regression returns:
      give `dependencyOwnership` no cached roots, sort inside the report loop,
      and build a `Minimatch` for each file. Confirm that each change fails
      the matching test, then revert it. Save the results in the evidence
      file.
- [x] Run both files five times in a row and confirm that the counts are the
      same in each run.
- [x] Run `tests/*postcss*.test.ts` and `tests/imported_styles_*.test.ts`,
      then `npm run lint` and `npm run typecheck`.

## Milestone 4: Watch scale guards — completed

Convert the three limits in `tests/watch_postcss_scale.test.ts`.

Evidence: `.context/deterministic-test-timing/milestone-4.md`.

- [x] Resolve the read budget for the added-file classification scan before
      completing the indexed-lookup guard.
- [x] Convert the indexed-lookup test as described in Replacements.
- [x] Convert the real-watcher test. Wrap `ChokidarWatcherFactory` to capture
      the targets. Keep the readiness wait and the added-file event under the
      test timeout. Report readiness with the helper.
- [x] Convert the watched Serve test. Assert the target rule through the
      existing counting factory and report readiness with the helper.
- [x] Prove the guards: build the required-file index on every lookup, and
      add each source file as a watch target. Confirm that each change fails,
      then revert it. Save the results in the evidence file.
- [x] Split the file if it grows past 300 lines.
- [x] Run the file five times, then `tests/watch_*.test.ts`, `npm run lint`
      and `npm run typecheck`.

## Milestone 5: Remaining limits and short deadlines — completed

Convert the other five assertions, raise the short polling deadlines, and
move hand-built duration text to the helper.

Evidence: `.context/deterministic-test-timing/milestone-5.md`.

- [x] Convert both tests in `tests/metafile_path_mapper.test.ts` as described
      in Replacements.
- [x] Remove the limit in `tests/css_module_selector_plugin_acceptance.test.ts`
      and report its duration with the helper.
- [x] Replace the 1,000 ms check in `tests/component_controls_watch.test.ts`
      with the order check. The render worker stops the `Hang` job after ten
      seconds, so Browse must answer first.
- [x] Drive the five-second request timeout in
      `tests/browser/frame_adapter_navigation.spec.ts` with `page.clock`.
      Install the clock after the frame mounts and before the request starts.
      Assert that the request is pending at 4,999 ms, gives `timeout` at
      5,000 ms, and that the next request gives `disposed`. If `page.clock`
      cannot control the adapter's timer, stop. Then add a new milestone to
      decide on a timer seam.
- [x] Raise the five polling deadlines listed in Replacements to 15 seconds.
- [x] Raise the expected-state lock waits in `tests/generated_output_lock.test.ts`
      from `timeoutMs: 5_000` to 15 seconds at the acquisitions that must succeed
      (near lines 93, 124, and 161). Audit every other test-supplied timeout
      option under `tests/` for expected-state waits below 10 seconds.
- [x] Audit direct timer guards in `tests/imported_styles_supervision_watch.test.ts`
      (9 seconds for a watch event) and `tests/postcss_worker_failure.test.ts`
      (the 2-second `bounded` helper) for successful expected-state waits below
      10 seconds. Keep test-runner timeouts and timeout-outcome cases unchanged.
- [x] Audit successful-state timer guards in `tests/watch_child_exit.test.ts`
      (`exitsWithin` at 1,000 and 2,000 ms) and
      `tests/watch_config_shutdown.test.ts` (`completesWithin` at 1,000 ms).
      Keep test-runner timeouts unchanged.
- [x] Raise other expected-state limits found by the audit in HTTP helpers,
      preview requests, browser actions, process cleanup, and frame readiness.
      Keep the operation-count and duration helpers unchanged. Record each
      timeout decision and each runner-budget conflict in the evidence file.
- [x] Split changed preview-process and frame-lifecycle files that exceed
      300 lines. Preserve every test and update imports to the new owners.
- [x] Move the duration text in
      `tests/browser/css_module_selector_oracle.spec.ts` and
      `tests/browser/css_module_escape_fuzz.spec.ts` to the helper.
- [x] Prove the guards: create a mapper for each edge, remove the visited-set
      check in `orderedStyles`, make Browse wait for the active render job,
      and set the frame timeout to 4,000 ms and to 6,000 ms. Confirm that each
      change fails, then revert it. If a mutation is not practical, record why
      in the evidence file.
- [x] Run each changed Node test file five times and each changed browser spec
      three times. Then run `npm run lint` and `npm run typecheck`.
- [x] Define test-runner timeouts as whole-test hang guards with at least
      three times the typical duration. Allow inner expected-state waits to
      exceed the runner limit. Keep fixture setup budgets unchanged. Raise
      only `tests/component_controls_watch.test.ts` from 25 to 60 seconds.
      Keep the other runner limits unchanged.

## Milestone 6: Lint guard — completed

Add the ESLint guard after every test complies, so the gate stays green.

Evidence: `.context/deterministic-test-timing/milestone-6.md`.

- [x] Write a failing `tests/test_timing_lint.test.ts` with
      `ESLint.lintText`. It must flag elapsed subtraction from each clock in
      `tests/` and `tests/browser/` paths, including inside a `page.evaluate`
      callback, and literal deadlines below 10,000 ms. It must allow
      deadlines of 10,000 ms or more, deadline comparisons, timestamps such as
      `Date.now() - 10_000`, the duration helper's own path, and files under
      `src/` and `scripts/`.
- [x] Add the `no-restricted-syntax` entry to `eslint.config.js` as described
      in Guard.
- [x] Run `npm run lint` on the whole repository and confirm zero findings.
- [x] Smoke-test the message: add the banned pattern to a temporary test
      file, run `npx eslint` on it, save the message in the evidence file,
      and delete the temporary file.
- [x] Set the Delivery Status in `docs/protocol/ci-test-timing.md` to
      Implemented.
- [x] Update the planned guard wording in `docs/protocol/README.md` and
      `docs/protocol/ci-verification-repository.md` when the guard is active.
- [x] Run `tests/test_timing_lint.test.ts` five times. Run
      `tests/import_order.test.ts`, `tests/eslint_gitignore.test.ts`, and
      `npm run typecheck`. Check formatting for the changed files,
      `tests/protocol_*.test.ts`, and `tests/markdown_links.test.ts`.
- [x] Run the protocol and Markdown link tests after the documentation
      changes. Check file lengths and confirm that `src/` and `packages/`
      have no diff.

## Milestone 7: Deliver and review — completed

Integrate main, run the complete gate, and deliver the branch.

Evidence: `.context/deterministic-test-timing/milestone-7.md`.

- [x] Search the current docs and READMEs for the removed limits and renamed
      test titles, and update each match. Skip `docs/reviews` and completed
      plans.
- [x] Fetch `origin/main`. If it moved, merge it path by path with the
      Mainline Feature Preservation steps in `AGENTS.md`. Check the overlap
      with PR #136 first. Save the merge justifications in the evidence file
      and copy them into the PR description.
- [x] Run `cargo xtask check`.
- [x] Inspect the diff and the deletions against `origin/main` with
      `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. Record each
      approved removal in the commit body.
- [x] Run `git add -A`, commit the completed work using Conventional
      Commits, and push the branch.
- [x] After the push, use `docs/implementation-review-prompt.md` to review
      the complete local diff against `origin/main`. Report the findings
      without changing the implementation. The review at `f210d15` found six
      findings. All are tagged `Auto-fix: no` and await the user's decision.
      Report: `.context/deterministic-test-timing/review-1.md`.
  - 1 (Medium, test): `tests/browser/css_evidence_page.ts` waits 15 s inside a 15 s `toPass`, so a lost click is never retried. Recommended: a short per-attempt wait and a contract rule for retry loops.
  - 2 (Medium, test): Playwright's default 5 s assertion timeout still applies to browser waits. Recommended: `expect.timeout` of 15 s in `playwright.config.ts`, with a config test.
  - 3 (Medium, test): 15 counted polling loops and the `demand_safety` `DocumentService` timeout allow less than 10 s. Recommended: one shared `waitUntil` helper and a fake clock for `demand_safety`.
  - 4 (Medium, docs or spec): the once-per-metafile working-directory rule is false for symlinked roots and for a working directory equal to `repoRoot`. Recommended: fix the product and count both realpath functions.
  - 5 (Low, repository rule): the ESLint guard misses `packages/viewer/tests/` and member-expression clocks. Recommended: share the unit-suite root list and add the selectors.
  - 6 (Low, process): commit `b51280f` has a 51-character title. Recommended: keep it and squash-merge with a compliant PR title.

## Post-merge follow-up (non-blocking)

- Consider classifying sources through the required-file index.
  `classifyWatchPath` in `src/server/watch_events.ts` scans
  `config.sourceFiles` with `path.resolve` for every watch event. Each event
  costs one pass over the inventory.
- Consider faster dependency classification. About 60% of collection time is
  in `packageOwnedPath`, which makes about ten `path.relative` calls and three
  to five filesystem calls per file. Options: resolve each parent directory's
  real path once, use prefix checks for paths that are already normalized,
  and remove the second `statSync` in `collectPostcssDependencies`. Coordinate
  with the path-check changes in PR #136.
- Consider a Tailwind-shaped PostCSS scenario in `scripts/large`, so that
  large-input speed keeps a measured home outside the required suites.
