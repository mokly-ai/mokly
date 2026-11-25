# Viewer readiness test sees a hover after navigation

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj` during its local complete gate.
- **Location:** `tests/browser/viewer_readiness.spec.ts:19-93`, especially lines 61-92.
- **Reason:** The branch that found the flake changes only the marketing site, so the fix belongs in its own branch, where it reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Sibling view:** the other viewport of the same screen on the canvas. Here the desktop view is the sibling of the highlighted mobile view.
  - **Viewer harness:** `window.viewerHarness` on the browser fixture page. It mounts the viewer and records each viewer callback in `events`.
- **Background:**
  - The four tests `{same-origin|postMessage} {pending|unavailable} sibling keeps navigation without automatic inspection` mark the desktop view of `home` as pending or unavailable. They highlight an instance in the mobile view and clear the events.
  - Each test then hovers and clicks **Visible** in the desktop frame and clicks the link **Open Action** in the same frame. It waits for one `navigate` event to `action`. Then it expects no `error`, `hover` or `click` event.
- **Problem:**
  - On 2026-11-24 the complete gate failed on `same-origin unavailable sibling …` and `postMessage pending sibling …`, with Chromium and Node 24.22.1, on branch commit `91615bae2` over `origin/main` `6d4f4f6cf`.
  - The failure text of both tests, at line 90:

    ```text
    - Array []
    + Array [
    +   Object {
    +     "name": "hover",
    +     "value": Object {
    +       "boxes": Array [],
    +       "frame": Object {
    +         "entryPath": "action",
    +       },
    +       "instance": null,
    +     },
    +   },
    + ]
    ```

  - Rerun: `npm run test:browser -- tests/browser/viewer_readiness.spec.ts --repeat-each=5` failed 2 of 20 runs, the `same-origin pending` and `postMessage pending` cases, and passed 18.
  - Suspected source: the pointer stays over the desktop frame after the click on **Open Action**. The `action` screen then loads in that frame under the still pointer, and the frame reports a hover of the new document before the final assertion reads the events. The test has no step that moves the pointer away or waits for an end of pointer events. This is not reproduced in isolation.
- **Impact if no action:** The browser suite of the complete gate fails now and then on any branch, and a local run stops at that suite.
- **Root question:** How does the test check that navigation from a pending or unavailable sibling sends no automatic inspection, independent of where the pointer rests?
- **Options:**
  - **A.** Move the pointer off the canvas, for example with `page.mouse.move(0, 0)`, right after the click on **Open Action** and before the events are read. Reproduce the flake first, and record the pass counts before and after. Effort: Small.
  - **B.** Keep the pointer, and filter out `hover` events whose frame is the navigation target `action` with no instance. This weakens the check that the target sends no hover. Effort: Small.
  - **C.** Activate **Open Action** with the keyboard after a focus, so no pointer rests over the frame. Effort: Small.
- **Left out:** A retry or a longer wait, because the `deterministic-tests` skill forbids both as a fix.
- **Wider fix:** A shared browser-test helper that ends each pointer action inside a frame by moving the pointer off the canvas. It is a structural fix for tests that read hover events after a click.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the pointer from the race and keeps every assertion.
- **Action:** fix after merge, apply A.
