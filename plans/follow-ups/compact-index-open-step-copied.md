# Settings index open step has two copies

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch calummoore/click-on-row-ux-0nhj, review round 1
- **Location:** `packages/app/src/_tests_/settings-mobile.spec.ts:199-210`, `packages/app/src/_tests_/settings/in-app.ts:9-32` and `packages/app/src/_tests_/settings/gestures.spec.ts:211-218`.
- **Reason:** Both copies were on `origin/main` before the branch that found them, and `in-app.ts` is outside that branch's diff.
- **Category:** Test.

- **Terms:**
  - **Settings index:** the list of settings panes that settings shows below the breakpoint, and in the dialog when the `settings` value is empty. Each pane is a row link.
- **Background:**
  - A browser test reaches a pane from the settings index in one step. It presses the pane's row link, then waits for the pane's level-1 heading.
  - `openPane(page, pane)` in `settings-mobile.spec.ts:199-210` is that step.
  - `openDialogInApp(page, pane)` in `settings/in-app.ts:9-32` sets a 390px window and opens `/settings`. At lines 12-21 it does the same step, then widens the window to the dialog.
  - The two copies have the same code and the same comment. `gestures.spec.ts` and `doors.spec.ts` call `openDialogInApp`.
  - `gestures.spec.ts:211-218` does the step a third time in the dialog's index. It finds the row with `hasText`, not with the exact title.
  - `settings-mobile.spec.ts` has 268 lines. The repository gate caps a changed TypeScript file at 300 lines.
- **Problem:** The step to open a pane from the settings index has two copies and one near copy. A change to the row or to the pane heading needs the same change in each.
- **Impact if no action:** One copy can drift, and a test then presses a different target than its neighbours.
- **Root question:** Where does the step to open a pane from the settings index live once?
- **Options:**
  - **A.** Export the step as one helper, for example `openPaneFromIndex(page, pane)`, from `settings/in-app.ts`. Make `openDialogInApp`, the mobile spec and `gestures.spec.ts` call it, and delete `openPane`. Effort: Small.
  - **B.** Move the step to a new helper module under `packages/app/src/_tests_/settings/`, and import it in the three files. Effort: Small.
- **Left out:** Change nothing. The copies stay, so it fails the goal. Fewer than three approaches are real, because the choice is only where the one helper lives.
- **Wider fix:** None. No other copy of the step was found.
- **Previous examples:** None found.
- **Recommendation:** A. `in-app.ts` already holds the settings entry steps, and the mobile spec gets shorter.
- **Action:** fix after merge, apply A, because the copies were on `origin/main` and `in-app.ts` is outside the diff of the branch that found them.
