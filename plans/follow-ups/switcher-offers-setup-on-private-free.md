# Switcher offers setup where the stage does not

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestones 6A/6B finding 2 of the Milestone 7 review TODO in the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `apps/app/src/screens/viewer/panel-host.tsx:63-65` and `:93-100`, `apps/app/src/viewer/panels/switcher.tsx:145-165` and `:245-246`, `apps/app/src/viewer/stage-view-decision.ts:82-101` and `docs/protocol/cloud/viewer-chrome.md:103-126`.
- **Reason:** The source keeps the current behaviour pending a product decision.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The panel host still gives the switcher Set up publishing from `project.canAdmin` alone, without the plan check.
- **Category:** UX wording.

- **Terms:**
  - **Set up publishing:** The viewer action that sends an administrator to the site's publishing guide.
- **Background:** On a private project on the Free plan, the stage does not offer **Set up publishing**, because the plan refuses publishing there. The switcher still offers it on the same project, because the panel host checks only `project.canAdmin`. The host gives the Share panel the same `setUpPublishing` value, so the chosen rule applies to Share too. Whether the empty Share body stays reachable is a separate choice in `plans/follow-ups/share-empty-state-shows-only-while-loading.md`. The desktop work added tests that a member gets no **Set up publishing** in the switcher and the Share panel. The user did not answer the finding, and the default of 2026-10-16 kept the difference for a product decision.
- **Problem:** Two surfaces of one project disagree about whether the reader can set up publishing.
- **Impact if no action:** An administrator follows the switcher's action to a guide for publishing that the plan then refuses.
- **Root question:** Which surfaces offer **Set up publishing** on a project whose plan refuses publishing?
- **Options:**
  - **A.** Hide the action in the switcher too, as the stage does. Effort: Small.
  - **B.** Show the action on both, with the plan refusal beside it. Effort: Small.
- **Left out:** Keep the difference. Two surfaces then keep giving opposite answers.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. The stage already follows the plan rule.
- **Action:** ask the user, because condition 5 holds: the source left the choice to a product decision.

Source: [the Milestone 7 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L734-L795) of the deleted plan.
