# Current-only screen list stays unavailable

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F7 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/viewer/service.rs:93-106`, `crates/mkc-api/src/viewer/share_validation.rs:17-24`, `docs/protocol/viewer-read-model.md:191-204`, `docs/protocol/rest-api-surface.md:36-38` and `docs/ops/deploy.md:750-754`.
- **Reason:** The adoption is a Large API change that replaces the documented 503 requirement, so it needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `listScreens` and screen-specific Share still return `operation-unavailable` without a comparison. The pinned v5 catalogue already carries screens with paths, titles and views.
- **Category:** Product bug.

- **Terms:**
  - **Current-only listing:** The `listScreens` answer for a publication that has no comparison, from the current content alone.
  - **Screen-specific Share:** A Share link that pins one screen of a publication.
- **Background:** The list below gives the facts.
  - Current-only `listScreens` and screen-specific Share return 503 `operation-unavailable`. Publication-level Share works.
  - The initial scope moved this work to the backlog on 2026-09-18, to run when the open repository released a current-screen artifact.
  - The same protocol lines now say that the public v5 catalogue carries the package's screen metadata.
  - `docs/ops/deploy.md:750-754` says the API returns `operation-unavailable` until the cloud adopts the released catalogue metadata.
  - On 2026-10-31 the declarations of the pinned `@mokly/viewer` showed that the v5 catalogue already carries the screens, with their paths, titles and views.
  - The missing upstream artifact is therefore no longer the blocker. No dependency bump is needed for the metadata.
- **Problem:** Readers of a publication without a comparison cannot list its screens or share one screen. The pinned v5 catalogue already carries the screen metadata, but the API has not adopted it.
- **Impact if no action:** Share links stay publication-level for every current-only publication.
- **Root question:** How does the API list the screens of a publication without a comparison?
- **Options:**
  - **A.** Verify whether the pinned 0.14.0 catalogue already carries the documented screen metadata. Record the result, and keep the operations unavailable until the adoption. The verification is done: the metadata exists. Effort: Small.
  - **B.** Do A, and adopt the metadata for current-only listing and screen-specific Share. Keep the publication-level Share. Do not infer screen metadata from file names or undocumented HTML. Make the API smoke require both operations. Effort: Large.
- **Left out:** Infer screens from file names. The artifact boundary forbids undocumented inputs.
- **Wider fix:** None.
- **Previous examples:** The comparison listing already reads the documented review artifact.
- **Recommendation:** B. The metadata exists at the current pin, and the adoption removes a 503 that readers meet.
- **Action:** ask the user, because condition 3 holds: B is Large. B also replaces the 503 requirement of `docs/protocol/viewer-read-model.md`, so record the user's approval before that change.

Source: [Milestone F7](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1094-L1116) of the deleted plan.
