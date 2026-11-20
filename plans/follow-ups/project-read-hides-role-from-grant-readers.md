# Project read hides the role of grant readers

- **Severity:** Medium (estimate). **Likelihood:** Rare. **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from finding 13 of the `ea1ea2a8` review in the deleted `plans/cloud-builds.md`, which the user moved to post-merge follow-up, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/views/projects.rs:12-36`, `crates/mkc-api/src/platform/projection.rs:69-93`, `packages/app/src/screens/viewer/viewer-build.ts:26-38` and `docs/protocol/cloud/viewer-builds.md:15-19`.
- **Reason:** The user moved this finding to post-merge follow-up, but chose no fix, and the recommended fix is Large.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. The project read still gives no effective role and no build-read capability, so `memberAccess` matches no direct reviewer. The API itself keeps the newest build for that reader.
- **Category:** Product bug.

- **Terms:**
  - **Direct project grant:** Access to one project that a reader has without being a member of its workspace.
- **Background:** The viewer decides from the reader's access which build state and actions to show. `memberAccess` in `packages/app/src/screens/viewer/viewer-build.ts:26-38` infers it from the `canAdmin` and `canRequestBuilds` capabilities of the project read, or from the session's workspace IDs. A reviewer with only a direct project grant gets false for both capabilities and matches no workspace ID. The review of `ea1ea2a8` found that such a reader then does not see the build state. The API keeps the newest build in the snapshot for any effective role, a direct reviewer included. `docs/protocol/cloud/viewer-builds.md:15-19` documents the limitation.
- **Problem:** The project read returns no effective role and no build-read capability. The app therefore cannot tell that a grant-only reviewer may read builds, so that reviewer cannot see the build state.
- **Impact if no action:** Reviewers invited to one project do not see whether its build runs or failed. Each new role-based screen repeats the gap.
- **Root question:** How does the app learn the role of a reader who has only a project grant?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Return the reader's role in the project read, and use it for the build state. It changes the API and the app. Effort: Large.
  - **C.** Add a `canReadBuilds` capability to the project read beside the two existing capabilities, and use it in `memberAccess`. It solves the same gap for builds only. It changes the API and the app. Effort: Large.
- **Left out:** Give grant-only readers a workspace role. It widens their access beyond the grant.
- **Wider fix:** B. One project-level role serves every role-based screen.
- **Previous examples:** None found.
- **Recommendation:** B. One project-level role serves the build state and every later role-based screen.
- **Action:** ask the user, because condition 3 holds: B is Large, because it crosses the API boundary.

The user moved the finding to post-merge follow-up in Milestone 12 of the cloud builds work, after the review of 2026-10-04. The plan records no chosen option. A change to the project read needs `cargo xtask openapi` to regenerate the contract. It also updates the limitation that `docs/protocol/cloud/viewer-builds.md:15-19` states.

Source: [Milestone 12](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L1146-L1160) and [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
