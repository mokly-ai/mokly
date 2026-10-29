# Batch converted base reads on Windows

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Base checkout conversion in `crates/mokly-git`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** performance.
- **Background:** Git for Windows commonly sets `core.autocrlf=true`. Base reads then start one conversion process for each file.
- **Problem:** Mokly does not batch files whose checkout conversion might change bytes.
- **Impact if no action:** Large Windows comparisons pay per-file Git process startup.
- **Root question:** How should Mokly batch converted base reads on Windows?
- **Options:**
  - **A.** Document the Windows conversion cost. Effort: Small.
  - **B.** Use raw batches only for paths whose attributes prove checkout conversion is identity. Effort: Small.
  - **C.** Convert each batch through one private-index `git checkout-index --temp` call. Fall back per file on failure. Effort: Medium.
- **Left out:** Ignoring checkout conversion would compare the wrong bytes.
- **Wider fix:** C. One conversion process handles every attribute result in the batch.
- **Previous examples:** Native CI round 6 opened this decision under base-read decision 69 C.
- **Recommendation:** C. It removes process startup while preserving exact checkout bytes.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6222).
