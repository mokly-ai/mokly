# Viewer pick test fails during its second pick

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the CI run of PR #270 at `ce7ccd43`, job
  "Browser (Node 22.15.0, shard 4/4)", attempt 1.
- **Location:** `tests/browser/viewer_events.spec.ts:113`, the test "Escape
  and navigation end active picks exactly once", with the failed call at
  line 124.
- **Reason:** The test is unrelated to PR #270, which changes no viewer or
  browser code, and it passed on the rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Execution context:** the JavaScript context of one page document in
    Playwright. A navigation destroys it and creates a new one.
  - **Pick:** the viewer mode in which the user chooses an element in a
    preview frame. The host starts it with `startPick`, and the viewer
    reports its end as a `pick-end` event with a reason.
  - **Cross-origin adapter:** the viewer frame adapter that talks to
    preview frames of another origin through posted messages, in
    `packages/viewer/src/client/post_message_adapter.ts`.
- **Background:**
  - The test starts at `tests/browser/viewer_events.spec.ts:113`. It mounts
    the viewer with the cross-origin adapter, through
    `window.viewerHarness.start("one", { cross: true })`.
  - Line 120 starts a pick and waits for it. Line 123 presses Escape, which
    ends the pick with the reason `escape`.
  - Line 124 runs one `page.evaluate`. It starts a second pick and waits for
    it. Then it selects the screen `action`, which ends the pick with the
    reason `navigation`, and it calls `cancelPick`.
  - Lines 130 to 137 expect exactly two `pick-end` events: `escape`, then
    `navigation`. So `cancelPick` must add no third event.
  - No step waits for the end of the first pick before line 124. The viewer
    can learn of the Escape press from a preview frame, through a posted
    message, at `packages/viewer/src/inspector/runtime.ts:129-133`.
  - While a pick is active, `startPick` resolves at once and starts no new
    pick, at `packages/viewer/src/viewer/picking.ts:20`.
- **Problem:**
  - Failure: the test failed once in CI, in run 41324205903 of PR #270 at
    `ce7ccd43`, on 2026-11-01: job "Browser (Node 22.15.0, shard 4/4)",
    [attempt 1](https://github.com/mokly-ai/mokly/actions/runs/41324205903/job/124900775209).
    The job then failed its report check with
    `report process outcome is not a successful zero exit`.
  - Failure text:

    ```text
    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.
        at /home/runner/_work/mokly/mokly/tests/browser/viewer_events.spec.ts:124:14
    ✖ chromium › viewer_events.spec.ts › Escape and navigation end active picks exactly once
    ```

  - Rerun outcome:
    [attempt 2](https://github.com/mokly-ai/mokly/actions/runs/41324205903/job/124903423289)
    of the same job, on the same head, passed.
  - Suspected source: the `page.evaluate` at line 124 runs while the page
    can still navigate. A navigation can then destroy its execution context
    before the call returns. Nobody confirmed it.
  - The failed attempt saved a Playwright trace in the artifact
    `browser-failures-node-22.15.0-shard-4-attempt-1` of that run. In the
    trace, the call at line 124 started 1 ms after the Escape press and
    failed 34 ms later. The trace has one request for the top page
    document, at the start of the test, and no later one. About 7 ms after
    the failure, the page requested the `action` documents in two new
    frames. Only line 127 selects `action`.
  - So the failure text alone does not prove a navigation. Playwright 1.61.1
    reports this text for every protocol error of the call, except a closed
    or crashed session and two errors of result serialization. The rule is
    in `rewriteError` of `playwright-core`.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, in CI and in the complete gate. A real viewer defect can hide
  behind a flake label.
- **Root question:** How does the test start its second pick only when the
  page is ready for it, so that a correct viewer always passes?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and name the source.
    Log the protocol error of the failed call, for example with
    `DEBUG=pw:protocol`, and check whether the top page navigates. Then wait
    for an explicit signal before the step that races, such as the
    `pick-end` event of the Escape press before the second pick starts. Keep
    every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the
    protocol error and the failed step then. Effort: Small.
  - **C.** If the reproduction shows a viewer defect, such as an unexpected
    navigation of the host page, add a failing test first. Then fix the
    viewer code that causes it. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The `testing`
  skill forbids them, because they hide the source.
- **Wider fix:** None. The `testing` skill already requires an explicit
  readiness signal, and the fix is specific to this test.
- **Previous examples:** Two browser flakes of the same kind failed at random
  until PR #271 fixed them on 2026-11-01. In each, a check read a page or a
  frame while a navigation or a frame handoff replaced it:
  - The same-origin handoff test, in
    [flaky-same-origin-handoff.md at its last commit](https://github.com/mokly-ai/mokly/blob/43a2a76b80c37965c00a7193b5d8aa6442e5ddc6/plans/follow-ups/flaky-same-origin-handoff.md).
    Its confirmed source: the preparation poll accepted the committed URL
    while the document still loaded. The fix waits for a complete document
    and its action link before the replacement mount.
  - The imported CSS comparison pane tests, in
    [flaky-imported-css-comparison-frame.md at its last commit](https://github.com/mokly-ai/mokly/blob/43a2a76b80c37965c00a7193b5d8aa6442e5ddc6/plans/follow-ups/flaky-imported-css-comparison-frame.md).
    Its confirmed source: the helper read the first frame of a side, which
    could still belong to the earlier mode, before the viewer replaced it.
    The fix reads only the frames of the selected mode.
- **Related:**
  - [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
    is the closest open case. Its viewer test failed once with the same
    failure text, and nobody recorded the failed step. It has its own test,
    so it needs its own fix.
  - [frame-adapter-message-flake.md](./frame-adapter-message-flake.md) is a
    separate case of the same recorded class. Its test reads the posted
    frame events of a cross-origin preview frame, and this test also uses
    cross-origin preview frames. It has its own test and suspected source,
    so it needs its own fix.
- **Recommendation:** A. It removes the race and keeps every assertion.
- **Action:** ask the user, because the failure has not been reproduced with
  a confirmed cause. No fix is clearly best until reproduction identifies
  the source, as the flaky-test rule requires.
