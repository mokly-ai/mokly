# No mockup draws the switcher's capped list

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 13O of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/entries/product/viewer/switcher.mockup.tsx:36-89`, `docs/mockups/src/screens/product/viewer/switcher-screen.tsx:62-113`, `apps/app/src/viewer/panels/switcher.tsx:115-138` and `:230-254`, and `docs/mockups/src/_tests_/app-parity-allowances.ts:100-104`.
- **Reason:** The recommended drawing adds a new mockup page, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The app still shows the cap notice above the loaded rows and the cap sentence in a capped no-match card. No drawing covers either, and the allowance is still there.
- **Category:** Mockup.

- **Terms:**
  - **Parity suite:** The mockup tests in `docs/mockups/src/_tests_/app-parity.test.ts`, which compare the drawn labels and state titles with the app's.
  - **Allowance:** One entry in `docs/mockups/src/_tests_/app-parity-allowances.ts` that lets one known difference pass until a follow-up item removes it.
  - **Switcher:** The viewer panel that lists a project's branches and pull requests below a search field.
- **Background:** The list below gives the facts.
  - The switcher reads references page by page and stops at `referencePageLimit`.
  - A list that stopped early looks the same as a complete one.
  - So the running switcher shows a state titled "More branches and pull requests". Its sentence is "This list shows the first N branches and pull requests."
  - `apps/app/src/viewer/panels/switcher.tsx:115-138` writes the state. A capped no-match card at `:230-254` replaces its clearing advice with the cap sentence.
  - The return branch for a project with no branches shows no cap notice, because an uncapped empty list has none.
  - It sits directly under the search field and above the first reference row.
  - An earlier review measured it at the foot of a thousand rows, about 65,000 pixels below the field. There, a capped list still looked complete.
  - It offers no action. The search filters only the rows already read, and no control opens a reference by name.
  - An earlier review of the switcher work added the state. Then the parity suite reported that no mockup draws it.
- **Problem:** No mockup page draws the capped-read state. The product announces the state, and no reviewer sees it.
- **Impact if no action:** Nobody reviews the design of that state. The parity suite keeps one allowance for it in `allowedStates`.
- **Root question:** How does the catalogue show a switcher whose list stopped at its cap?
- **Options:**
  - **A.** Remove the cap, so that the state cannot occur. Then one switcher open reads every reference of a large repository. Effort: Medium.
  - **B.** Draw the capped-read state, then remove the allowance. Effort: Large.
    - Draw two states: the loaded list that stopped at its cap, and the capped no-match case. Draw each in both viewports and both color schemes.
    - Make both sibling screens of `product/viewer/switcher`. The entry already has four variants, and `docs/protocol/cloud/mockups.md:157` allows no fifth.
    - Put it directly under the search field and above the first reference row, with no action.
    - On the no-match page, do not add a second card. The read's own sentence replaces the body of the no-match card.
    - The reason is that "clear the search to see every branch" is false while the list is capped.
    - Remove the `allowedStates` entry for `viewer/panels/switcher.tsx`, title "More branches and pull requests", from `docs/mockups/src/_tests_/app-parity-allowances.ts:100-104`.
    - The suite fails with "the catalogue caught up; drop the allowlist line" until the entry goes.
- **Left out:** Keep the allowance without a drawing. The suite rule keeps an allowance only while an item removes it.
- **Wider fix:** None. The parity suite already finds this class.
- **Previous examples:** The viewer panel states of Milestone 12J have their own items, for example `plans/follow-ups/viewer-projects-without-workspaces-lacks-mockup.md`.
- **Related:** `plans/follow-ups/reference-search-stops-at-the-cap.md` would let the search reach references past the cap. If its server search removes the cap, these drawings are not needed. Check the order before you draw. Close this item on that ground only after the server search removes the capped state.
- **Recommendation:** B. The state exists in the product, so the catalogue must draw it.
- **Action:** ask the user, because condition 3 holds: the recommended option is Large, and no recorded user decision approves the drawing.

Checks for the work:

- Run `npm run mockups:build`, then `npm run mockups:check`, `npm run mockups:test` and `npm run mockups:typecheck`.
- Open every changed page from disk in both viewports and both schemes.

Source: [Milestone 13O](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L364-L390) of the deleted plan.
