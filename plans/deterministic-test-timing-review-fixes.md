# Deterministic Test Timing Review Fixes

Status: Active. No PR is open yet. On 2026-10-06 the user chose the
recommended option for findings 1 to 5 of the
[Deterministic Test Timing](./deterministic-test-timing.md) review. Finding 6
needs no change: the squash title of PR #152 is within the limit.

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
- Options: `timeoutMs` (default 15,000; a value below 10,000 throws),
  `intervalMs` (default 10), and `message` for the timeout error.
- The helper reads `Date.now()` and pauses with `setTimeout` from
  `node:timers/promises`. Its own tests can then use `t.mock.timers` and do
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

## Milestone 2: Shared helpers

Add the polling helper and the combined `realpath` selection with their own
tests. No existing call site changes.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-2.md`.

- [ ] Write failing tests for `waitUntil`: value results, boolean probes,
      async probes, probe errors, the timeout error and its message, the
      15,000 ms default, the 10,000 ms minimum, and the interval. Drive time
      with mock timers. No test waits in real time.
- [ ] Implement `tests/helpers/wait_until.ts` until those tests pass.
- [ ] Write failing tests for the combined `realpath` selection: equal sums
      pass, growth in either function fails, a zero sum at the smaller size
      fails, and the message names `realpath`, the path and both counts.
- [ ] Implement the selection in `tests/helpers/operation_counts.ts`.
- [ ] Run the helper tests five times. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 3: Fixed root resolution (finding 4)

Fix the root resolution in path mapping and source inventory, test first.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-3.md`.

- [ ] Write failing tests in `tests/metafile_path_mapper.test.ts` for a
      symlinked working directory (`orderedStyles` and `graphSourceFiles`)
      and for a working directory equal to `repoRoot`, at two sizes. Assert
      the logical outputs and constant combined `realpath` counts. Split the
      file if it passes 300 lines.
- [ ] Fix `createMetafilePathMapper`, `normalizeSourceFiles`, and the helpers
      that they call in `src/config/file_locations.ts`, as decided. Keep the
      behavior of every other caller.
- [ ] Use the combined `realpath` selection in every working-directory and
      fixed-root once-only check, including
      `tests/postcss_dependency_review.test.ts`.
- [ ] Check PostCSS dependency collection with a symlinked repository root.
      If it resolves a fixed root for each report, add a failing test, then
      fix it.
- [ ] Prove each new guard. Restore the per-edge projection in the mapper and
      the per-input `repoRoot` resolution, and confirm that the matching test
      fails. Save the results in the evidence file.
- [ ] Update the mapper doc comment and `src/build/README.md`. Use fixed-count
      wording for root resolutions instead of promising one resolution.
- [ ] Run every test file that imports the changed modules, then
      `npm run lint` and `npm run typecheck`.

## Milestone 4: Polling waits (finding 3)

Replace the hand-written polling loops with `waitUntil`, and drive the
`demand_safety` timeout with mock timers.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-4.md`.

- [ ] Inventory every hand-written polling loop under the test roots, with
      its allowance, interval and expected state. Start from the planning
      inventory. It is a regex scan and misses some loops.
- [ ] Include the loops missed by that scan in
      `tests/watched_child_startup.test.ts`,
      `tests/export_named_entries.test.ts`,
      `tests/preview_fixture_cleanup.test.ts`,
      `tests/helpers/blocking_git.ts`, `tests/helpers/watched_events.ts`
      and `tests/browser/historical_selection_history_fixture.ts`.
- [ ] Replace each loop with `waitUntil` as decided. Record each kept loop and
      its reason in the evidence file.
- [ ] Drive the `demand_safety` job timer with `t.mock.timers` as decided.
      Prove the guard: change the timeout that the test passes and confirm
      that the test fails.
- [ ] Run each changed Node test file three times and the specs of each
      changed browser fixture once. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 5: Browser assertion timeouts (findings 1 and 2)

Raise the Playwright assertion timeout and restore the evidence retry.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-5.md`.

- [ ] Add a failing assertion to `tests/verification_concurrency.test.ts`,
      then set `expect: { timeout: 15_000 }` in `playwright.config.ts`.
- [ ] Set the per-attempt panel wait in `openEvidence` to 1 s. Keep
      `toPass({ timeout: 15_000 })`.
- [ ] Confirm that no other retry loop has an inner wait as long as its
      deadline, and that no browser test catches a failed assertion.
- [ ] Prove the retry with a temporary change that swallows the first Details
      click. The evidence specs must still pass. Revert the change.
- [ ] Run `css_evidence.spec.ts`, `css_screen_evidence.spec.ts`,
      `shared_impact_details.spec.ts` and
      `tests/verification_concurrency.test.ts`. Run `npm run lint` and
      `npm run typecheck`.

## Milestone 6: Lint guard roots and clock forms (finding 5)

Read the guard roots from the shared list and reject the missed clock forms.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-6.md`.

- [ ] Write failing rule tests in `tests/test_timing_lint.test.ts` for each
      root in the shared list, the member-expression clocks, and
      `new Date().getTime()`, plus the allowed `new Date(value).getTime()`.
      Split the file if it passes 300 lines.
- [ ] Add `scripts/verification/test-roots.mjs` and its declaration file. Use
      the list in `discoverUnitFiles` and `eslint.config.js`.
- [ ] Extend both selectors as decided.
- [ ] Run `npm run lint` on the whole repository and fix any new finding.
      Smoke-test the message on a temporary file in `packages/viewer/tests/`.
- [ ] Set the Delivery Status in `docs/protocol/ci-test-timing.md` to
      Implemented.
- [ ] Run the rule tests, the verification script tests, `npm run lint` and
      `npm run typecheck`.

## Milestone 7: Deliver and review

Integrate main, run the complete gate, and deliver the branch.

Evidence: `.context/deterministic-test-timing-review-fixes/milestone-7.md`.

- [ ] Search the current docs and READMEs for statements that these changes
      make stale, and update them.
- [ ] Fetch `origin/main`. If it moved, merge it with the Mainline Feature
      Preservation steps in `AGENTS.md`. Save the merge justifications in the
      evidence file for the PR description.
- [ ] Run `cargo xtask check`.
- [ ] Inspect the diff and the deletions against `origin/main`. Record each
      approved removal in the commit body.
- [ ] Run `git add -A`, commit the completed work using Conventional
      Commits, and push the branch.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review
      the complete local diff against `origin/main` and report the findings.
      Then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.

## Post-merge follow-up (non-blocking)

- Decide whether a lint rule should reject counted polling loops under the
  test roots.
