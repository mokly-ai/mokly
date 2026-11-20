# The bounded billing wait does not end while a read is pending

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from finding 5 of the round 3 review of `calummoore/stripe-loading-outside-app-mrlb`.
- **Location:** `apps/app/src/settings/panes/billing-watch.ts` (`readUntilTeam` and the focus lock in `useFocusReads`).
- **Reason:** The review found it after the second fix round, so the fix rule gives it `fix after merge`.
- **Category:** Product bug.

- **Background:** After Checkout, the pane reads billing every 2 seconds for up to 30 seconds (`docs/protocol/cloud/billing-subscriptions.md`, "Checkout and Portal"). In the desktop app's window, focus does nothing while that wait runs.
- **Problem:** `readUntilTeam` checks its deadline only after a read answers, and the API client has no request time limit. A read that never answers keeps the wait running, so later window focus starts no read.
- **Impact if no action:** A stalled request can keep the old plan on screen past the 30 seconds that the rule gives.
- **Root question:** How does the wait end at 30 seconds when a read is still pending?
- **Options:**
  - **A.** Give the focus wait its own timer that frees the focus lock at the limit and ignores later answers. Effort: Small.
  - **B.** Let `readUntilTeam` hold one deadline for the whole run, end the pending read and the pause at it, and drop late answers. Test it with a read that never answers. Effort: Small.
  - **C.** Add a bounded wait to `useResource` and move the billing wait onto it. Effort: Medium.
- **Left out:** A clock check after each answer cannot end a read that does not answer. A time limit for each request does not bound the whole run.
- **Wider fix:** B. Both callers, the Checkout return and the focus wait, get a real limit.
- **Previous examples:** The Checkout return loop on `origin/main` had the same check after each answer.
- **Recommendation:** B.
- **Action:** Fix after merge, apply B.
