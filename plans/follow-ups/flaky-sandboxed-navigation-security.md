# Stabilize the sandboxed navigation security test

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the complete gate of the branch
  `conductor/built-repository-packages-in-changes` at `b5acdf71`, which did
  not change this test or the viewer.
- **Location:** `tests/browser/browse_navigation_security.spec.ts:150`, and
  the browser error fixture in `tests/browser/browser_test.ts:44`.
- **Reason:** The test failed once in browser shard 1 of the remote gate and
  passed 3 of 3 local reruns, so its source is not known yet.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Browser error fixture:** the automatic Playwright fixture in
    `tests/browser/browser_test.ts` that fails a test when a page reports an
    error that the test does not allow.
  - **Sandboxed nested content:** a preview document that the shell loads in
    a sandboxed frame inside another frame, such as
    `/view/fixture/nested/home/`.
- **Background:** The test "sandboxed direct and nested content cannot
  escape or invoke parent enhancement" checks that sandboxed preview
  documents cannot reach the shell. On 2026-10-31 it failed in browser shard 1
  of 4 of the remote gate with "Unexpected browser errors". The browser error
  fixture recorded one `pageerror` at `/view/fixture/nested/home/`. Its message
  says that a frame of origin `http://127.0.0.1:33593` was blocked from
  reading the property `cancelAnimationFrame` of a cross-origin frame's
  `Window`. Three local runs of the same test on the same tree
  passed.
- **Problem:** Some script reads `cancelAnimationFrame` from a window of
  another origin while the test runs. The error appears only now and then,
  so the gate fails without a code change.
- **Impact if no action:** The complete gate can fail on a branch that does
  not touch the viewer, and each such failure costs a rerun.
- **Root question:** Which script reads `cancelAnimationFrame` through a
  cross-origin window during this test, and how does it stop doing so?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, record the pass
    counts under `.context/`, and name the source under the flaky-test rule
    of the `deterministic-tests` skill. Then fix the source in the product
    or the test, with every assertion kept. Effort: Medium.
  - **B.** Allow this one error text in the test. This hides a possible
    product defect and weakens the test. Effort: Small.
- **Left out:** A retry, a skip, or a longer time limit, because the
  flaky-test rule forbids them.
- **Wider fix:** None found.
- **Previous examples:** `plans/follow-ups/flaky-same-origin-handoff.md`
  records another viewer browser test that fails now and then in remote
  gates of unrelated branches.
- **Recommendation:** A. The error names a cross-origin access, which can be
  a real defect, so the source must be known before any change.
- **Action:** ask the user, because condition 6 of the decision test holds:
  a flaky test that the branch does not add or change waits for the user.
