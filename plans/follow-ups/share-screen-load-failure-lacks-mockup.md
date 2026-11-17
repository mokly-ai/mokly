# No mockup draws the Share screen list failing

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 12J of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/entries/product/viewer/share.mockup.tsx:34-82`, `docs/mockups/src/screens/product/viewer/share-screen.tsx:92-158`, `apps/app/src/viewer/panels/share.tsx:43-47` and `:250-271`, and `docs/mockups/src/_tests_/app-parity-allowances.ts:90-94`.
- **Reason:** The recommended drawing adds a new mockup page, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still shows the screen list failure beside the link, and no drawing covers it. The allowance is still there.
- **Category:** Mockup.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Allowance:** One entry in `docs/mockups/src/_tests_/app-parity-allowances.ts` that lets one known difference pass until a follow-up item removes it.
  - **Share panel:** The viewer panel that makes a link to the publication or to one of its screens.
- **Background:** The Share panel reads the list of screens with its own read, beside the read of the link. So the screen list can fail on its own. Then the running panel shows "Screens couldn’t load" and one Try again in place of the screen choice. The link above it stays. `apps/app/src/viewer/panels/share.tsx:43-47` writes that failure. The mockup `product/viewer/share` has the variants `empty`, `loading`, `error` and `catalogue`. `docs/protocol/cloud/mockups.md:144` allows at most four variants for a screen, so the entry is full. Earlier parity work, Milestone 12E, found the gap.
- **Problem:** No mockup page draws the screen list failing while the link stays. The product announces the state, and no reviewer sees it.
- **Impact if no action:** Nobody reviews the design of that state. The parity suite keeps one allowance for it in `allowedStates`.
- **Root question:** How does the catalogue show the Share panel when only its screen list fails to load?
- **Options:**
  - **A.** Make the whole panel fail when the screen list fails. It removes a recovery that the product has today. Effort: Small.
  - **B.** Draw the screen list failure, then remove the allowance. Effort: Large.
    - Draw the link in place and "Screens couldn’t load" with one Try again in place of the screen choice.
    - Add the state as a sibling screen in the Share folder, in both viewports and both color schemes. A fifth variant of `product/viewer/share` breaks the four-variant limit. A restructure of the Share inventory needs its own approval.
    - Keep the link visible, as `docs/protocol/cloud/viewer-chrome.md:86-89` requires.
    - Remove the `allowedStates` entry for `viewer/panels/share.tsx`, title "Screens couldn’t load", from `docs/mockups/src/_tests_/app-parity-allowances.ts:90-94`.
    - The suite fails with "the catalogue caught up; drop the allowlist line" until the entry goes.
- **Left out:** Keep the allowance without a drawing. The suite rule keeps an allowance only while an item removes it.
- **Wider fix:** None. The parity suite already finds this class.
- **Previous examples:** Other states of the same milestone have their own items. They are `plans/follow-ups/viewer-projects-without-workspaces-lacks-mockup.md`, `plans/follow-ups/viewer-unresolved-project-lacks-mockup.md` and `plans/follow-ups/switcher-failed-attempt-over-ready-lacks-mockup.md`.
- **Related:** `plans/follow-ups/share-empty-state-shows-only-while-loading.md` changes the same panel. Draw this state after its fix, or with it. Commit [`54eadb3c`](https://github.com/mokly-ai/mokly-cloud/commit/54eadb3cb693b8e57124322f6148efe73e37e644), from PR #124 merged on 2026-11-04, already fixed the link that the same panel offered while loading.
- **Recommendation:** B. The state exists in the product, so the catalogue must draw it.
- **Action:** ask the user, because condition 3 holds: the recommended option is Large, and no recorded user decision approves the drawing.

Checks for the work:

- Run `npm run mockups:build`, then `npm run mockups:check`, `npm run mockups:test` and `npm run mockups:typecheck`.
- Open every changed page from disk in both viewports and both schemes.

Source: [Milestone 12J](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L271-L312) of the deleted plan.
