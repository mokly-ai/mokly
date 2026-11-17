# Shared link loses its screen through sign-in

- **Severity:** Medium (estimate). **Likelihood:** Common. **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the signed-out return defect that Milestone 8 of the deleted `plans/mokly-dependencies-upgrade.md` recorded for a separate plan, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/app/app/sign-in.tsx:11-19`, `ts/app/app/sign-up.tsx:11-19`, `ts/app/app/auth/email.tsx:11-21`, `ts/app/src/screens/account/entry-screen.tsx:54-74` and `:101-105`, `ts/app/src/navigation/address.ts:84-107` and `ts/app/src/navigation/return-to.ts:92-104`.
- **Reason:** The pull request with the fix, PR #37, closed unmerged on 2026-10-30, and no recorded decision says whether its fix lands.
- **Checked:** 2026-10-31, at commit `f568853e`. Partly confirmed. The sign-in and sign-up switch link still drops `returnTo`. The automatic return defect is not verified. The entry routes read the live address, not a one-time copy.
- **Category:** Product bug.

- **Terms:**
  - **`returnTo`:** The validated destination that sign-in carries, so that the reader lands where they started after the email or GitHub step.
  - **Session guard:** The app code that sends a signed-out reader to Sign in with the current address as `returnTo`.
- **Background:** A signed-out reader opens a shared link to one screen of a publication. The session guard sends them to Sign in with the right `returnTo`. The dependency upgrade proof of 2026-10-09 found that the email request then sends `/dashboard`. The callback then opens onboarding, not the shared screen. The defect existed on `main` before that upgrade. The proof signed the reader in first, so it did not fix the defect.
- **Problem:** The list below separates the confirmed gap from the unverified defect.
  - The switch link between Sign in and Sign up at `entry-screen.tsx:101-105` uses `text.switchTo` without `returnTo`. A reader who follows it loses the shared destination. A code read shows this gap.
  - The source explained the 2026-10-09 result as a one-time address read. That explanation is wrong at commit `f568853e`.
  - Sign in, Sign up and the email resend route read the live address through `useAddressSearch` on each render. `useAddress` subscribes to history changes.
  - The email, resend and GitHub actions take `returnTo` through their current dependencies. Nobody reproduced the automatic return defect at this commit.
- **Impact if no action:** A reader who gets a shared screen without a session and follows the switch link loses the screen after sign-in. They must find it again by hand. The automatic return can lose it too, if the unverified defect is real.
- **Root question:** How does a signed-out reader land on the shared screen after sign-in?
- **Options:**
  - **A.** Reproduce the full chain at the current commit first: shared screen, Sign in, request body, sent page, callback and final screen. Cover email, resend and GitHub. If the automatic return works, narrow this item to the switch link. Do not delete the item, because the switch link gap stays. Effort: Small.
  - **B.** Give the switch link the shared destination, and add one regression test of the full chain. Fix each step that the test shows to lose the destination. The source's B asked the entry routes to read the live address, and they already do. Effort: Medium (estimate).
  - **C.** Re-land the closed PR #37 on today's `main`. It adds a live address store, account-entry links that keep the destination, a native fallback and their tests. Its earlier test results do not prove that today's code needs it. Effort: Large.
- **Left out:** Send every signed-in reader to `/dashboard`. It breaks the `returnTo` rule in `docs/protocol/product-navigation.md`.
- **Wider fix:** C. One address store gives every account-entry link the live destination.
- **Previous examples:** The readable addresses work fixed a related loss on 2026-09-23. Encoded query values then changed across authentication returns.
- **Related:** `plans/follow-ups/pr-39-doc-fixes-still-apply.md`, fix 11, wanted a sentence that names the owner of this defect. This item is now its owner.
- **Recommendation:** B (estimate). It fixes the confirmed switch link gap, and its full-chain test settles the unverified defect without the Large re-land. The source recommended C, because B then left the account-entry links without the destination. B now covers the switch link.
- **Action:** ask the user, because condition 4 holds: B and C have real trade-offs, and the user closed PR #37 without a recorded reason.

Facts for the work:

- The closed branch `calummoore/shared-link-sign-in-return` holds the fix at commit `7902db16`.
- It adds `ts/app/src/_tests_/shared-link-sign-in.spec.ts`, a real-API test of the request body, the sent-screen address, the callback result and the final screen.
- Its six browser regressions failed before the fix and passed after it. That result is history. Nobody repeated it at commit `f568853e`.

Source: [the status paragraph](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md?plain=1#L1-L12) and [Milestone 8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-dependencies-upgrade.md?plain=1#L1216-L1240) of the deleted plan.
