# Deterministic Test Timing Review Fixes

Status: Active. [PR #174](https://github.com/mokly-ai/mokly/pull/174) is
open. On 2026-10-06 the user chose the
recommended option for findings 1 to 5 of the
[Deterministic Test Timing](./deterministic-test-timing.md) review. Finding 6
needs no change: the squash title of PR #152 is within the limit. Milestones 1
to 9 are complete. After the merge with main in Milestone 8, review finding 1
no longer applies. Milestone 9 fixed findings 2 to 4 with the options that the
user chose. The post-push review found no issues. Milestone 10 fixes items 4
and 5 of the outstanding review list with the options that the user chose on
2026-10-08.

Fix the five open findings from the PR #152 review. Keep browser retries
working, give Playwright assertions the contract's 10-second minimum, replace
hand-written polling loops with one shared helper, make metafile and
source-inventory root resolution match its contract, and extend the ESLint
guard to every test root. The contract stays in
[CI Test Timing](../docs/protocol/ci-test-timing.md). The root-resolution rule
is in [Imported Stylesheet Delivery](../docs/protocol/mokly-imported-styles.md).
This is test tooling plus one product fix in path mapping. There is no mockup
or UI work.

Review report: `.context/deterministic-test-timing/review-1.md`.
Planning evidence:
`.context/deterministic-test-timing-review-fixes/polling-inventory.md`.

## Decisions

### Finding 1: short attempts inside retry loops (option B)

- `openEvidence` in `tests/browser/css_evidence_page.ts` waits at most 1 s for
  the evidence panel in each `toPass` attempt. The `toPass` deadline stays
  15 s, so a lost click is retried.
- The contract allows a short per-attempt wait inside a retry loop, such as
  one attempt of `toPass`, when the loop's own deadline allows at least 10 s.
- This helper holds the only `toPass` in the test roots.

### Finding 2: Playwright assertion timeout (option A)

- `playwright.config.ts` sets `expect: { timeout: 15_000 }`. Web-first
  assertions and `expect.poll` then meet the 10-second minimum by default.
- `tests/verification_concurrency.test.ts` already imports the config. It
  asserts that the assertion timeout is at least 10,000 ms.
- Passing assertions do not get slower. No browser test catches a failed
  assertion, and every browser test timeout is at least 60 s.

### Finding 3: one shared polling helper (option B)

- Add `waitUntil(probe, options)` in `tests/helpers/wait_until.ts`. The probe
  can be sync or async. The helper resolves with the first probe result that
  is not `undefined`, `null` or `false`. It rethrows probe errors.
- Options: `timeoutMs` (default 15,000; a value below 10,000 rejects with
  `RangeError` before the first probe), `intervalMs` (default 10), and
  `message` for the timeout error. The message can be a string or a function.
  The helper calls the function once, only when the wait times out.
- The helper reads `Date.now()` and pauses with the global `setTimeout`
  wrapped in a promise. Its own tests can then use `t.mock.timers` and do
  not wait in real time.
- Replace every hand-written polling loop under the test roots that waits for
  an expected state. This includes counted loops (`N` pauses of `M` ms),
  clock-deadline loops, and the exported waits in `tests/helpers/server_http.ts`
  and `tests/helpers/watched_catalogue.ts`. Keep the exported signatures. Each
  new wait allows at least the larger of 15 s and its current allowance, and
  keeps its current poll interval.
- Keep a loop only when each attempt does more than check a state, for example
  when it retries an operation that has side effects. Record each kept loop
  and its reason in the milestone evidence.
- `tests/demand_safety.test.ts` drives the `DocumentService` job timer with
  `t.mock.timers`. It mocks only the `setTimeout` API, after runtime
  preparation. The hanging read is still pending at fake 999 ms and fails at
  fake 1,000 ms. The recovery read has no wall-clock limit.
- This plan adds no lint rule for counted loops. The review left that rule as
  a separate decision.

### Finding 4: fixed root resolution per metafile and per inventory (option C)

- `createMetafilePathMapper` resolves its working directory a fixed number
  of times per mapper. It maps every physical key to its logical path without
  resolving the root again, also when the working directory is a symlink.
- `normalizeSourceFiles` resolves `repoRoot` a fixed number of times per call.
  Its results do not change. Its handling of missing, escaping and dangling
  paths does not change.
- The operation-count helper gains a combined selection,
  `{ operation: "realpath", path }`. It adds the `fs.realpathSync` and
  `fs.realpathSync.native` calls for one path. Every working-directory and
  fixed-root once-only check uses it, including the PostCSS collection test.
- New tests cover a symlinked working directory and a working directory equal
  to `repoRoot`, which is the stylesheet bundle pass shape. They run at two
  sizes and check the logical outputs.
- If PostCSS dependency collection re-resolves a fixed root for each report
  under a symlinked repository root, fix it the same way, test first.

### Finding 5: lint guard roots and clock forms (option C)

- One module, `scripts/verification/test-roots.mjs`, lists the test roots
  (`tests` and `packages/viewer/tests`). `discoverUnitFiles` and
  `eslint.config.js` both read it, so a new root gets the guard automatically.
- Both rejected patterns also match a member-expression clock such as
  `window.performance.now()` or `globalThis.performance.now()`, and
  `new Date().getTime()` without constructor arguments. A parsed date such as
  `new Date(value).getTime()` stays allowed.
- The rule tests iterate the shared root list.

### Out of scope

- Product changes other than the root-resolution fix for finding 4.
- A lint rule that rejects counted polling loops. It awaits the user's
  decision.
- Finding 6.

## Milestone 1: Update the timing contract — completed

Write all five decisions into the protocol before any test or product change.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-1.md`.

- [x] Fetch `origin/main`, record the source tip and the branch point, and
      audit main's additions. Save the audit in the evidence file.
- [x] Update `docs/protocol/ci-test-timing.md` for all five decisions:
      per-attempt waits in retry loops, the Playwright assertion timeout,
      `waitUntil` as the way to poll for an expected state, the combined
      `realpath` selection and fixed root resolution, and the shared guard
      roots with the new clock forms. Add `packages/viewer/tests` to the
      scope. State in Delivery Status that these rules are planned in this
      plan. If the page passes 250 lines, move the helper sections to a
      continuation page and index it.
- [x] Correct the working-directory sentence in
      `docs/protocol/mokly-imported-styles.md` to match the finding 4
      decision.
- [x] Update the guard sentence in
      `docs/protocol/ci-verification-repository.md` to name the shared test
      roots.
- [x] Search protocol pages, guides, architecture pages and READMEs for stale
      assertion-timeout, polling, guard-scope and root-resolution statements.
      Correct each conflict. Keep the fixture-budget edit in
      `docs/protocol/ci-suite-evidence.md` small.
- [x] Validate the changed Markdown with `npx prettier --check`. Run the
      protocol tests and `tests/markdown_links.test.ts`. Review the diff.

## Milestone 2: Shared helpers — completed

Add the polling helper and the combined `realpath` selection with their own
tests. No existing call site changes.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-2.md`.

- [x] Check that Node mock timers drive the planned timer import. Use a
      mockable timer form if needed. Keep the decision and contract aligned.
- [x] Write failing tests for `waitUntil`: value results, boolean probes,
      async probes, probe errors, the timeout error and its message, the
      15,000 ms default, the 10,000 ms minimum, and the interval. Drive time
      with mock timers. No test waits in real time.
- [x] Implement `tests/helpers/wait_until.ts` until those tests pass.
- [x] Write failing tests for the combined `realpath` selection: equal sums
      pass, growth in either function fails, a zero sum at the smaller size
      fails, and the message names `realpath`, the path and both counts.
- [x] Implement the selection in `tests/helpers/operation_counts.ts`.
- [x] Add `tests/helpers/wait_until.ts` to the README testing paragraph.
- [x] Validate the changed Markdown with `npx prettier --check`. Run the
      protocol tests and `tests/markdown_links.test.ts`. Review the diff.
- [x] Run the helper tests five times. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 3: Fixed root resolution (finding 4) — completed

Fix the root resolution in path mapping and source inventory, test first.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-3.md`.

- [x] Write failing tests in `tests/metafile_path_mapper.test.ts` for a
      symlinked working directory (`orderedStyles` and `graphSourceFiles`)
      and for a working directory equal to `repoRoot`, at two sizes. Assert
      the logical outputs and constant combined `realpath` counts. Split the
      file if it passes 300 lines.
- [x] Fix `createMetafilePathMapper`, `normalizeSourceFiles`, and the helpers
      that they call in `src/config/file_locations.ts`, as decided. Keep the
      behavior of every other caller.
- [x] Use the combined `realpath` selection in every working-directory and
      fixed-root once-only check, including
      `tests/postcss_dependency_review.test.ts`.
- [x] Check PostCSS dependency collection with a symlinked repository root.
      If it resolves a fixed root for each report, add a failing test, then
      fix it.
- [x] Test cached ownership of physical PostCSS candidates at two sizes.
      Reuse the repository projection and prove the guard with a mutation.
- [x] Test PostCSS graph inputs under the public mockups root and its aliases
      at two sizes. Cache their location and ownership roots. Prove each guard.
- [x] Check locator results for missing, escaping and dangling paths, and for
      physical paths below symlinked roots. Keep lookup failures recoverable.
- [x] Prove each new guard. Restore the per-edge projection in the mapper and
      the per-input `repoRoot` resolution, and confirm that the matching test
      fails. Save the results in the evidence file.
- [x] Update the mapper doc comment and `src/build/README.md`. Use fixed-count
      wording for root resolutions instead of promising one resolution.
- [x] Run every test file that imports the changed modules, then
      `npm run lint` and `npm run typecheck`.
- [x] Run every symlink test once. Run the new tests five times. Check changed
      file sizes and format.

## Milestone 4: Polling waits (finding 3) — completed

Replace the hand-written polling loops with `waitUntil`, and drive the
`demand_safety` timeout with mock timers.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-4.md`.

- [x] Inventory every hand-written polling loop under the test roots, with
      its allowance, interval and expected state. Start from the planning
      inventory. It is a regex scan and misses some loops.
- [x] Include the loops missed by that scan in
      `tests/watched_child_startup.test.ts`,
      `tests/export_named_entries.test.ts`,
      `tests/preview_fixture_cleanup.test.ts`,
      `tests/helpers/blocking_git.ts`, `tests/helpers/watched_events.ts`
      and `tests/browser/historical_selection_history_fixture.ts`.
- [x] Replace each loop with `waitUntil` as decided. Record each kept loop and
      its reason in the evidence file.
- [x] Update the preview fixture tests to use mock timers instead of an
      injected pause. Test the exported HTTP wait's allowance and probe errors.
      Keep the watched catalogue's timeout diagnostics under mock timers.
- [x] Replace browser-page state waits with Playwright waits. Record the
      browser-only viewer harness wait in the evidence file.
- [x] Resolve the scope of the unused animation-frame state wait in
      `packages/viewer/tests/frame_registry_harness.tsx`. Keep it unchanged.
      `mountedRegistrySessions` has no callers and runs inside the browser
      page, where it cannot import `waitUntil`. Deleting code on `origin/main`
      needs the user's approval. The empty diff rule covers product code;
      files under `packages/viewer/tests/` are test code.
- [x] Add and test the explicit message function API for `waitUntil`. Update
      its JSDoc and helper protocol. Replace all eight message getters with
      functions that read the current state.
- [x] Document page-state polling with Playwright and its 10-second minimum.
- [x] Run the review-request checks: `wait_until` five times, each changed
      message-function caller once, the protocol and Markdown link tests,
      lint, type checks, format, file sizes and the product diff check.
- [x] Drive the `demand_safety` job timer with `t.mock.timers` as decided.
      Prove the guard: change the timeout that the test passes and confirm
      that the test fails.
- [x] Run the affected hydration specs with the hydration project. The
      Chromium project excludes their filenames.
- [x] Run each changed Node test file three times and the specs of each
      changed browser fixture once. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 5: Browser assertion timeouts (findings 1 and 2) — completed

Raise the Playwright assertion timeout and restore the evidence retry.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-5.md`.

- [x] Add a failing assertion to `tests/verification_concurrency.test.ts`,
      then set `expect: { timeout: 15_000 }` in `playwright.config.ts`.
- [x] Set the per-attempt panel wait in `openEvidence` to 1 s. Keep
      `toPass({ timeout: 15_000 })`.
- [x] Confirm that no other retry loop has an inner wait as long as its
      deadline, and that no browser test catches a failed assertion.
- [x] Run `npm run prepare:verification` once before the browser checks.
- [x] Prove the retry with a temporary change that swallows the first Details
      click. The evidence spec must still pass. Confirm that the same spec
      fails with a 15 s per-attempt wait. Revert both temporary changes.
- [x] Run `css_evidence.spec.ts`, `css_screen_evidence.spec.ts`,
      `shared_impact_details.spec.ts` and
      `tests/verification_concurrency.test.ts`. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 6: Lint guard roots and clock forms (finding 5) — completed

Read the guard roots from the shared list and reject the missed clock forms.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-6.md`.

- [x] Write failing rule tests in `tests/test_timing_lint.test.ts` for each
      root in the shared list, the member-expression clocks, and
      `new Date().getTime()`, plus the allowed `new Date(value).getTime()`.
      Split the file if it passes 300 lines.
- [x] Add `scripts/verification/test-roots.mjs` and its declaration file. Use
      the list in `discoverUnitFiles` and `eslint.config.js`.
- [x] Extend both selectors as decided.
- [x] Run `npm run lint` on the whole repository and fix any new finding.
      Smoke-test the message on a temporary file in `packages/viewer/tests/`.
- [x] Set the Delivery Status in `docs/protocol/ci-test-timing.md` to
      Implemented.
- [x] Confirm that the timing contract,
      `docs/protocol/ci-verification-repository.md` and `README.md` describe
      the final guard.
- [x] Run the repository ratchets. Check the shared module's script
      declaration and the changed file sizes.
- [x] Run the rule tests five times, `tests/import_order.test.ts`,
      `tests/eslint_gitignore.test.ts`, every `tests/verification_*.test.ts`
      file, the protocol tests, `tests/markdown_links.test.ts`, `npm run lint`
      and `npm run typecheck`.

## Milestone 7: Deliver and review — completed

Integrate main, run the complete gate, and deliver the branch.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-7.md`.

- [x] Search the current docs and READMEs for statements that these changes
      make stale, and update them.
- [x] Fetch `origin/main`. If it moved, merge it with the Mainline Feature
      Preservation steps in `AGENTS.md`. Save the merge justifications in the
      evidence file for the PR description.
- [x] Run `cargo xtask check`.
- [x] Inspect the diff and the deletions against `origin/main`. Record each
      approved removal in the commit body.
- [x] Run `git add -A`, commit the completed work using Conventional
      Commits, and push the branch.
- [x] After the push, use `docs/implementation-review-prompt.md` to review
      the complete local diff against `origin/main` and report the findings.
      Then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
      The review at `9f101e1` found three findings. None is tagged
      `Auto-fix: yes`, so no fix round ran. Report:
      `.context/deterministic-test-timing-review-fixes/review-1.md`.
  - 1 (Medium, docs or spec): PostCSS collection still projects each `config.roots[].dir` once per candidate under `mockupsDir`. Recommended: cache configured root projections per collection, and build the fixed-root test list from the config.
  - 2 (Low, test): `tests/browser/same_origin_reconnect.spec.ts` polls page state with an in-page `setInterval` loop. Recommended: wait with `page.waitForFunction` and a 15 s allowance.
  - 3 (Low, docs or spec): the lint guard misses `<object>.Date.now()` and `new <object>.Date().getTime()`. Recommended: extend the selectors, with rule tests.

## Milestone 8: Integrate main at acac1c7 — completed

Merge main after PR #156 removed whole-tree ownership. Keep the timing
contract true for the tests that main added. Re-assess the open review
findings against the merged tree.

Evidence: `.context/deterministic-test-timing-review-fixes/merge-7d3b232.md`.

- [x] Fetch `origin/main` and audit its additions from source tip `e0c6df4`
      (branch point `dc56e3d`).
- [x] Merge main at `7d3b232` path by path, and record each conflict decision
      in the evidence file. Keep main's deletion of `src/build/ownership.ts`.
- [x] Convert the four polling waits that PR #156 added to `waitUntil`, in
      `tests/build_watch.test.ts`, `tests/catalogue_history_conflicts.test.ts`,
      `tests/serve_snapshot.test.ts` and `tests/shared_example_lifecycle.test.ts`.
- [x] Keep `docs/protocol/README.md` within its 250-line limit.
- [x] Merge main again at `acac1c7` (PR #168), which landed during the gate.
- [x] Run `cargo xtask check --suite repository`, then the complete gate, with
      the CI toolchain (Rust 1.95.0) and the local executor.
- [x] Commit and push the branch.
- [x] After the push, re-assess the open review findings against the merged
      tree, using the finding format in `docs/implementation-review-prompt.md`.
      Report:
      `.context/deterministic-test-timing-review-fixes/review-1-reassessment.md`.
  - Finding 1 no longer applies: PR #156 removed the `isOwned` call chain, and every fixed root now resolves a constant number of times.
  - Findings 2 and 3 still apply. Finding 3 also covers `performance.timeOrigin + performance.now() - started`, which main's `tests/helpers/browser_timing.ts` uses for fixture timing.
  - 4 (Low, test): `tests/server_fixture.ts` is an unused copy of `tests/helpers/server_http.ts` from PR #156. It keeps a 12 s deadline loop and a 2 s request timeout. Recommended: delete it.

## Milestone 9: Fix review findings 2 to 4 — completed

On 2026-10-07 the user chose option A for finding 2, option B for finding 3
and option A for finding 4. Option A for finding 4 approves the deletion of
`tests/server_fixture.ts` from `origin/main`.

- Finding 2: wait for the replaced document in
  `tests/browser/same_origin_reconnect.spec.ts` with `page.waitForFunction`
  and a 15 s allowance, outside `page.evaluate`.
- Finding 3: the guard also rejects `<object>.Date.now()`,
  `new <object>.Date().getTime()` and a clock call that is a direct operand
  of a `+` expression on the left of a subtraction, such as
  `performance.timeOrigin + performance.now() - started`. The guard exempts
  the fixture-timing helper `tests/helpers/browser_timing.ts` as well as
  `tests/helpers/durations.ts`.
- Finding 4: delete the unused `tests/server_fixture.ts`.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-9.md`.

- [x] Update the ESLint Guard section of `docs/protocol/ci-test-timing.md`,
      the duration-helper text in `docs/protocol/ci-test-timing-helpers.md`,
      `docs/protocol/ci-verification-repository.md` and `README.md` for the
      finding 3 forms and exemption.
- [x] Replace the in-page `setInterval` wait in
      `tests/browser/same_origin_reconnect.spec.ts` (finding 2). Run the spec
      three times.
- [x] Add the finding 3 forms and the exemption to
      `tests/test_timing_lint.test.ts` and watch the new cases fail. Then
      extend the selectors and the exemption in `eslint.config.js`.
- [x] Delete `tests/server_fixture.ts` (finding 4). Search `docs/`, `plans/`
      and every `README.md` for its name.
- [x] Merge the latest `origin/main` with the Mainline Feature Preservation
      steps in `AGENTS.md`.
- [x] Run `cargo xtask check --suite repository`, then the complete gate, with
      the CI toolchain (Rust 1.95.0) and the local executor.
- [x] Commit and push the branch, and open the pull request.
- [x] After the push, use `docs/implementation-review-prompt.md` to review
      the complete local diff against `origin/main` and report the findings.
      Then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 2 (`.context/deterministic-test-timing-review-fixes/review-2.md`):
    no findings, so there is no fix round.

## Milestone 10: Fix outstanding review items 4 and 5

On 2026-10-08 the user chose option B for item 4 and option B for item 5 of
the outstanding review list. Review 2 recorded both as residual risks, not as
findings.

- Item 4: a test's child process writes its process ID with `writeFileSync`.
  That call creates the file before it writes the number, so a read in between
  returns an empty string, and `Number("")` is 0. Add `readPidFile` in
  `tests/helpers/pid_file.ts` and use it in every process-ID poll. It returns
  `undefined` for a missing or blank file and the ID for a positive whole
  number. It rejects for any other content.
- Item 5: the latest-wins test in `tests/browser/browse.spec.ts` waits a fixed
  900 ms to show that a late response did not replace the page. Hold the first
  view's request until the second view renders, then release it. Wait until
  the request settles, let rendering updates pass with `passRenderingUpdates`,
  and then check the page. This also replaces the fixed 700 ms hold. The fixed
  waits in `tests/build_watch.test.ts` stay, because the watcher has no idle
  signal.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-10.md`.

- [x] Add the process-ID file rule to the Polling section of
      `docs/protocol/ci-test-timing.md`, the `readPidFile` contract to
      `docs/protocol/ci-test-timing-helpers.md`, and a pointer to `README.md`.
- [x] Add `tests/pid_file.test.ts` and watch it fail. Then add `readPidFile` in
      `tests/helpers/pid_file.ts`.
- [x] Use `readPidFile` in every process-ID poll:
      `tests/baseline_integration.test.ts`,
      `tests/baseline_process_tree.test.ts`, `tests/derived_serve.test.ts`,
      `tests/preview_fixture_cleanup.test.ts`,
      `tests/shared_example_lifecycle.test.ts` and
      `tests/verification_process.test.ts`. Keep every assertion, interval and
      message. Run the changed files.
- [x] Replace the fixed waits in the latest-wins test of
      `tests/browser/browse.spec.ts` (item 5). Run the spec three times.
- [x] Run `cargo xtask check --suite repository`, then the complete gate with
      the local executor.
- [ ] Commit and push the branch.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review
      the complete local diff against `origin/main` and report the findings.
      Then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.

## Post-merge follow-up (non-blocking)

- Decide whether a lint rule should reject counted polling loops under the
  test roots.
- Decide whether to delete the unused `mountedRegistrySessions` helper in
  `packages/viewer/tests/frame_registry_harness.tsx`.
- Decide whether the timing guard should also match the clock forms that
  review 2 found unmatched: a named `hrtime` import, optional calls, type
  casts, computed calls, a clock deeper in a sum and a literal-first deadline.
  Also decide whether it should allow a fake clock's `clock.Date.now()`.
