# A write's done step runs after its screen is gone

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the check of finding 42 of the round 1 review of `calummoore/skeleton-sizing-mismatch`.
- **Location:** `packages/app/src/settings/write.ts:215` (`run` calls `done`), with callers such as `packages/app/src/screens/account/entry-screen.tsx:146` and `create-workspace-screen.tsx:128`.
- **Reason:** The same call exists on `origin/main`, so the fix belongs to a separate branch.
- **Category:** Product bug.

- **Background:** A write's `done` step runs after a successful answer; many forms use it to open the next screen.
- **Problem:** `run` calls `done` even when the screen that started the write has unmounted, so a late answer to Continue with email or Create workspace moves a reader who already left.
- **Impact if no action:** A slow answer takes a reader away from the screen that they chose.
- **Root question:** Does a write's next step run when its screen is gone?
- **Options:**
  - **A.** Run `done` only while the screen is mounted, as `leave` does for writes that leave the page. Effort: Small.
- **Left out:** Cancel every request on unmount. The write's effect on the server still happens, and the reader may need it.
- **Wider fix:** A. It covers every write in one place.
- **Previous examples:** `packages/app/src/navigation/leave-page.ts`.
- **Related:** `plans/follow-ups/password-sign-in-redirects-after-leaving.md`, same class: a late password answer moves a reader who left Sign in. Its options B and D also stop a late `done` from moving the reader. `plans/follow-ups/build-request-opens-after-leaving.md` and `plans/follow-ups/desktop-stripe-opens-after-leaving.md` are the same class for a build request and a Stripe answer.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the call is outside the change that found it.
