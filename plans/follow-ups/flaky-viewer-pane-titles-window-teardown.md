# Viewer pane titles test meets a removed window

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the CI of PR #498, branch `calummoore/ci-fix-site-lighthouse-hn4n`.
- **Location:** `packages/viewer/tests/comparison_pane_titles.test.tsx:129-187`, the test "a Dark frame that shows its Light view names its own frame in its panes' titles", and its teardown `t.after(() => GlobalRegistrator.unregister())` at `:131`.
- **Reason:** PR #498 changes only plan files, so the viewer test that failed in its CI is outside its scope.

- **Terms:**
  - **`GlobalRegistrator`:** the helper of `@happy-dom/global-registrator` that installs a browser-like `window` and `document` as Node globals for a test, and removes them again.
- **Background:** The `Viewer` job of CI runs the viewer tests under `packages/viewer/tests`. This test registers the DOM globals, renders `ComparisonCanvas` with `@testing-library/react`, waits for four frame titles, and unmounts the view in a `finally` block. A `t.after` hook then removes the DOM globals. 26 viewer tests in 22 files use the same `t.after` teardown.
- **Problem:** On 2026-11-24 the test failed once in the `Viewer (Node 22.15.0)` job of CI run 45441710527, job 138614426636, at commit `998af24d8` of PR #498:

  ```text
  ✖ a Dark frame that shows its Light view names its own frame in its panes' titles
  Error [ERR_TEST_FAILURE]: window is not defined
  Caused by:
  ReferenceError: window is not defined
      at node_modules/react-dom/cjs/react-dom-client.development.js:17920:15
      at Immediate.performWorkUntilDeadline (node_modules/scheduler/cjs/scheduler.development.js:45:48)
  ```

  The same job passed on the next commit, `d0dc4e459`, in run 45448210080. Between the two commits, only plan files and a desktop release change from `main` differ, so the test is flaky. The suspected source is async ordering: React's scheduler runs queued work in a later `setImmediate` callback, and that callback can run after `view.unmount()` and after `t.after` removed `window`. Nobody has reproduced it yet.

- **Impact if no action:** The `Viewer` job, which Required CI needs, fails now and then on a correct change, and the change needs a rerun.
- **Root question:** How does each viewer test that removes the DOM globals know that React has no more queued work before it removes them?
- **Options:**
  - **A.** In this test, wait until React has flushed its queued work after the unmount, for example by unmounting inside `act`, before the globals go. Reproduce the failure first with repeated runs, and record the pass counts before and after. Effort: Small.
  - **B.** Give the viewer tests one teardown helper that unmounts, waits until React's scheduler is idle, and only then removes the DOM globals, and move the 26 tests to it. Reproduce first, as A does. Effort: Medium.
  - **C.** Register the DOM globals once for the whole viewer test process, and never remove them. It drops the per-test isolation of the globals that the tests rely on. Effort: Small.
- **Left out:** A retry, a sleep, or a longer timeout. They fail the goal, because the late callback still runs, and the testing rules forbid them for a flaky test.
- **Wider fix:** B. Every test that removes the DOM globals then waits for React in the same way.
- **Previous examples:** None found.
- **Recommendation:** B. One helper removes the race from all 26 tests that share the teardown, after a reproduction confirms the cause.
- **Action:** fix after merge, apply B, because the test is outside the scope of the change that found it, and one fix in its own branch reaches every open branch.
