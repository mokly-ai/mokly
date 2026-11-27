# Settings Close test flakes at its Escape press

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431, closed without a merge), in two local `cloud-app` suite runs.
- **Location:** `packages/app/src/_tests_/settings/doors.spec.ts:37-60`, the test "Close returns to the page beneath from any address", and its Escape press at `:50`. `packages/app/src/_tests_/settings/in-app.ts:9-32`, `openDialogInApp`. `packages/app/src/_tests_/settings/doors.spec.ts:16-35`, the test that waits for focus first. `packages/app/playwright.config.ts:43`, `retries: 1`.
- **Reason:** The flaky test is in the Expo app tests, which the site branch that found it did not touch, and its cause needs a reproduction.

- **Terms:**
  - **Settings dialog:** the modal dialog of the Expo app under `packages/app` that holds the settings panes, such as Account. A `settings` query parameter in the address opens it.
  - **`openDialogInApp`:** the test helper in `packages/app/src/_tests_/settings/in-app.ts` that opens a settings pane through the app's own navigation, then waits for the address and the pane heading.
  - **Escape layer:** an entry of the shared Escape stack of `@firna/ui`. One `keydown` listener on `document` gives Escape to the newest layer. Modals, dropdowns, popovers, and comboboxes each push a layer while they are open.
- **Background:** The `cloud-app` suite runs the Playwright tests of the Expo app. The test "Close returns to the page beneath from any address" opens the Account pane three times with `openDialogInApp`. It closes the dialog first with the Close control, then with the Escape key, then with Close and Discard. After each close, it expects no dialog and the project address.
- **Problem:** On 2026-11-20 the test failed at its first attempt and passed on its retry, in the `[desktop]` project of each of two local `cloud-app` runs. Both runs were `cargo xtask check` runs that exited 0, because `packages/app/playwright.config.ts` sets one retry for local runs and CI alike. Both failures were at the Escape press:

  ```text
  Error: expect(locator).toHaveCount(expected) failed

  Locator:  getByRole('dialog')
  Expected: 0
  Received: 1
  Timeout:  15000ms
    at packages/app/src/_tests_/settings/doors.spec.ts:51:42
  ```

  Each run reported "1 flaky" and "420 passed". The first run came before the app moved from `apps/app` to `packages/app`, so its failure text named the old path. The cause is not known. The page snapshot of each failure, taken when the 15-second wait ended, shows these facts:
  - The `Account` link inside the dialog is the active element.
  - The account control in the top bar is marked expanded, although no step of the test presses it. An open account menu pushes its own Escape layer, which takes Escape before the dialog's layer. Escape closes the menu and returns focus to the avatar, as `packages/app/src/viewer/account-menu.tsx` says.

  Two causes are suspected. No run confirms either:
  - The press came before the dialog pushed its Escape layer. `openDialogInApp` waits for the address and the pane heading, not for the dialog's readiness. The first test of the same file waits for the pane link to take focus before it presses Escape, and its comment says that a key pressed earlier reaches no dialog. The dialog moves focus and pushes its layer in the same effect pass, so a focus wait shows at most that the layer exists.
  - The open account menu took the Escape press, and the dialog stayed open. Escape would have closed that menu, and the snapshots still show it expanded 15 seconds later, so this cause holds only if the menu opened again after the press, or if its control kept a stale expanded state.

- **Impact if no action:** The `cloud-app` suite needs its retry for this test, which hides a real Escape defect if one exists and costs about 15 seconds each time. A run without the retry fails.
- **Root question:** Why does the Escape press sometimes leave the settings dialog open, and what state must the test wait for before it presses Escape?
- **Options:**
  - **A.** Before the Escape press at `doors.spec.ts:50`, wait until the pane link of the dialog is focused, as the first test of the file does. It fixes this test only if the first suspected cause holds. Effort: Small.
  - **B.** Make `openDialogInApp` wait for the dialog's readiness as its last step, so that each caller gets the wait. It fixes the class only if the first suspected cause holds. Effort: Small.
  - **C.** Reproduce first. Run the test with `--repeat-each`, `--retries 0`, and a trace, and record the pass counts. At the Escape press of a failure, record the focused element, the state of the account menu, and the Escape layers. Then apply A or B, or D, from the evidence, and record the pass counts after the fix. Effort: Medium.
  - **D.** When the trace shows the open account menu, find what opens it under the dialog, in `packages/app/src/viewer/menus.ts` or in the test steps, and fix that cause. Effort: Medium.
  - **E.** When the trace confirms the first cause, make the dialog take the keyboard as soon as it draws, so that no test or reader can press a key too early. `@firna/ui` 4.0.0 pushes the modal's Escape layer in an effect that runs after the render that shows the dialog, so the fix lives in the dialog of `@firna/ui` or of the app. It changes product code, and a reader could see a different focus order. Effort: Medium.
- **Left out:** A longer timeout or more retries. They fail the goal, because the key press itself is lost or taken, and the testing rules forbid them for a flaky test.
- **Wider fix:** E, when the first suspected cause holds, because no caller can then press a key too early. D, when the second holds.
- **Previous examples:** The first test of `packages/app/src/_tests_/settings/doors.spec.ts` already waits for the focus, with a comment on the same race.
- **Related:** Open PR #424 adds `plans/follow-ups/flaky-settings-close-escape-readiness.md` for the same flaky test. The pull request that merges second merges the two items.
- **Recommendation:** C. The testing rules ask for a reproduction with pass counts before a fix, and only the trace can tell the two suspected causes apart. `plans/follow-ups/flaky-settings-surface-address.md` and `plans/follow-ups/settings-draft-rotation-test-flakes.md` record other settings flakes, but no run links them to this one: `openDialogInApp` already waits for the address step at which those flakes fail.
- **Action:** fix after merge, apply C, because the test is outside the scope of the change that found it, and one fix in its own branch reaches every open branch.
