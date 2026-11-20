# Branch catalogue follows upload order, not commits

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from finding 2 of the `ea1ea2a8` review in the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `plans/`, for the new plan. The rules it changes are in `docs/protocol/cloud/viewer-address-state.md` and `docs/protocol/cloud/cloud-builds.md`.
- **Reason:** On 2026-10-20 the user approved that this finding gets its own plan, and that plan was never written on `main`.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The branch alias still follows the creation order of ready publications, and no commit-order plan exists.

- **Terms:**
  - **Branch alias:** The pointer from a branch to its latest ready publication, which `/<workspace>/<project>` and branch routes open.
- **Background:** The list below gives the facts.
  - A branch alias points at the latest ready publication of the branch.
  - "Latest" means the upload that the server admitted last, not the newest commit. The server creates the publication when it admits the upload plan.
  - `latest_publication()` in `crates/mkc-store-pg/src/publication.rs:142-154` and `crates/mkc-store-pg/src/viewer/branches.sql:33-35` order the ready publications by that creation time.
  - The review of `ea1ea2a8` found that an older head can replace a newer one. For example, the upload plan of an older commit can reach the server after the upload plan of a newer commit.
  - A design that builds every commit is therefore not safe today.
  - The user moved the finding to its own plan and approved that plan on 2026-10-20. A plan named `commit-ordered-catalogue.md` was named, but it never reached `main`.
- **Task:** Write the plan with the `plans` skill: a branch catalogue that follows commit order rather than upload order. The plan holds the design decisions, the options and their dates. Implementation waits for the plan's own approval. The Small effort covers the plan only. The implementation that the plan describes needs its own grade.
- **Impact if no action:** A late upload plan of an older commit can move the branch alias back to older content. Cloud builds cannot safely build every commit.
- **Needs:** Nothing beyond the user's approval of 2026-10-20 to write the plan. Each design choice in it needs its own answer.
- **Done when:** The plan exists on a branch, with its decisions put to the user.

The approval of 2026-10-20 covers writing the plan. It does not choose a design, and it does not authorize an implementation.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
