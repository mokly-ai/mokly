# Comparison pane titles test races its DOM teardown

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the `viewer` suite run on the branch
  `calummoore/mokly-website-redesign-plan-v2-xnnj` (the workspace source
  packages change), which does not change `packages/viewer` code.
- **Location:** `packages/viewer/tests/comparison_pane_titles.test.tsx:129-186`.
- **Reason:** The flake is in a viewer test that the failing branch does not
  touch, so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Flaky test.
- **Terms:**
  - **DOM globals:** the `window` and `document` objects that
    `GlobalRegistrator.register()` from `@happy-dom/global-registrator` puts
    on `globalThis` for a Node test, and that `unregister()` removes.
  - **React scheduler:** the `scheduler` package that `react-dom` uses. It
    runs queued render work later, in a `setImmediate` callback
    (`performWorkUntilDeadline`).
- **Background:**
  - The test "a Dark frame that shows its Light view names its own frame in
    its panes' titles" calls `GlobalRegistrator.register()`, renders the
    viewer, waits for four pane titles, then calls `view.unmount()` in a
    `finally` block. `t.after(() => GlobalRegistrator.unregister())` removes
    the DOM globals when the test ends.
  - The test came with the Canvas redesign, PR #488, merged as `6d4f4f6cf`.
  - On 2026-11-24 one full `viewer` suite run failed this test, with 3,644
    of 3,645 tests passing. The failure text:
    `Error [ERR_TEST_FAILURE]: window is not defined`, caused by
    `ReferenceError: window is not defined` at
    `node_modules/react-dom/cjs/react-dom-client.development.js:17920:15`,
    called from `Immediate.performWorkUntilDeadline`
    (`node_modules/scheduler/cjs/scheduler.development.js:45:48`).
    Line 17920 reads `window.event`.
  - Rerun outcome: three runs of
    `npx tsx --test packages/viewer/tests/comparison_pane_titles.test.tsx`
    on the same commit passed. An earlier full suite run on the same branch
    also passed it.
  - On 2026-11-25 the same failure, with the same text, failed one full
    `viewer` suite run on the branch
    `calummoore/live-channel-foundation-implementation-n1hi`, which does not
    change `packages/viewer`. Three runs of
    `npm test -- packages/viewer/tests/comparison_pane_titles.test.tsx`
    passed, and the next full suite run passed it.
  - On 2026-11-25 it failed again in a complete gate run on the same branch,
    at commit `6ac0b8f41`, with the same failure text and 3,660 of 3,661
    viewer tests passing. Three runs of the file alone passed.
- **Problem:** Suspected source: render work that the scheduler queued
  before `unmount()` runs in a later `setImmediate`, after the `t.after`
  hook has already removed `window`.
- **Impact if no action:** The `viewer` suite fails now and then with no
  cause in the change under test, and each failure costs a rerun and an
  investigation.
- **Root question:** How does the test let React finish its queued work
  before the DOM globals go away?
- **Options:**
  - **A.** Unmount inside `act()` from `react`, so React flushes its queued
    work before the test ends. Effort: Small.
  - **B.** A shared test helper that registers the DOM globals and, on
    teardown, unmounts each root inside `act()` before it unregisters. The
    other viewer tests that use `GlobalRegistrator` then share one safe
    teardown. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer wait, because the testing
  rules forbid them for a flaky test.
- **Wider fix:** B, because each viewer test that registers DOM globals has
  the same teardown order.
- **Previous examples:** None found.
- **Recommendation:** B. It fixes the class with one helper.
- **Action:** fix after merge.
