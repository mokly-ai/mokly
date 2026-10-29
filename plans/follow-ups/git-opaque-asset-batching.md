# Batch Git reads for opaque assets

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 64 (engine R20-1, from M14 review 6 finding 8):
decide on streamed Git blob copies and batched digests. Each opaque
asset digest starts its own Git process, and delivery buffers a
copy. 64 assets cause 128 opaque Git commands, and a 16.78 MB file
needs two payload copies during delivery. Every bound holds.
Severity Low, effort Large. Options: A, remove per-asset process
startup and the extra full-blob buffer, and preserve all existing
bounds, Large; B, retain the measured adapter, Small (estimate).
Recommended: A. No option is applied.

Measure digest commands and buffered delivery under the M14 comparison
workloads before implementation. Keep the 64 MiB Git bound. The measurement
was a separate checklist line in the completed plan, but it is a prerequisite
of this decision.

## Decision

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
- **Previous examples:** Batched base reads removed per-file Git process startup for converted sources.
- **Recommendation:** A. It removes both measured costs while preserving the existing limits.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5834).
