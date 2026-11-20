# An older read can replace a value that `set` stored

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from finding 4 of the round 3 review of `calummoore/stripe-loading-outside-app-mrlb`.
- **Location:** `packages/app/src/data/use-resource.ts` (`set`, and the read's `then`), used by `packages/app/src/settings/panes/billing-watch.ts` and `billing-pane.tsx`.
- **Reason:** The review found it after the second fix round, so the fix rule gives it `fix after merge`. The fix reaches the shared resource hook.
- **Category:** Product bug.

- **Terms:**
  - **`useResource`:** The app hook that loads one thing for a screen and also takes values from the screen through `set`.
  - **Request sequence:** `createRequestSequence`, which makes an older answer unable to change state.
- **Background:** The Billing pane reads the plan through `useResource`. The bounded wait after Checkout and Check again read billing themselves and store each answer with `set`.
- **Problem:** `set` does not end a read that the resource already started. When an ordinary read starts, then the wait stores Team, and then the ordinary read answers Free, the pane shows Free.
- **Impact if no action:** After a confirmed payment, the pane can show Free and **Upgrade to Team** again until the next read.
- **Root question:** How does the pane keep an older answer from replacing a newer value?
- **Options:**
  - **A.** Turn off the Billing pane's ordinary read while the wait runs. Effort: Small.
  - **B.** Give `useResource` one request sequence for its reads and for `set`, so that `set` makes every pending older read stale. Add the regression through the real hooks. Effort: Small.
  - **C.** Move every billing read into one billing owner. Effort: Medium.
- **Left out:** Keeping both writers as they are keeps the bug. Waiting for the older read before the wait starts can hold the refresh back without a limit.
- **Wider fix:** B. Every screen that stores a value with `set` gets the same protection.
- **Previous examples:** PR #377 fixed the same answer order for session reads with the request sequence (`packages/app/src/session/read-owner.ts`).
- **Recommendation:** B.
- **Action:** Fix after merge, apply B.
