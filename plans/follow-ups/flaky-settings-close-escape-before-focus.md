# Settings Close test presses Escape before focus

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431, closed without a merge), in two local `cloud-app` suite runs.
- **Location:** `packages/app/src/_tests_/settings/doors.spec.ts:37-60`, the test "Close returns to the page beneath from any address", and its Escape press at `:50`. `packages/app/src/_tests_/settings/in-app.ts:9-33`, `openDialogInApp`. `packages/app/src/_tests_/settings/doors.spec.ts:16-35`, the test that waits for focus first.
- **Reason:** The flaky test is in the Expo app tests, which the site branch that found it did not touch.

- **Terms:**
  - **Settings dialog:** the modal dialog of the Expo app under `packages/app` that holds the settings panes, such as Account. A `settings` query parameter in the address opens it.
  - **`openDialogInApp`:** the test helper in `packages/app/src/_tests_/settings/in-app.ts` that opens a settings pane through the app's own navigation, then waits for the address and the pane heading.
- **Background:** The `cloud-app` suite runs the Playwright tests of the Expo app. The test "Close returns to the page beneath from any address" opens the Account pane three times with `openDialogInApp`. It closes the dialog first with the Close control, then with the Escape key, then with Close and Discard. After each close, it expects no dialog and the project address.
- **Problem:** On 2026-11-20 the test failed at its first attempt and passed on its retry, in the `[desktop]` project of each of two local `cloud-app` runs. Both failures were at the Escape press:

  ```text
  Error: expect(locator).toHaveCount(expected) failed

  Locator:  getByRole('dialog')
  Expected: 0
  Received: 1
  Timeout:  15000ms
    at packages/app/src/_tests_/settings/doors.spec.ts:51:42
  ```

  Each run reported "1 flaky" and "420 passed". The first run came before the app moved from `apps/app` to `packages/app`, so its failure text named the old path. The suspected source is a missing readiness signal. `openDialogInApp` waits for the address and the heading of the pane, but not for the dialog to move focus into itself. The first test of the same file, "Escape closes a clean dialog and returns to the page beneath", waits with `toBeFocused()` on the pane link before it presses Escape. Its comment says that a key pressed before the dialog takes focus reaches no dialog. The failing test presses Escape without that wait, so the key can reach the page before the dialog listens.

- **Impact if no action:** The `cloud-app` suite of the gate fails now and then on a correct change. A Playwright retry hides it in CI, but a run without the retry fails, and the retry costs time.
- **Root question:** How does the test know that the settings dialog takes the keyboard before it presses Escape?
- **Options:**
  - **A.** Before the Escape press at `doors.spec.ts:50`, wait until the pane link of the dialog is focused, as the first test of the file does. It changes one test. Other tests that press a key after `openDialogInApp` keep the race. Effort: Small.
  - **B.** Make `openDialogInApp` wait until the dialog holds the focus, as its last step. Every caller then starts with a dialog that takes the keyboard. It changes one helper, and each caller gets the wait. Effort: Small.
  - **C.** Make the dialog take the keyboard as soon as it draws, so that no test or reader can press a key too early. It changes product code, and a reader could see a different focus order. Effort: Medium.
- **Left out:** A longer timeout or a retry. They fail the goal, because the key press itself is lost, and the testing rules forbid them for a flaky test.
- **Wider fix:** B. The helper is the one place that every in-app opening of the dialog uses, so the race cannot come back in a new caller.
- **Previous examples:** The first test of `packages/app/src/_tests_/settings/doors.spec.ts` already waits for the focus, with a comment on the same race.
- **Related:** Open PR #424 adds `plans/follow-ups/flaky-settings-close-escape-readiness.md` for the same flaky test. The pull request that merges second merges the two items.
- **Recommendation:** B. It removes the race for every caller of the helper with a small change. A protects only this test.
- **Action:** fix after merge, apply B, because the test is outside the scope of the site change that found it, and one fix in its own branch reaches every open branch.
