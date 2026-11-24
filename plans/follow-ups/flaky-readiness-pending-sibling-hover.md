# Readiness spec sees a stray hover event

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch `calummoore/private-catalogue-embedded-access-lm7q`, during its complete gate.
- **Location:** `tests/browser/viewer_readiness.spec.ts:60-90`, the tests "same-origin pending sibling keeps navigation without automatic inspection" and "postMessage pending sibling keeps navigation without automatic inspection".
- **Reason:** The branch changes no Mokly viewer or frame code, so the flake is outside its scope.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Pending sibling:** a canvas frame whose instance usage is not known yet, so the viewer must not start inspection for it.
  - **Viewer harness:** the test page object `window.viewerHarness`, which records each event that the viewer sends to its host.
- **Background:**
  - The test hovers and clicks the "Visible" button in a pending sibling frame, then follows the "Open Action" link.
  - It then asserts that the harness recorded no `error`, `hover`, or `click` event.
  - In the complete gate on 2026-11-25, and in one of three later reruns of the test alone, the harness recorded one event: `hover` with `instance: null`, `boxes: []`, and `frame.entryPath: "action"`.
  - The event names the new screen `action`, so it comes after the navigation, from the frame that replaced the pending sibling.
  - A second complete gate run on 2026-11-25 failed the same way in both the same-origin and the postMessage variants.
- **Problem:** The adapters sometimes report a pointer-exit hover for the new frame after a navigation, and the test fails.
- **Impact if no action:** The browser suite of the gate fails now and then, and a local gate stops at that suite.
- **Root question:** Does a frame that replaces a pending sibling report a hover before any pointer event reaches it?
- **Options:**
  - **A.** Find the cause in the same-origin adapter's pointer-exit report after a navigation. Fix the adapter if it reports a hover without a pointer event, or fix the test if the hover is correct. Effort: Medium.
  - **B.** Move the pointer away from the frame before the navigation in the test. This hides a possible adapter bug. Effort: Small.
- **Left out:** A retry or a longer wait, because the `deterministic-tests` skill forbids them.
- **Wider fix:** A, because it decides whether the adapter sends events that no pointer caused.
- **Previous examples:** `plans/follow-ups/flaky-serve-comparison-edit-readiness.md`, another readiness flake.
- **Recommendation:** A. It finds out whether readers get a false hover report.
- **Action:** fix after merge, apply A, because the cause is in Mokly code that this branch does not change.
