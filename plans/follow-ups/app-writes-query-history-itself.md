# The app writes query history itself

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 13G of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/navigation/address.ts:3-21`, `apps/app/src/navigation/address.ts:54-75`, `apps/app/src/navigation/address.ts:141-150`, `apps/app/src/_tests_/settings/gestures.spec.ts`, `apps/app/src/_tests_/settings-mobile.spec.ts` and `docs/protocol/cloud/web-product-shell.md:68-84`.
- **Reason:** The work starts with an evaluation whose outcome is a choice between two designs.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still writes query-only changes with `pushState` and `replaceState`, and `address.ts` documents why. No user-visible defect is known.
- **Category:** Code structure.

- **Terms:**
  - **Depth contract:** The rule that the history stack holds one entry per overlay that the reader opened, undone rather than written over.
- **Background:** The app wraps `history.pushState` and `replaceState` and writes query-only changes itself. So the history stack is exactly as deep as the reader's own steps, and the address is a value that a component holds. `gestures.spec.ts` and `settings-mobile.spec.ts` assert that depth. The history table of `docs/protocol/cloud/web-product-shell.md:68-84` gives the depth contract. It does not say which code writes the entries. An earlier milestone, 13D, deleted the reserved-key withholding. `web-app.md` had said that all three of its mechanisms would go with it, but these two stayed, because neither is about the reserved word. Expo Router offers `router.back()` and `router.setParams()`.
- **Problem:** Nobody has evaluated whether the router can carry the depth contract. The module comment at `apps/app/src/navigation/address.ts:3-21` gives the reason for the app's own writes. No current user-visible defect is known.
- **Impact if no action:** Two writers of the address stay, and a later router upgrade can break the depth contract without warning.
- **Root question:** Who writes query-only address changes: the router or the app?
- **Options:**
  - **A.** Evaluate, then keep the two writes. Add the outcome to the module comment of `address.ts`, which already holds the reason. A protocol doc states the observable history rules, not the writer. Effort: Small.
  - **B.** Evaluate, then move the writes to `router.back()` and `router.setParams()`, with the depth assertions unchanged. Effort: Medium.
- **Left out:** Move the writes without the evaluation. The depth tests then decide by failure.
- **Wider fix:** B, if the router can carry the contract. One writer removes the class.
- **Previous examples:** None found.
- **Recommendation:** B, if the evaluation shows that the depth assertions pass unchanged. Otherwise A.
- **Action:** ask the user, because condition 4 holds: the evaluation decides between two designs with real trade-offs.

The same milestone asked to settle why `screen` is a key the app drops. `docs/protocol/cloud/viewer-address-state.md:116-118` now states it: React Navigation reserves `screen`. That part is done.

Source: [Milestone 13G](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L461-L496) of the deleted plan.
