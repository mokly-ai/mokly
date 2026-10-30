# Pick promise stays unsettled during adapter swap

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Medium (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #224, the investigation of CI run 40933916619.
- **Location:** `packages/viewer/src/viewer/picking.ts:33` and
  `packages/viewer/src/viewer/host_bridge.tsx:213`.
- **Reason:** The picker code is byte-identical on `main`, and PR #224 changed
  only the timing that exposed the problem.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`MoklyViewer`:** the embeddable React viewer of `@mokly/viewer`. A host
    controls it through a handle with `startPick()` and `cancelPick()`.
  - **Frame adapter:** the `frameAdapter` prop of `MoklyViewer`. It mounts
    the preview frame. React installs a new adapter after the host renders
    it.
- **Background:**
  - `startPick` at `packages/viewer/src/viewer/host_bridge.tsx:213` starts a
    pick through the picking state in
    `packages/viewer/src/viewer/picking.ts`. At line 33, the promise races
    the activation against the cancellation signal.
  - `docs/protocol/mokly-component-explorer.md:223` says that a frame
    replacement ends host picking.
  - The first CI run of PR #224, 40933916619, failed in
    `tests/browser/viewer_async.spec.ts`. On Node 22.15.0 and Playwright
    Chromium 149.0.7827.55, the branch passed 7 of 20 repetitions and failed 13. `main` at `162e8e2a` passed all 20.
  - In 45 investigation runs at `0989c26d`, no host page navigated. Chromium
    answered the test's `page.evaluate` with "Promise was collected", and
    Playwright reports that error as a navigation.
  - Commit `881a566e` of PR #224 made the test wait for the new adapter's
    `mount` callback instead of one animation frame. Every assertion stayed.
    The test then passed 20 of 20 repetitions, but it no longer covers this
    order.
- **Problem:** A host can call `startPick()` and then `cancelPick()` after it
  renders a new `frameAdapter` and before React installs it. In 11 of 20
  runs of `tests/browser/viewer_async.spec.ts` at `0989c26d`, the
  `startPick()` promise of that sequence did not settle, and Chromium
  collected it. The report of these runs was not kept in the repository.
- **Impact if no action:** A host that awaits such a promise waits forever.
- **Root question:** How does every `startPick()` promise settle when the
  host cancels it while the frame adapter changes?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Make `cancelPick()` reject the pending start promise also while an
    adapter swap is in progress. Add a browser test for this order. Effort:
    Small (estimate).
  - **C.** Let the picking state own every started promise, and settle each
    one when the host cancels it or when the frame adapter changes. Add a
    browser test for both orders. Effort: Medium (estimate).
- **Left out:** A longer wait in the test. The `deterministic-tests` skill
  forbids it, and it does not settle the promise for a host.
- **Wider fix:** C (estimate). One owner settles every pick, whatever ends
  it.
- **Previous examples:** None found. The test "frame failures end picking
  once and reject one handle with one safe error" in
  `tests/browser/viewer_async.spec.ts` covers the related case of a frame
  failure.
- **Recommendation:** C (estimate). It follows the rule that a frame
  replacement ends host picking, for every order of events.
- **Action:** fix after merge, apply C (estimate), because an unsettled
  promise is a product bug outside the diff of PR #224, and C is not
  blocked.
