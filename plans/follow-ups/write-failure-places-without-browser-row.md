# Six write-failure places have no browser row

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #567), test-scope item 13B.
- **Location:** `packages/app/src/settings/panes/billing-pane.tsx`, `packages/app/src/settings/panes/github-pane.tsx`, `packages/app/src/screens/account/connect-desktop-screen.tsx`, `packages/app/src/screens/account/cli-form-screen.tsx`, `packages/app/src/viewer/build-card.tsx`, `packages/app/src/viewer/publish-card.tsx`, `packages/app/src/_tests_/settings/refusals.ts`.
- **Reason:** The test-scope change only removed rows, and these places never had a row, so adding tests is new work.

- **Terms:**
  - **Refusal walk:** the test in `packages/app/src/_tests_/settings/writes.spec.ts` that makes each control's write be refused and checks the failure message beside the control. `refusals.ts` holds its rows.
- **Background:** The write-failure rule in `docs/protocol/cloud/folio-chrome.md` puts the cause above the control that made the write. The test-scope change of 2026-11-26 kept one refusal-walk row for each place that shows the message.
- **Problem:** Six places draw the failure message but never had a refusal-walk row: the Billing pane, the GitHub pane, the desktop connect screen, the CLI form screen, the build card, and the publish card. Nobody checked whether a logic test or another browser test checks the message there.
- **Impact if no action:** A broken failure message in one of these places can reach users without a failing test.
- **Root question:** Does each place that draws the write-failure message have a test of it?
- **Options:**
  - **A.** Search the tests for each place, and record the test that checks its message. Add nothing where one exists. Effort: Small.
  - **B.** Do A, then add a refusal-walk row or a logic test for each place without one. Effort: Medium.
- **Left out:** Change nothing without a search, because the gap is not confirmed.
- **Wider fix:** B. A row for each place keeps the rule of one row per place complete.
- **Previous examples:** None found.
- **Recommendation:** B. Each place is separate code that draws the message.
- **Action:** fix after merge, apply B, because it adds tests outside the scope of the test-scope change.
