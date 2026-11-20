# No test drives the Billing pane's read again on window focus

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from finding 3 of the round 2 review of `calummoore/stripe-loading-outside-app-mrlb`.
- **Location:** `apps/app/src/settings/panes/billing-pane.tsx` (`useShellFocus(reload)`) and `apps/app/src/_tests_/settings/billing-reconcile.test.ts`.
- **Reason:** The review found it after the last fix round, so the fix rule gives it `fix after merge`.
- **Category:** Test.

- **Background:** In the desktop app's window, Stripe opens in the system browser. The Billing pane reads the plan again when the window gets focus, and a Team read refreshes the workspace and project reads (`docs/protocol/cloud/desktop-app.md` "Billing").
- **Problem:** `billing-reconcile.test.ts` hands a Team read to the reconcile hook directly. No test mounts the real pane and sends a window focus, so removing `useShellFocus(reload)` fails no test.
- **Impact if no action:** A later change can stop the desktop refresh after payment without a failing test.
- **Root question:** How does a test prove that returning to the window refreshes billing and the reads that depend on it?
- **Options:**
  - **A.** Mount the real Billing pane in a client-render logic test with the real resource and invalidation hooks, controlled HTTP answers and a shell page. Send a focus event and assert the new billing read and the invalidations. Effort: Small.
  - **B.** Add a browser probe of the real pane, as `apps/app/src/_tests_/session/focus.spec.ts` does for the session. Effort: Medium.
  - **C.** Add a payment and a window focus to the Electron smoke. Effort: Medium.
- **Left out:** A test of the focus helper alone repeats existing coverage. A source-text assertion does not check behaviour.
- **Wider fix:** None. The `testing` skill already asks for a test through the real entry point.
- **Previous examples:** PR #377 added the session focus probe after a focus-refresh defect.
- **Recommendation:** A.
- **Action:** Fix after merge, apply A, because the review found it after the last fix round.
