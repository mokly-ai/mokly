# Settings Escape test presses before dialog focus

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the CI of pull request #572, branch
  `calummoore/flaky-mokly-server-overlap-sidecar-peak-mmlx`, which does not
  change `packages/app`.
- **Location:** `packages/app/src/_tests_/settings/doors.spec.ts:49` to line
  51, and `packages/app/src/_tests_/settings/in-app.ts:9` to line 32.
- **Reason:** The testing skill fixes an unrelated flaky test in its own
  branch, so that one fix reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Settings dialog:** the modal dialog of the Expo app that shows the
    settings panes. The address carries it in the `settings` query
    parameter.
  - **Page beneath:** the page under the dialog. Closing the dialog returns
    to it.
  - **`openDialogInApp`:** the browser-spec helper in `in-app.ts` that opens
    the dialog through the settings index, the way a reader does.
- **Background:**
  - The browser spec `Close returns to the page beneath from any address`
    in `doors.spec.ts` opens the Account pane with `openDialogInApp` three
    times. The second time, it presses Escape and expects the dialog to
    close.
  - `openDialogInApp` waits until the address has the `settings` parameter
    and the dialog heading shows the pane. It does not wait until the dialog
    has moved focus into itself.
  - The spec `Escape closes a clean dialog and returns to the page beneath`
    in the same file first waits until the pane link in the dialog has focus.
    Its comment says that the dialog takes the keyboard only once it has
    moved focus into itself, and that a key pressed before that reaches no
    dialog.
- **Problem:** In the CI run 45831868876, attempt 1, job `App checks 8/8`,
  2026-11-26, the spec failed at `doors.spec.ts:51:42`:
  `expect(locator).toHaveCount(expected) failed`, locator
  `getByRole('dialog')`, expected 0, received 1, timeout 15000 ms. The other
  57 specs of the job passed. The rerun of the failed job, attempt 2,
  passed with no code change. The suspected source is event order: the spec
  presses Escape after `openDialogInApp` returns but before the dialog has
  focus, so the key reaches no dialog. No trace confirms it yet.
- **Impact if no action:** the spec fails at random and stops the Required
  CI of any branch, also when the product code is correct.
- **Root question:** how does the spec know that the dialog takes the
  keyboard before it presses Escape?
- **Options:**
  - **A.** In `openDialogInApp`, wait until the focus is inside the dialog,
    as the Escape spec does, before the helper returns. First prove the
    race: delay the dialog's focus move in a local run, and see the spec
    fail at line 51. Keep every assertion. Effort: Small.
  - **B.** If the trace shows that the dialog has focus and still ignores
    Escape, treat it as a product bug: add a failing spec, then fix the
    dialog's key handling. Effort: Medium.
- **Left out:** a retry, a longer timeout, or a second Escape press. Each
  one hides a real defect in the dialog's key handling.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. It waits for the same readiness signal that the
  Escape spec already uses, and it keeps the spec's checks.
- **Action:** fix after merge, apply A, in a branch from `main`.
