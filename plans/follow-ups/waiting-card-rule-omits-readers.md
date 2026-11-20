# The waiting card rule leaves out readers

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 4 of the Milestone 26 review TODO in the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/cloud/viewer-builds.md:15-19` and `:210-220`, `docs/protocol/cloud/viewer.md:87-94`, `apps/app/src/screens/viewer/viewer-build.ts:26-38` and `apps/app/src/viewer/stage-view-decision.ts:95-102`.
- **Reason:** PR #45 merged with this requirement choice open, and no user answer is recorded.
- **Checked:** 2026-10-31, at commit `f568853e`. Rule 7 now names the ordinary reviewer cards. The remaining protocol and app disagreement still needs a user decision.
- **Category:** Docs or spec.

- **Terms:**
  - **Waiting card:** The stage card that the viewer shows while a reference has no ready publication and a build may come.
- **Background:** The viewer stage draws a card for a reference without a ready publication. Stage rule 7 of `docs/protocol/cloud/viewer-builds.md` says which card each reader sees. The review of 2026-10-20 found that the rule leaves out some readers. The list below gives the current state.
  - Rule 7 now names the branch and pull request reviewer cards of a build-capable project.
  - `viewer-build.ts:26-38` gives no member access to public readers and to direct-grant reviewers with neither a capability nor workspace membership. `viewer-builds.md:15-19` names these readers.
  - On a build-capable project, the app gives these readers the pull request waiting card, or the branch setup or reader card, at `stage-view-decision.ts:95-102`.
  - `docs/protocol/cloud/viewer.md:87-94` says that the waiting card shows only when the project cannot build. The app's fallback for these readers is wider.
- **Problem:** For a reader without member access on a build-capable project, rule 7 does not say which card the stage shows. `viewer.md` also limits the waiting card to projects that cannot build.
- **Impact if no action:** A reviewer cannot tell whether the stage is right for those readers, and a later change can alter their card without notice.
- **Root question:** Which waiting card does each reader see?
- **Options:**
  - **A.** State those readers' cards in the Viewer protocol and in stage rule 7, as the app shows them today. Widen the "only when the project cannot build" condition of `viewer.md`. This changes a requirement and needs the user's approval. Effort: Small.
  - **B.** Change nothing. Effort: Small.
  - **C.** Keep the current Viewer rules, and change the app's fallback to meet them. Waiting and Set up cards then show only on projects that cannot build. The user chooses the other card for readers without member access. This changes tested behavior and needs the user's approval. It designs no new screen here. Effort: Medium (estimate).
- **Left out:** None. A changes the requirement, B keeps the disagreement, and C changes the app.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. The review recommended it.
- **Action:** ask the user, because condition 1 holds for A and condition 3 holds for C. A changes a requirement. C changes behavior that the current test asserts. The review's recommendation is not approval.

The review graded the finding Low severity and Small effort. The check of 2026-10-31 named the readers that the rule still leaves out: public readers and direct-grant reviewers without member access.

Source: [the Milestone 26 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2192-L2244) of the deleted plan.
