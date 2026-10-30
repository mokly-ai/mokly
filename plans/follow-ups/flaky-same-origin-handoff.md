# Stabilize the same-origin handoff browser test

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `tests/browser/same_origin_identity.spec.ts:126`, with the
  probe helper at lines 245 to 273.
- **Reason:** The test failed once in the remote gate of PR #226, which did
  not change it, and it passed on the rerun.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Same-origin adapter:** the viewer frame adapter that mounts a preview
    document of the same origin in the `#frame` element.
  - **Handoff:** the window in which a new adapter mount replaces the
    document of a mounted frame.
- **Background:**
  - The test "an unowned exact-resource document gains no navigation
    privilege during handoff" starts at
    `tests/browser/same_origin_identity.spec.ts:126`.
  - It mounts the frame and clicks a link to the exact-resource document. It
    then starts a second mount of the same URL and holds that request in a
    route handler until the test releases it.
  - While the request waits, `probeCurrentDocument` at line 245 reads the
    frame's current document. It finds `[data-mokly-link="action"]` with
    `querySelector` and dispatches a click on it at line 265.
- **Problem:**
  - Failure: the test failed once in browser shard 2 of 4 of the remote gate
    of PR #226 on 2026-10-28.
  - Failure text:
    `Cannot read properties of null (reading 'dispatchEvent')`. So the
    probe's `querySelector` found no element in the frame's current
    document.
  - Rerun outcome: the shard passed on its rerun, and the test passed ten of
    ten local runs.
  - Suspected source: the probe reads the frame document during the handoff
    race, before the expected document is in the frame. Nobody confirmed it.
- **Impact if no action:** The browser suite can fail at random on a correct
  change. A real handoff defect can hide behind a flake label.
- **Root question:** How does the probe know that the frame shows the
  expected document before it dispatches the click?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and name the source.
    Then make the probe wait for an explicit signal that the frame's current
    document is the exact-resource document with its action link. Keep every
    assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the failure
    details in this item then. Effort: Small (estimate).
  - **C.** If the reproduction shows a product race in the handoff of the
    same-origin adapter, add a failing test first. Then fix the order in the
    adapter. Effort: Medium (estimate).
- **Left out:** A retry, a sleep, or a longer time limit. The
  `deterministic-tests` skill forbids them, because they hide the source.
- **Wider fix:** None. The `deterministic-tests` skill already requires an
  explicit readiness signal, and the fix is specific to this probe.
- **Previous examples:** Other browser tests that failed once and passed on
  the rerun:
  [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
  and [frame-adapter-message-flake.md](./frame-adapter-message-flake.md).
- **Related:** Each item below is a separate case of the same recorded
  class: a browser test that failed once and passed on the rerun. Each has
  its own test and suspected source, so each needs its own fix.
  - [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md):
    a viewer test whose page evaluation raced a navigation.
  - [frame-adapter-message-flake.md](./frame-adapter-message-flake.md): a
    frame adapter test that once got no navigation message.
  - [flaky-large-watch-react.md](./flaky-large-watch-react.md): the large
    React watch test, which timed out once at its 300-second guard.
- **Recommendation:** A (estimate). It removes the race from the test and
  keeps every assertion.
- **Action:** ask the user, because condition 6 holds (estimate): the
  failure was not reproduced and its source is not confirmed, so the
  `deterministic-tests` skill gives `ask the user`.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L430).
