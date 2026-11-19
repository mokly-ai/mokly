# Current-only screen list stays unavailable

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F7 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/viewer/service.rs:93-106` and `:143-156`, `crates/mkc-api/src/viewer/share_validation.rs:17-24`, `docs/protocol/cloud/viewer-read-model.md:191-204`, `docs/protocol/cloud/rest-api-surface.md:37-39` and `docs/ops/deploy.md:762-767`.
- **Reason:** The adoption is a Large API change that replaces the documented 503 requirement, so it needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `listScreens` and screen-specific Share still return `operation-unavailable` without a comparison. The pinned v5 catalogue already carries screens with paths, titles and views.
- **Category:** Product bug.

- **Terms:**
  - **Current-only listing:** The `listScreens` answer for a publication that has no comparison, from the current content alone.
  - **Screen-specific Share:** A Share link that pins one screen of a publication.
- **Background:** The list below gives the facts.
  - Current-only `listScreens` and screen-specific Share return 503 `operation-unavailable`. Publication-level Share works.
  - The initial scope moved this work to the backlog on 2026-09-18, to run when Mokly released a current-screen artifact.
  - `docs/protocol/cloud/viewer-read-model.md:195-197` says that the catalogue index supplies the package's screen metadata, and that the API projects comparison-backed publications only.
  - `docs/ops/deploy.md:762-767` says the API returns `operation-unavailable` until the cloud adopts the catalogue metadata for those operations.
  - On 2026-10-31 the declarations of the pinned `@mokly/viewer` showed that the v5 catalogue already carried the screens, with their paths, titles and views.
  - On 2026-11-17 the cloud reads catalogue index version 9 of the workspace Mokly packages. Every upload carries the index, and its current screen records carry their paths, titles and views. The API projects screens from that index only for a publication with a comparison: `index` in `crates/mkc-api/src/viewer/service.rs:143-156` returns no index without the comparison file, and the listing then answers `operation-unavailable`.
  - So the missing Mokly artifact is no longer the blocker, and no Mokly change is needed for the metadata.
- **Problem:** Readers of a publication without a comparison cannot list its screens or share one screen. The catalogue index already carries the screen metadata, but the API reads it only for a publication with a comparison.
- **Impact if no action:** Share links stay publication-level for every current-only publication.
- **Root question:** How does the API list the screens of a publication without a comparison?
- **Options:**
  - **A.** Keep the operations unavailable. The verification that this option first held is done: the catalogue carries the documented screen metadata. Effort: Small.
  - **B.** Adopt the metadata for current-only listing and screen-specific Share: read the stored index of every publication, also without a comparison. Keep the publication-level Share. Do not infer screen metadata from file names or undocumented HTML. Make the API smoke require both operations. Effort: Large.
- **Left out:** Infer screens from file names. The artifact boundary forbids undocumented inputs.
- **Wider fix:** None.
- **Previous examples:** The comparison listing already reads the stored catalogue index.
- **Recommendation:** B. The metadata exists in every current index, and the adoption removes a 503 that readers meet.
- **Action:** ask the user, because condition 3 holds: B is Large. B also replaces the 503 requirement of `docs/protocol/cloud/viewer-read-model.md`, so record the user's approval before that change.

Source: [Milestone F7](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1094-L1116) of the deleted plan.
