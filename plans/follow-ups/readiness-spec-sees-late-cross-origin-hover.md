# Readiness spec sees a late cross-origin hover

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the complete gate of branch
  `calummoore/e2b-build-enabling-vbbo`, which changes no file under
  `packages/` or `tests/`.
- **Location:** `tests/browser/viewer_readiness.spec.ts:60` to line 90.
- **Reason:** The testing skill fixes an unrelated flaky test in its own
  branch, so that one fix reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **postMessage mode:** the viewer and the catalogue frame run on different
    origins and talk through `postMessage`. The spec runs each case once in
    this mode and once in same-origin mode.
  - **Sibling:** the desktop view of the `home` screen. The spec sets its
    usage to `pending` or `unavailable`, so the viewer must not start
    automatic inspection in it.
  - **Hover event:** an event that the viewer harness records when the viewer
    reports a hovered element.
- **Background:**
  - Each case hovers and clicks the `Visible` button in the sibling frame,
    then clicks `Open Action`. It waits for one `navigate` event to the
    `action` screen. Then, at line 90, it asserts that the harness recorded no
    `error`, `hover`, or `click` event.
  - The failing runs recorded one extra event:
    `{ name: "hover", value: { boxes: [], frame: { entryPath: "action" }, instance: null } }`.
    The hover names the `action` frame, the screen that the click opened, not
    the sibling.
- **Problem:**
  - On 2026-11-24, one complete gate run failed both postMessage cases,
    `postMessage pending sibling keeps navigation without automatic inspection`
    and `postMessage unavailable sibling keeps navigation without automatic inspection`.
    The earlier complete gate run passed all browser tests.
  - Then `npx playwright test tests/browser/viewer_readiness.spec.ts --repeat-each=10 --workers=1`
    failed 6 of 40 runs, all in the two postMessage cases, with the same extra
    event. The same-origin cases passed every run.
  - Suspected source: the pointer stays where the last click was. When the
    `action` frame loads under it, that frame reports a hover through
    `postMessage`. The assertion at line 90 runs once, right after the
    `navigate` event, so it passes only when it reads the events before that
    late message arrives. No trace confirms this yet.
- **Impact if no action:** the browser suite fails at random and stops the
  complete gate of any branch, also when the product code is correct.
- **Root question:** is a hover report from the newly opened frame, with no
  instance, correct product behaviour after a navigation?
- **Options:**
  - **A.** If the report is correct, wait in the test for the `action` frame
    to settle before the check. For example, move the pointer to a fixed
    place outside the frames before `Open Action`, and keep the assertion
    unchanged. First prove the source: delay the hover message in a scratch
    copy and see the test fail every run. Effort: Small.
  - **B.** If the report is wrong, stop the viewer from reporting a hover
    with no instance after a navigation, and keep the test unchanged. Effort:
    Medium.
- **Left out:** filtering `hover` out of the assertion or retrying the test.
  Both hide a real automatic inspection in the sibling.
- **Wider fix:** None.
- **Previous examples:**
  [flaky-serve-comparison-edit-readiness.md](./flaky-serve-comparison-edit-readiness.md)
  records another browser readiness flake.
- **Recommendation:** A, after the proof. The hover names the new screen, not
  the sibling, so the test's intent is still met.
- **Action:** fix after merge, in a branch from `main`. Confirm the source
  first, then choose A or B.
