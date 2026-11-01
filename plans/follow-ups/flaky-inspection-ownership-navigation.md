# Inspection ownership test races a navigation

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the remote gate of `calummoore/mokly-ui-inspector` at `d7a9780e`, "browser-4-of-4", during the shell views plan, which does not change this test or the code it covers.
- **Location:** `tests/browser/viewer_inspection_ownership.spec.ts:79`, the `page.evaluate` of the generated test "same-origin obsolete labels success preserves request replacement pick".
- **Reason:** The failure needs the load of a full shard, and its cause is not confirmed.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Execution context:** the JavaScript context of one page document in
    Playwright. A navigation destroys it, and a `page.evaluate` that runs
    across the navigation fails.
- **Background:**
  - The spec generates one test for each adapter (same-origin and
    postMessage), each replacement (frame and request), each operation
    (geometry, labels, highlight, and scroll), and each outcome. Each test
    loads the host, starts inspection, and holds one operation in a probe
    while it replaces the frame or the request.
  - On 2026-10-31 the same-origin "labels success, request replacement" test
    failed at line 79 with this error. The other 31 tests of the spec passed
    in the same run.

    ```text
    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
    ```

  - It failed again in the next remote gate of the branch, at `9841e203`, in
    the variant "same-origin obsolete highlight success preserves request
    replacement pick", with the same error at line 79.
  - Locally the whole spec passed 170 of 170 runs on Node 24 and 170 of 170
    on Node 22.15.0, with `--repeat-each=5`. So the failure needs the load of
    a full remote shard.
  - `plans/follow-ups/flaky-viewer-selection-navigation.md` records the same
    error in another spec, `tests/browser/viewer.spec.ts`.
- **Problem:** A navigation of the host page can happen while the test's
  `page.evaluate` still runs, so the test fails at random.
- **Impact if no action:** The browser suite can fail on a correct change and
  costs a rerun.
- **Root question:** What navigates the host page while the test starts its
  pick, and how does the test wait for it?
- **Options:**
  - **A.** Reproduce the failure with `--repeat-each`, name the navigation,
    and wait for the page's load state or a readiness signal before the
    `page.evaluate`. Keep every assertion. Effort: Small.
  - **B.** A, and give the shared start of these tests, `startInspection`,
    the same wait, so that every generated test gains it. Effort: Small.
- **Left out:** A retry or a longer time limit, because the
  `testing` skill rules them out.
- **Wider fix:** B.
- **Related:** `flaky-viewer-selection-navigation.md`: the same error class.
  One readiness rule for host pages could serve both.
- **Previous examples:** `flaky-viewer-selection-navigation.md`.
- **Recommendation:** B.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.
