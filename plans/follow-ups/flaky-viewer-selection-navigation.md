# Viewer selection test races a navigation

- **Severity:** Low (estimate). **Effort:** Small (estimate).
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
    evaluation. Keep every assertion. Effort: Small (estimate).
  - **B.** Change nothing until the test fails again, and record the failed
    step then. Effort: Small (estimate).
  - **C.** If the reproduction shows an unexpected navigation of the page,
    add a failing test first. Then fix the viewer code that starts it.
    Effort: Medium (estimate).
- **Left out:** A retry, a sleep, or a longer time limit. The
  `deterministic-tests` skill forbids them, because they hide the source.
- **Wider fix:** None. The `deterministic-tests` skill already requires an
  explicit readiness signal, and the fix is specific to this test.
- **Previous examples:** Other browser tests that failed once and passed on
  the rerun: [flaky-same-origin-handoff.md](./flaky-same-origin-handoff.md)
  and [frame-adapter-message-flake.md](./frame-adapter-message-flake.md).
- **Related:**
  - [flaky-browser-error-rejection-commit-info.md](./flaky-browser-error-rejection-commit-info.md)
    records the other unrelated browser failure that PR #242 met. It has a
    different test and a different source.
  - [flaky-same-origin-handoff.md](./flaky-same-origin-handoff.md) and
    [frame-adapter-message-flake.md](./frame-adapter-message-flake.md) are
    separate cases of the same recorded class: a browser test that failed
    once and passed on the rerun. Each has its own test and suspected
    source, so each needs its own fix.
- **Recommendation:** A (estimate). It removes the race and keeps every
  assertion.
- **Action:** ask the user, because condition 6 holds (estimate): the
  failure was not reproduced and its source is not confirmed, so the
  `deterministic-tests` skill gives `ask the user`.
