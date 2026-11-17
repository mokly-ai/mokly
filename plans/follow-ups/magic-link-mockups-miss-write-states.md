# Magic link mockups miss the write states

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 12K of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/entries/product/account/magic-link.mockup.tsx`, `docs/mockups/src/screens/product/account/magic-link-screen.tsx`, `docs/mockups/src/_tests_/app-parity-allowances.ts:41-52` and `docs/protocol/cloud/product-mockups-account.md:12`.
- **Reason:** The recommended drawing adds a new mockup page, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. All three differences remain, and the two allowances still cover the old refusal labels.
- **Category:** Mockup.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Allowance:** One entry in `docs/mockups/src/_tests_/app-parity-allowances.ts` that lets one known difference pass until a follow-up item removes it.
  - **`write-failure` fragment:** The registered catalogue fragment that reports a refused write beside the control that made it.
- **Background:** `product/account/magic-link` is the "Check your email" screen after a sign-in or sign-up email. The app screen is `apps/app/src/screens/account/magic-link-screen.tsx`. The app now reports a refused resend beside Resend link, through the `write-failure` fragment. The control itself is the way back. The screen keeps the address that the link went to. The mockup still draws the older composition.
- **Problem:** The mockup and the app disagree in three states.
  - The `error` variant draws a refused resend as a state body: "We couldn’t send your link" with "Request another link" beneath it. The app writes neither label.
  - The `loading` variant draws a body in place of the control. The app keeps the control, which reads "Sending…", with the pending line "Sending sign-in link" above it.
  - No variant draws the resent state. In the app, Resend link rests at "Link sent" after a link has gone.
  - `docs/protocol/cloud/product-mockups-account.md:12` gives the error recovery as "Link couldn't be sent; request another".
  - The refusal paragraph at `docs/protocol/cloud/product-mockups-account.md:25-44` does not cover the resend.
- **Impact if no action:** Reviewers see a refusal and a pending state that the product does not have. The parity suite keeps two allowances, so it does not report changes to these labels.
- **Root question:** How does the catalogue show the "Check your email" screen as the product draws it while a resend works, fails and succeeds?
- **Options:**
  - **A.** Change the app back to the drawn composition. It reverses the one-write-per-control rule that the other account screens follow. Effort: Medium.
  - **B.** Redraw the mockup states, then remove the two allowances. Effort: Large.
    - Redraw `error`. Keep the title, the address and Change email. Put the cause directly above Resend link. That control reads "Try again". Disclose the reference beneath it.
    - Redraw `loading`. Keep the control on screen, reading "Sending…", with the pending line above it.
    - Draw the resent state. Resend link rests at "Link sent", with nothing left to send.
    - Draw each state in both viewports and both color schemes.
    - Update the `product/account/magic-link` row and the refusal paragraph of `docs/protocol/cloud/product-mockups-account.md`.
    - Remove the two `allowed` entries for `product/account/magic-link` from `docs/mockups/src/_tests_/app-parity-allowances.ts:41-52`. Their labels are "We couldn’t send your link" and "Request another link".
    - The suite fails with "the application caught up; drop the allowlist line" until both entries go.
- **Left out:** Keep the allowances without a redraw. The suite rule keeps an allowance only while an item removes it.
- **Wider fix:** None. The parity suite already reports this class, and its owner rule keeps each allowance visible.
- **Previous examples:** The removed connect step had the same drawing gap. An earlier milestone, 12D, brought the rest of the account family up to the drawn states.
- **Recommendation:** B. The app follows the rule of the account family, so the drawing must follow the app.
- **Action:** ask the user, because condition 3 holds: the recommended option is Large, and no recorded user decision approves the drawing.

Checks for the work:

- Run `npm run mockups:build`, then `npm run mockups:check`, `npm run mockups:test` and `npm run mockups:typecheck`.
- Open every changed page from disk in both viewports and both schemes.

Source: [Milestone 12K](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L28-L66) of the deleted plan.
