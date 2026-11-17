# No mockup draws a project that cannot load

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 12J of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/entries/product/viewer/standalone/`, `docs/mockups/src/screens/product/viewer/stage.tsx`, `apps/app/src/viewer/stage-view.tsx:178-191`, `apps/app/src/screens/app/project-route.tsx:83-103` and `docs/mockups/src/_tests_/app-parity-allowances.ts:95-99`.
- **Reason:** The recommended drawing adds a new mockup page, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The stage still renders "This project couldn’t load" for an entry error, no drawing covers it, and the allowance is still there.
- **Category:** Mockup.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Allowance:** One entry in `docs/mockups/src/_tests_/app-parity-allowances.ts` that lets one known difference pass until a follow-up item removes it.
  - **Stage:** The main area of the viewer, where the published catalogue or a state card shows.
- **Background:** The viewer stage resolves the address to a publication. Sometimes the address names no publication and the entry cannot resolve. The project is known, but a read of its history or its reference rows fails. Then the running stage shows an error titled "This project couldn’t load", with a retry. `apps/app/src/viewer/stage-view.tsx:178-191` writes it. When the address names a publication, the title is "This publication couldn’t load". Every viewer mockup page draws a resolved project. Earlier parity corrections, Milestone 12E round 2, found the gap.
- **Problem:** No mockup page draws the stage when its entry fails to resolve. The product announces the state, and no reviewer sees it.
- **Impact if no action:** Nobody reviews the design of that state. The parity suite keeps one allowance for it in `allowedStates`.
- **Root question:** How does the catalogue show the stage when its entry fails to resolve and the address names no publication?
- **Options:**
  - **A.** Show the publication error for this case too, so that one drawn title covers both. It changes what the product says when the address names no publication. Effort: Small.
  - **B.** Draw the unresolved stage, then remove the allowance. Effort: Large.
    - Draw the error "This project couldn’t load" and its retry as a new page under `product/viewer/standalone`, in both viewports and both color schemes.
    - Remove the `allowedStates` entry for `viewer/stage-view.tsx`, title "This project couldn’t load", from `docs/mockups/src/_tests_/app-parity-allowances.ts:95-99`. Remove only that stage entry.
    - The suite fails with "the catalogue caught up; drop the allowlist line" until the entry goes.
- **Left out:** Keep the allowance without a drawing. The suite rule keeps an allowance only while an item removes it.
- **Wider fix:** None. The parity suite already finds this class.
- **Previous examples:** Other states of the same milestone have their own items. They are `plans/follow-ups/viewer-projects-without-workspaces-lacks-mockup.md`, `plans/follow-ups/share-screen-load-failure-lacks-mockup.md` and `plans/follow-ups/switcher-failed-attempt-over-ready-lacks-mockup.md`.
- **Related:** `apps/app/src/screens/app/project-route.tsx:83-103` writes the same title in an account shell when the project lookup fails. That is a different composition, so a stage drawing does not cover it. Decide whether the account-shell error is in the scope of this drawing.
- **Recommendation:** B. The state exists in the product, so the catalogue must draw it.
- **Action:** ask the user, because condition 3 holds: the recommended option is Large, and no recorded user decision approves the drawing.

Checks for the work:

- Run `npm run mockups:build`, then `npm run mockups:check`, `npm run mockups:test` and `npm run mockups:typecheck`.
- Open every changed page from disk in both viewports and both schemes.

Source: [Milestone 12J](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L271-L312) of the deleted plan.
