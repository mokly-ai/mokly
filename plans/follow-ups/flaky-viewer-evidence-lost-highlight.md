# Viewer evidence test fails during its later pick

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-16, from the CI run of PR #293 at `2973ccd7`, job
  "Browser (Node 22.15.0, shard 4/4)", attempt 1.
- **Location:** `tests/browser/viewer_evidence_cancellation.spec.ts:66`, the
  test "same-origin one lost multi-highlight ref clears every frame and still
  ends a later pick", with the failed call at line 80.
- **Reason:** Neither PR #293 nor branch `calummoore/lisbon-h906` changes
  this test or the viewer and frame code, and each failure passed on its
  rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Execution context:** the JavaScript context of one page document in
    Playwright. A navigation destroys it and creates a new one.
  - **Pick:** the viewer mode in which the user chooses an element in a
    preview frame. The host starts it with `startPick`, and the viewer
    reports its end as an `end` event with a reason.
  - **Evidence update:** a call of `window.evidence.update`, which changes the
    highlight evidence of one preview frame in the test fixture.
- **Background:**
  - The test highlights two instances, then makes the mobile evidence empty.
    It waits for one evidence update and for no presentation.
  - Line 80 runs one `page.evaluate`. It restores the mobile evidence, starts
    a pick and waits for it, and then makes the desktop evidence empty.
  - Lines 85 to 92 expect three evidence updates and exactly the events
    `start` and `end:evidence`.
- **Problem:**
  - First failure: the test failed once in CI, in run 43965355088 of PR #293
    at `2973ccd7`, on 2026-11-16: job "Browser (Node 22.15.0, shard 4/4)",
    [attempt 1](https://github.com/mokly-ai/mokly/actions/runs/43965355088/job/133643531558).
    The job then failed its report check with
    `report process outcome is not a successful zero exit`. PR #293 changes
    only the CSS reference scan in `crates/mokly-css/src/syntax.rs`.
  - Failure text:

    ```text
    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
    ✖ chromium › viewer_evidence_cancellation.spec.ts › same-origin one lost multi-highlight ref clears every frame and still ends a later pick
        at /home/runner/_work/mokly/mokly/tests/browser/viewer_evidence_cancellation.spec.ts:80:16
    ```

  - Rerun outcome:
    [attempt 2](https://github.com/mokly-ai/mokly/actions/runs/43965355088/job/133654093154)
    of the same job, on the same head, passed.
  - Second failure: on 2026-11-17 at 18:38 UTC, the complete local gate
    `cargo xtask check` failed once at commit
    `f6a006f5f14bb18c32cccf5fd2e11606a7e08731` of branch
    `calummoore/lisbon-h906`, with Node 24.22.1. The browser suite ran all
    2,287 cases: 2,286 passed, one failed, and none was skipped or cancelled.
    The failed case was this test, after 517 ms, with the same failure text:

    ```text
    ✖ chromium › viewer_evidence_cancellation.spec.ts › same-origin one lost multi-highlight ref clears every frame and still ends a later pick
    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
        at /home/user/code/mokly/tests/browser/viewer_evidence_cancellation.spec.ts:80:16
    ```

    The runner then failed its report check with
    `report process outcome is not a successful zero exit`.

  - Rerun outcome: one raw focused Playwright run of the test, at the same
    commit, passed 1 of 1 with exit 0. No code, test, configuration,
    assertion, or time limit changed. `playwright.config.ts` sets no retries.
  - On that branch, the spec, `tests/browser/browser_test.ts`,
    `tests/browser/viewer_evidence_fixture.ts`, `playwright.config.ts`, and
    the code of `packages/viewer`, `packages/frame`, and `packages/ui` have no
    diff against `main` at `794b30a91`.
  - Both failures were in the same-origin form of the test. In the gate run,
    the postMessage form of the same test passed.
  - Suspected source: the `page.evaluate` at line 80 waits for `startPick`
    while the evidence update of the same call can replace a preview frame.
    Playwright reports the same text for other protocol errors of the call,
    so the text alone does not prove a navigation. Nobody confirmed it.
  - The failed CI attempt saved a Playwright trace in the artifact
    `browser-failures-node-22.15.0-shard-4-attempt-1` of run 43965355088.
    Nobody read it yet.
  - No trace of the gate failure remains. `playwright.config.ts` keeps a
    trace on failure in `.context/playwright-results`. After the focused
    rerun, that folder held only the record of the rerun.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, in CI and in the complete gate. It has failed once in each. A real
  viewer defect can hide behind a flake label.
- **Root question:** How does the test start its later pick only when the
  page and its frames are ready for it, so that a correct viewer always
  passes?
- **Options:**
  - **A.** Read the saved trace, reproduce the failure by repeating the test,
    and name the source. Then wait for an explicit signal before the step
    that races. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails more often. It has failed
    twice so far. Effort: Small.
  - **C.** If the reproduction shows a viewer defect, add a failing test
    first. Then fix the viewer code that causes it. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The `testing`
  skill forbids them, because they hide the source.
- **Wider fix:** None. The `testing` skill already requires an explicit
  readiness signal, and the fix is specific to this test.
- **Related:**
  - [flaky-viewer-events-active-picks.md](./flaky-viewer-events-active-picks.md)
    has the same failure text in a `page.evaluate` that starts a pick, in the
    same CI shard. It has its own test, so it needs its own fix.
  - [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
    has the same failure text in another viewer test.
- **Recommendation:** A. It removes the race and keeps every assertion.
- **Action:** ask the user, because the failure has not been reproduced with
  a confirmed cause.
