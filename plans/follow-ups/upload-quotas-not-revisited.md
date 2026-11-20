# Upload quotas were never revisited

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/publication-delta-upload.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/cloud/publication-upload-validation.md:17-45`, `crates/mkc-mokly-contract/src/limits.rs:33-78` and `docs/ops/environment.md:313-343`.
- **Reason:** A change to the quotas changes a requirement, and the plan left the question for after the merge.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. The quotas and their memory model are unchanged, and no measurement of real exports or receiver load exists.
- **Category:** Performance.

- **Background:** The list below gives the facts.
  - An upload archive may hold at most 20,000 files, and its manifest may declare at most 19,999 entries. The plan and the declared content may hold at most 512 MiB.
  - The quotas came from a time when API memory grew with the whole export.
  - The delta upload of 2026-10-02 made the CLI send only the files that the project has not stored. It reduces repeated bytes, but it does not remove the cost of metadata, per-blob memory, storage or time.
  - `docs/ops/environment.md:313-324` budgets the memory for 20,000 path and index records.
  - A raw Blob request keeps its whole declared body, and a gzip request reserves the encoded and decoded bodies together.
- **Problem:** The quotas may be tighter than the current receiver needs, or looser than its memory bounds allow.
- **Impact if no action:** A large catalogue can hit a limit that may be tighter than the receiver needs. Nobody has measured it.
- **Root question:** Which upload quotas fit a receiver whose memory no longer scales with the export?
- **Options:**
  - **A.** Keep the quotas. Effort: Small.
  - **B.** Measure real exports and the receiver's memory, CPU, database and completion time at the current bounds. Then decide whether to keep, lower or raise each quota, and update the protocol doc with any change. The measurement is not code effort. Effort: Small.
- **Left out:** Remove the quotas. A bound keeps a single upload from exhausting storage and time.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** B. A measurement shows whether the delta upload changed what the quotas must protect. The quotas stay until then.
- **Action:** ask the user, because condition 1 holds: B changes the quota requirement.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/publication-delta-upload.md?plain=1#L514-L524) of the deleted plan.
