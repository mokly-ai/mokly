# Wait for the frame adapter navigation message

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a browser follow-up of Milestone 8, recorded in Milestone 15.
- **Location:** `tests/browser/frame_adapter_navigation.spec.ts:24-117`,
  with the polled assertions at lines 44-57 and 73-90.
- **Reason:** The test failed once in a verification run of unrelated
  browser work, and nobody reproduced the failure or confirmed its source.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Frame adapter:** the viewer client that mounts a preview frame and
    turns its posted messages into frame events, in
    `packages/viewer/src/client/frame_adapter.ts`.
- **Background:**
  - The test "cross-origin native activations report bounded targets and
    modifiers without navigation" clicks links inside a cross-origin preview
    frame.
  - The frame runtime emits a `navigation` frame event in its click
    handler, at `packages/viewer/src/inspector/runtime.ts:110-128`.
  - The fixture at `tests/browser/frame_adapter_fixture.ts:46-48` pushes
    each frame event into `window.frameEvents`. The test clears that list
    before each click.
  - After each click, `expect.poll` waits until the list holds exactly one
    `navigation` event. The default expect timeout is 10,000 ms, in
    `playwright.config.ts:18`.
  - `tests/browser/same_origin_identity.spec.ts` also records
    `window.frameEvents`, so option C would change that spec too.
- **Problem:**
  - Failure: the posted-message assertion once got no navigation event.
  - Failure text: not recorded. The plan named a browser delegate report,
    `report-4.md`, that is not in the repository. The date, the run, and the
    link that failed are not recorded either.
  - Rerun outcome: the test passed unchanged on the rerun.
  - Suspected source: the order of posted messages and animation frames in
    the viewer frame code. Nobody confirmed it.
- **Impact if no action:** The browser suite can fail at random on a
  correct change. A real lost navigation message can hide behind a
  "flake" label.
- **Root question:** How can the test know that the frame sent its
  navigation message before it checks the result?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and name the
    source. Then make each check wait for the posted navigation message
    itself, through an explicit signal, before it compares the events. Keep
    every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the
    failure text in this item then. Effort: Small.
  - **C.** Apply A through one fixture helper that resolves on the next
    frame event of a given type. Use it in each of the nine specs that read
    `frameEvents`. Effort: Small.
  - **D.** If the reproduction shows a product race in the frame code, add
    a failing test first. Then fix the order in the viewer frame code.
    Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The
  `testing` skill forbids them, because they hide the source.
- **Wider fix:** C. One helper gives every frame adapter spec an explicit
  readiness signal.
- **Previous examples:** Other browser tests that failed once and passed
  on a rerun:
  - During the Rust rebuild, the public embedded viewer test in
    `tests/browser/static_cors.spec.ts` once failed on a blocked-script
    notice from a sandboxed `about:blank` frame. A real-browser probe found
    the location `about:blank` for this notice in 10 of 10 runs. Commit
    `cc5a3e01` of 2026-10-19 made the shared console rule in
    `tests/browser/console_notices.ts` accept the notice with that location.
  - The same-origin handoff test, in
    [flaky-same-origin-handoff.md at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/flaky-same-origin-handoff.md).
    Its confirmed source: the preparation poll accepted the committed URL
    while the document still loaded. The fix of 2026-11-01 also waits for a
    complete document and its action link.
  - [flaky-viewer-selection-navigation.md](flaky-viewer-selection-navigation.md)
- **Related:**
  - [flaky-viewer-selection-navigation.md](flaky-viewer-selection-navigation.md)
    is a separate case of the same recorded class: a browser test that failed
    once and passed on its rerun. Its test is in
    `tests/browser/viewer.spec.ts`. That test reads no frame events, and its
    suspected source is a page navigation. The two items share no test code.
  - [flaky-viewer-events-active-picks.md](flaky-viewer-events-active-picks.md)
    is a separate case of the same recorded class: a browser test that failed
    once and passed on its rerun. Its test is in
    `tests/browser/viewer_events.spec.ts`. Both tests serve their
    cross-origin preview frames through `crossOriginFixture` in
    `packages/viewer/tests/standalone_fixture.ts`. Each item has its own
    suspected source, so it needs its own fix.
- **Recommendation:** A. The plan recommended it: wait for the message
  event. C best protects the other frame adapter specs.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4696).
