# Settings Escape close flakes in CI

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, seen in the CI run of pull request 563 (branch `calummoore/preview-password-sign-in-jofl`), App checks partition 2 of 8.
- **Location:** `packages/app/src/_tests_/settings/doors.spec.ts:37-60`.
- **Reason:** The branch that saw the failure does not change the settings dialog or this spec.

- **Category:** Test.
- **Terms:**
  - **Settings dialog:** the app's account and workspace settings, opened over the current page; Close, Escape or a discarded draft returns to the page beneath.
- **Background:**
  - The test `Close returns to the page beneath from any address` opens the Account pane three times and closes it with the Close button, then with Escape, then with Close and Discard.
  - In CI on 2026-11-26 it failed at line 51, after `page.keyboard.press("Escape")`: `expect(page.getByRole("dialog")).toHaveCount(0)` received 1 for the whole 15-second timeout (34 polls). The App browser suite runs without retries since #544.
  - The same test passed 10 of 10 local runs right after, with `npx playwright test --config playwright.config.ts --tsconfig tsconfig.runtime.json src/_tests_/settings/doors.spec.ts -g "Close returns to the page beneath" --project desktop --repeat-each=10 --retries=0`.
  - Suspected source: the Escape press can arrive before the reopened dialog has taken focus or registered its key handler, so the press goes to the page beneath and the dialog stays open.
- **Problem:** The test fails now and then in CI with no defect in the product that it shows.
- **Impact if no action:** Pull requests fail CI at random and need a rerun.
- **Root question:** What explicit signal shows that the reopened dialog is ready for Escape?
- **Options:**
  - **A.** Before pressing Escape, wait for the dialog's documented initial focus target to be focused, as the other doors tests do with `toBeFocused()`, then press Escape. Effort: Small.
  - **B.** Have the dialog expose a ready marker after its key handler is attached, and wait for it. Effort: Small.
- **Left out:** A retry or a longer timeout, because they hide the race.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. It waits on the focus that Escape depends on, with no product change.
- **Action:** fix after merge, apply A, because the test is outside the change that saw it.
