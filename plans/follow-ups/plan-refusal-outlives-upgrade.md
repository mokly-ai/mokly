# An old plan refusal stays after an upgrade

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 3 of the Milestone 26 review TODO in the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/app/src/viewer/reference-stage.ts:51-57`, `packages/app/src/viewer/build-action.ts:31-58`, `packages/app/src/viewer/build-copy.ts:98-114` and `docs/protocol/cloud/viewer-builds.md:70-98` and `:206-210`.
- **Reason:** The recommended fix changes the plan guidance that the viewer contract requires, so it needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. A code read confirms the stale guidance path. Nobody reproduced it with a real upgrade.
- **Category:** Product bug.

- **Terms:**
  - **`plan-required`:** The build failure cause when the workspace's plan refuses publishing, for example a private project on Free.
- **Background:** A cloud build ends with a cause that the viewer and the GitHub check show. When the plan refuses publishing, the build ends with `plan-required`. The review of 2026-10-20 found that this refusal stays on the reference after the workspace upgrades. The list below gives the current path in the app.
  - Once publishing is allowed, `referenceStage` can still select a newer failed build for the reference.
  - For `plan-required`, `buildAction` offers Open billing to an owner before it reads `canRequestBuilds`.
  - The plan line in `build-copy.ts` uses the reader's role, not the current plan.
  - `docs/protocol/cloud/viewer-builds.md:70-98` and `:206-210` require this cause-specific plan guidance and the choice of a newer failed build.
- **Problem:** After an upgrade, the reference can keep offering the old plan guidance, such as Open billing, until a new push or a Re-run.
- **Impact if no action:** A team that upgrades to Team can still see the plan refusal on its references and believe that the upgrade did not work.
- **Root question:** What does a reference show after its plan refusal no longer applies?
- **Options:**
  - **B.** Change nothing. A new push or a Re-run clears the refusal. Effort: Small.
  - **A.** Treat `plan-required` like the other failures while publishing is allowed, so that the current plan decides what the reference offers. The stored failure cause stays as build history. Only the offered action and line change. The change is in the app only. Change the guidance rule of `docs/protocol/cloud/viewer-builds.md` with it. Effort: Medium (estimate).
- **Left out:** Not recorded.
- **Wider fix:** A. The current plan then decides every plan-dependent state.
- **Previous examples:** None found.
- **Recommendation:** A. The review recommended it.
- **Action:** ask the user, because condition 1 holds: A changes the cause-specific plan guidance that `docs/protocol/cloud/viewer-builds.md` requires.

The review graded the finding Low severity and Large effort. Those grades are history. The review measured no implementation, and the current path is in three app files.

Source: [the Milestone 26 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2192-L2244) of the deleted plan.
