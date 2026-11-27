# Write-failure places start with their refusals seeded

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, the wider fix of review finding 6.
- **Location:** `packages/app/src/_tests_/write-failure-places.test.ts`, `packages/app/src/_tests_/write-failure-places.ts`, `packages/app/src/_tests_/write-failure-doubles.ts`.
- **Reason:** The direct fix of the finding covers the one uncovered path, the account switch of the desktop connect screen. Moving the other places to pressed refusals changes the whole test fixture.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Write-failure fragment:** the cause, the control as the way back, and the Details reference that a refused write draws, as `docs/protocol/cloud/folio-chrome.md` requires.
  - **Seeded refusal:** a write that the test starts in the refused state through the `failed` argument of `useWrite`, so that no press and no request happen.
- **Background:** `write-failure-places.test.ts` renders the Billing pane, the GitHub pane, the desktop connect screen, the CLI form, the build card, and the publish card in Node. `write-failure-doubles.ts` starts every write of each place with the same seeded refusal. The test then checks the fragment around each control. It checks the shape and the order of the fragment, and the label of each control. On 2026-11-26 a DOM test, `packages/app/src/_tests_/screens/account/connect-desktop-screen.test.ts`, started to press the desktop connect screen's controls and refuse only the pressed request.
- **Problem:** A seeded refusal never runs the code that catches a refused request and gives it to the control that sent it. For the other five places, a control that loses its refusal, or a refusal shown beside the wrong control, fails no Node test. Browser tests cover some of these places, for example `billing.spec.ts` "Upgrade to Team keeps its label when a subscription is already live".
- **Impact if no action:** A broken refusal path in one of those places can pass the Node tests that look like they cover it.
- **Root question:** How do the write-failure tests prove that each place reports a refused request beside the control that sent it?
- **Options:**
  - **A.** Keep the seeded test for the fragment's shape, and add one pressed case for each place with a browser cover gap, in the pattern of `connect-desktop-screen.test.ts`. Effort: Medium.
  - **B.** Move all places to one shared DOM fixture that presses one control and refuses only its request collaborator, and drop the seeded doubles. Effort: Large.
- **Left out:** Seeding a refusal for one write only, because it still sends no request and cannot show which operation made the refusal.
- **Wider fix:** B. Starting from rest and refusing only the pressed operation removes seeded state as evidence for the action's wiring.
- **Previous examples:** Review finding 6 of 2026-11-26 on the desktop connect screen, fixed in branch `calummoore/test-audit-app-and-cloud-rust-fl63`.
- **Recommendation:** A. It closes the real gaps place by place, with the harness that already exists.
- **Action:** fix after merge, apply A, because the direct fix covered the one path that no test caught, and the rest is wider test work.
