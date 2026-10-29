# Batch Git reads for opaque assets

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** performance.
- **Background:** Comparison hashes opaque Git assets and copies them into delivery. Each asset currently starts separate commands and uses buffered copies.
- **Problem:** Sixty-four assets can start 128 Git commands. A large asset can hold two full payload copies.
- **Impact if no action:** All bounds hold, but large comparisons keep avoidable process and memory cost.
- **Root question:** How should Mokly batch Git reads for opaque assets?
- **Options:**
  - **A.** Measure the workload. Batch digests and stream delivery while keeping every current bound. Effort: Large.
  - **B.** Retain the measured adapter. Effort: Small.
- **Left out:** Removing the bounds can reduce code but breaks the comparison memory contract.
- **Wider fix:** A.
- **Previous examples:** Batched base reads removed per-file Git process startup. The original measurement is `.context/rust-rebuild/m9-lookup-and-matching/git-assets.md`.
- **Recommendation:** A. It removes both measured costs while preserving the existing limits.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5834).
