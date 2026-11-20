# Settings close test can press Escape early

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the complete gate of `calummoore/fu-installed-module-watch-paths-3tbn`, based on `e7f1468abe4a31187fd1dc46741ef5449e1e2790`.
- **Location:** `apps/app/src/_tests_/settings/doors.spec.ts:37` and line 51, and `apps/app/src/_tests_/settings/in-app.ts:9`.
- **Reason:** The installed-module watch change edits no app source or settings test. This test failed once and passed its existing retry.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Settings dialog:** The Cloud app modal that holds Account, Workspace, and Project panes.
  - **Focus readiness:** The point when the dialog owns keyboard focus, which the adjacent Escape test checks before sending the key.
- **Background:** The Cloud app browser suite drives its exported web build against the real API. The test `Close returns to the page beneath from any address` checks click, Escape, and draft-discard exits. `openDialogInApp` opens the narrow settings page, selects a pane, then widens the viewport. It waits for the settings query and pane heading, but not for focus inside the dialog.
- **Problem:** The desktop test failed at the dialog-count assertion after its Escape press. The failure was `expect(locator).toHaveCount(expected) failed`, with `Locator: getByRole('dialog')`, `Expected: 0`, `Received: 1`, and `Timeout: 15000ms`. The first attempt took 17.2 seconds. The existing runner retry passed in 2.9 seconds. The suspected source is Escape arriving before dialog focus readiness. The neighboring `Escape closes a clean dialog and returns to the page beneath` test explicitly waits for its selected rail link to be focused.
- **Impact if no action:** A correct run can consume its retry or fail the app gate. The missing readiness wait can hide whether a settings exit has a product defect.
- **Root question:** How can the settings exit test send Escape only after the dialog owns the keyboard?
- **Options:**
  - **A.** Confirm the suspected race with repeated focused runs. Wait for the selected Account rail link to own focus before this test presses Escape. Keep every exit and address assertion. Effort: Small.
  - **B.** Confirm the suspected race with repeated focused runs. Make `openDialogInApp` wait for the selected pane's rail link to own focus. Keep every caller assertion and verify the existing settings tests. Effort: Small.
- **Left out:** Only the test and its shared readiness helper have evidence of a gap. No product handler defect is established. A longer timeout cannot recover a key already sent. Another retry hides the failure.
- **Wider fix:** B. The shared helper would give every settings test the same observable readiness boundary.
- **Previous examples:** The adjacent Escape test already waits for focus before sending its key, at `apps/app/src/_tests_/settings/doors.spec.ts:28`.
- **Recommendation:** B. One shared readiness boundary avoids another caller sending a key before the dialog owns it.
- **Action:** fix after merge, apply B, because this flaky app test is outside the installed-module watch change. Confirm the source before the fix. Keep every assertion and add no retry, sleep, skip, or longer time limit. Run the changed asynchronous tests ten times.
