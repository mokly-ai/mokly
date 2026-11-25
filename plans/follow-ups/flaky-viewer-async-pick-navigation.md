# Viewer pick test loses its page to a navigation

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from `calummoore/ci-speed-fast-local-test-loop-v1dm` during the local Browser worker measurements.
- **Location:** `tests/browser/viewer_async.spec.ts:29`.
- **Reason:** The local test speed change does not touch the viewer, its browser fixture, or this test, so its fix belongs in a separate branch.

- **Background:** The browser test `concurrent pick is idempotent and cancellation rejects pending activation` opens the viewer fixture page of `packages/viewer/tests/browser_fixture.ts`. It starts one viewer and calls `startPick` twice in one `page.evaluate` call.
- **Problem:** The test failed with `Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.` at line 36. Something navigated or reloaded the fixture page during the evaluate call. It failed once in nine complete local Browser suite runs, in a run with two workers. It also failed 1 of 20 times with `--repeat-each=20` and one worker alone, and 1 of 20 times beside a second worker.
- **Impact if no action:** A passing change can fail the Browser suite in CI and in the local gate, at about 5% per run of this test.
- **Root question:** What navigates the viewer fixture page while the test runs, and how does the test wait until the page stops navigating?
- **Options:**
  - **A.** Find the navigation in the trace, and make the test wait for an observable state that comes after it. Keep every assertion. Effort: Small.
  - **B.** Make the viewer fixture page stop navigating after the harness is ready, when the navigation comes from the fixture. Effort: Medium.
  - **C.** Fix the product, when the viewer itself navigates the host page during a pick. First confirm that the navigation comes from the viewer. Effort: Medium.
- **Left out:** Retries, sleeps, and longer time limits hide the navigation and do not establish its source.
- **Wider fix:** B. A fixture page that never navigates after readiness removes the race for every viewer browser test.
- **Previous examples:** None found.
- **Recommendation:** B when the fixture causes the navigation, otherwise C.
- **Action:** fix after merge, apply B or C after the trace shows the source.

The suspected source is a reload or a navigation of the fixture page during the first `startPick`. This source was not confirmed. The traces are under `.context/playwright-results/` of the workspace that found it. The observed runs used merged `main` at `3c7306065` with Node `24.21.0`, Chromium headless shell 149, and a 4-CPU Linux machine. No test, assertion, or product code changed in response.
