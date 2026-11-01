# Viewer selection test races a navigation

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from a local complete gate run of PR #242 at
  `f15728a5`.
- **Location:** `tests/browser/viewer.spec.ts:22`, the test "uncontrolled
  selection, slots and handle lifecycle".
- **Reason:** The test is unrelated to PR #242 and passed on the rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Execution context:** the JavaScript context of one page document in
    Playwright. A navigation destroys it and creates a new one.
- **Background:**
  - The viewer suite test "uncontrolled selection, slots and handle
    lifecycle" starts at `tests/browser/viewer.spec.ts:22`.
  - It evaluates code in the page at several steps.
- **Problem:**
  - Failure: the test failed once in a local complete gate run of PR #242
    at `f15728a5`. The date of the run was not recorded. PR #242 merged on
    2026-10-29.
  - Failure text:
    `Execution context was destroyed, most likely because of a navigation.`
    The step of the test that failed was not recorded.
  - Rerun outcome: the focused rerun and the next complete gate passed
    without a change.
  - Suspected source: the test evaluates in the page while a navigation
    replaces its context.
- **Impact if no action:** The browser suite can fail at random on a correct
  change. A real navigation defect can hide behind a flake label.
- **Root question:** How does the test wait for the navigation to finish
  before it evaluates in the page?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and find the
    evaluation that races. Then wait for an explicit signal that the
    navigation ended, such as the new URL or a ready mark, before that
    evaluation. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the failed
    step then. Effort: Small.
  - **C.** If the reproduction shows an unexpected navigation of the page,
    add a failing test first. Then fix the viewer code that starts it.
    Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The
  `testing` skill forbids them, because they hide the source.
- **Wider fix:** None. The `testing` skill already requires an
  explicit readiness signal, and the fix is specific to this test.
- **Previous examples:** Other browser tests that failed once and passed on
  the rerun:
  - The same-origin handoff test, in
    [flaky-same-origin-handoff.md at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/flaky-same-origin-handoff.md).
    Its confirmed source: the preparation poll accepted the committed URL
    while the document still loaded. The fix of 2026-11-01 also waits for a
    complete document and its action link.
  - [frame-adapter-message-flake.md](./frame-adapter-message-flake.md).
- **Related:**
  - [flaky-browser-error-rejection-commit-info.md](./flaky-browser-error-rejection-commit-info.md)
    records the other unrelated browser failure that PR #242 met. It has a
    different test and a different source.
  - [frame-adapter-message-flake.md](./frame-adapter-message-flake.md) is a
    separate case of the same recorded class: a browser test that failed
    once and passed on the rerun. It has its own test and suspected source,
    so it needs its own fix.
  - [flaky-viewer-events-active-picks.md](./flaky-viewer-events-active-picks.md)
    is a separate case of the same recorded class, with the same failure
    text and the same `viewerFixture` and `window.viewerHarness`. The trace
    of its failure shows no second load of the top page, and that item says
    why the failure text alone does not prove a navigation. It has its own
    test and suspected source, so it needs its own fix.
- **Recommendation:** A. It removes the race and keeps every
  assertion.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.
