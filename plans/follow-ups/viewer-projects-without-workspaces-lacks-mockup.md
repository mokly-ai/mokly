# No mockup draws a reader without workspaces

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 12J of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/entries/product/viewer/projects.mockup.tsx`, `docs/mockups/src/screens/product/viewer/projects-screen.tsx`, `apps/app/src/viewer/panels/projects.tsx:122-141` and `docs/mockups/src/_tests_/app-parity-allowances.ts:85-89`.
- **Reason:** The recommended drawing adds a new mockup page, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still renders "No workspaces yet", and the `empty` drawing still shows a workspace without projects. The allowance is still there.
- **Category:** Mockup.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Allowance:** One entry in `docs/mockups/src/_tests_/app-parity-allowances.ts` that lets one known difference pass until a follow-up item removes it.
  - **Projects panel:** The viewer panel that lists the reader's workspaces and their projects.
- **Background:** The running projects panel says "No workspaces yet" when the reader belongs to no workspace. `apps/app/src/viewer/panels/projects.tsx:133` writes that title. The mockup `product/viewer/projects` has the variants `empty`, `loading` and `error`. Its `empty` variant draws a workspace without projects, not a reader without a workspace. Earlier parity work, Milestone 12E, found the gap.
- **Problem:** No mockup page draws the panel's own empty state. The product announces the state, and no reviewer sees it.
- **Impact if no action:** Nobody reviews the design of that state. The parity suite keeps one allowance for it in `allowedStates`.
- **Root question:** How does the catalogue show the projects panel for a reader who belongs to no workspace?
- **Options:**
  - **A.** Remove the state from the app, for example by sending such a reader to `/new`. It changes product behaviour that no requirement asks to change. Effort: Medium.
  - **B.** Draw the panel with no workspace at all, then remove the allowance. Effort: Large.
    - Add the state as a new variant of `product/viewer/projects`, in both viewports and both color schemes. The entry has three variants, so a fourth fits the limit of `docs/protocol/cloud/mockups.md:157`.
    - Remove the `allowedStates` entry for `viewer/panels/projects.tsx`, title "No workspaces yet", from `docs/mockups/src/_tests_/app-parity-allowances.ts:85-89`.
    - The suite fails with "the catalogue caught up; drop the allowlist line" until the entry goes.
- **Left out:** Keep the allowance without a drawing. The suite rule keeps an allowance only while an item removes it.
- **Wider fix:** None. The parity suite already finds this class.
- **Previous examples:** Other states of the same milestone have their own items. They are `plans/follow-ups/share-screen-load-failure-lacks-mockup.md`, `plans/follow-ups/viewer-unresolved-project-lacks-mockup.md` and `plans/follow-ups/switcher-failed-attempt-over-ready-lacks-mockup.md`.
- **Recommendation:** B. The state exists in the product, so the catalogue must draw it.
- **Action:** ask the user, because condition 3 holds: the recommended option is Large, and no recorded user decision approves the drawing.

Checks for the work:

- Run `npm run mockups:build`, then `npm run mockups:check`, `npm run mockups:test` and `npm run mockups:typecheck`.
- Open every changed page from disk in both viewports and both schemes.

Source: [Milestone 12J](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L271-L312) of the deleted plan.
