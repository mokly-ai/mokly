# GitHub return states lack mockups

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F5 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/screens/account/github-callback-screen.tsx:37-49` and `:80-107`, `apps/app/src/screens/account/github-install-screen.tsx:19-30` and `:164-165`, `docs/mockups/src/_tests_/product-situations.ts:42-103` and `docs/protocol/cloud/product-mockups-account.md:180-198`.
- **Reason:** The drawings are new mockup pages, which are Large, and they change the folder inventory that the protocol doc fixes.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still renders the eight states, and the callback inventory still holds the eleven drawn states.
- **Checked:** 2026-11-04, on the branch `calummoore/skeleton-sizing-mismatch`. The waits of the GitHub installation landings now have drawings, `product/account/callback/install-setup` and `callback/install-authorize`, so the callback inventory holds thirteen drawn states. The other GitHub return states still have no drawing, and the choice is still open.
- **Category:** Mockup.

- **Terms:**
  - **GitHub return:** The landing that a reader reaches when GitHub sends them back after sign-in or an installation.
- **Background:** PRs #69 and #77 drew three installation landings: `install-requested`, `install-conflict` and `install-denied`. The app draws more return states than the catalogue.
  - On the sign-in callback: "GitHub sign-in expired", "This GitHub account is connected to another Mokly account", "GitHub sign-in opens soon", "GitHub sign-in failed" and "Installation wasn’t completed".
  - On the install landing: "Completing installation", "Installation expired" and "GitHub installation opens soon".
  - The recovery table at `docs/protocol/cloud/auth-callbacks.md:179-189` is the current source of truth. Its destinations are `/sign-in`, `/settings/account` and `/install`.
  - `docs/protocol/cloud/product-mockups-account.md:186` and `:198` fix the callback folder at eleven states, and say that no state name is invented where the contract has none.
- **Problem:** Reviewers cannot see eight states that the GitHub returns show.
- **Impact if no action:** A wrong recovery or copy in those states reaches users without a drawn review.
- **Root question:** Which GitHub return states does the catalogue draw?
- **Options:**
  - **A.** Keep the eleven drawn states. Effort: Small.
  - **B.** Draw each missing state beside its landing, in both viewports and both color schemes. Add both landings to the onboarding flow after their originating screens. Update the folder inventory in `product-mockups-account.md`. Effort: Large.
- **Left out:** Draw states with invented names. The protocol doc forbids names that the contract does not have.
- **Wider fix:** None. The parity suite does not compare these titles today.
- **Previous examples:** The three installation landings that PRs #69 and #77 drew.
- **Recommendation:** B. Each return state is a screen that readers see.
- **Action:** ask the user, because condition 3 holds: B adds new mockup pages, which are Large.

The source used retired `/app/...` paths. The recovery table above gives the current destinations.

Source: [Milestone F5](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1052-L1093) of the deleted plan.
