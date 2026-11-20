# Reference search stops at the loaded rows

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestones 13J and 13P of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/app/src/viewer/panels/switcher.tsx:30`, `:96-138` and `:230-254`, `packages/app/src/data/publications.ts:44-52`, `:86-96` and `:98-133`, `docs/protocol/cloud/viewer-read-model.md:59-100` and `docs/api/openapi.json`.
- **Reason:** The fix changes the API and the app together, which is Large, and no recorded user decision approves it.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The switcher still filters only the rows of at most 20 pages, and the list operations still take no search term.
- **Category:** Product bug.

- **Terms:**
  - **Switcher:** The viewer panel that lists a project's branches and pull requests below a search field.
  - **`referencePageLimit`:** The cap on how many reference pages the switcher reads before it stops.
- **Background:** The list operations `listBranches` and `listPullRequests` take no search term. The switcher reads both lists up to `referencePageLimit`, filters the loaded rows with `matching`, and shows the capped notice "More branches and pull requests". So a search cannot reach a reference past the cap, and no control opens a reference by name. A review of the switcher work found this. Its second round split the client half into its own milestone.
- **Problem:** In a repository with more references than the cap, a reader cannot find a branch or pull request past it.
- **Impact if no action:** Large repositories hide some references from the switcher, and the capped notice offers no way to them.
- **Root question:** How does the switcher find any reference of the project, past the loaded rows?
- **Options:**
  - **A.** Keep the client filter and the capped notice. Effort: Small.
  - **B.** Add a search term to `listBranches` and `listPullRequests`, then use it in the switcher. Effort: Large.
    - The term matches the branch name and the pull request number and title.
    - Define the matching rule, its order, its cursors and its visibility checks in `viewer-read-model.md` and the OpenAPI document.
    - Regenerate the client with `cargo xtask openapi`.
    - In the switcher, pass the term, drop `matching` and `referencePageLimit`, and retire the capped notice, its test and its allowance.
    - Keep the search field, and add the loading and empty states that an API search needs.
- **Left out:** Read every page before the first search. One open of the switcher then reads every reference of a large repository.
- **Wider fix:** B. The server then owns search for every client.
- **Previous examples:** `plans/follow-ups/app-list-reads-drop-later-pages.md` is the same class for other lists.
- **Related:** The list below gives the links.
  - `plans/follow-ups/switcher-truncated-list-lacks-mockup.md` draws the capped notice. Draw it before B lands. Close it only after B lands and removes the capped state.
  - `plans/follow-ups/app-list-reads-drop-later-pages.md`, same class. It holds the other app list reads that stop at their first page.
- **Recommendation:** B. A server search reaches every reference.
- **Action:** ask the user, because condition 3 holds: B is Large.

`packages/app/src/viewer/panels/switcher.tsx:113` names "Milestone 13J" in a comment. That name pointed into the deleted plan, so this item replaces it. Remove the comment when the work on this item lands.

Source: [Milestone 13J](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L607-L632) and [Milestone 13P](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L633-L659) of the deleted plan.
