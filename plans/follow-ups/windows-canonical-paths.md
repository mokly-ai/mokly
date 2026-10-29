# Use Node-compatible canonical paths on Windows

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-git/src/disk.rs` and `crates/mokly-sidecar/src/memory_table.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Node and npm reject Windows verbatim `\\?\` paths. Two product modules still call `std::fs::canonicalize`.
- **Problem:** Those calls do not reach Node today, but a later caller can pass their verbatim output across the boundary.
- **Impact if no action:** A refactor can reintroduce Windows path failures that other modules already avoid.
- **Root question:** How should Mokly use Node-compatible canonical paths on Windows?
- **Options:**
  - **A.** Keep both standard canonicalization calls. Effort: Small.
  - **B.** Use `dunce::canonicalize` and add a Clippy disallowed-method rule for product code. Effort: Medium.
- **Left out:** Normalizing only at the Node boundary leaves other Windows consumers exposed.
- **Wider fix:** B. The method rule prevents new verbatim paths at their source.
- **Previous examples:** Native CI round 6 found the two remaining calls after a real npm failure.
- **Recommendation:** B. It aligns all product canonicalization and prevents recurrence.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6231).
