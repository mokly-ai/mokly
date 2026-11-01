# Use Node-compatible canonical paths on Windows

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 166, native CI round 6.
- **Location:** `crates/mokly-git/src/disk.rs:62` and
  `crates/mokly-sidecar/src/memory_table.rs:67`.
- **Reason:** Option B adds a Clippy lint, and a new lint needs the user.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Verbatim path:** the Windows `\\?\C:\` form of a path that
    `std::fs::canonicalize` returns. npm and Node reject it.
- **Background:** `std::fs::canonicalize` returns the verbatim form on
  Windows. `dunce::canonicalize` returns the plain form when that form can
  name the location. The other product modules already use `dunce`. A
  native CI round of the rebuild found these two remaining calls after a
  real npm failure on Windows.
- **Problem:** Two product modules still call `std::fs::canonicalize`:
  `SystemDisk::canonicalize` in `disk.rs` and `SystemTable::canonicalize` in
  `memory_table.rs`. Neither result reaches Node today, but a later caller
  can pass the verbatim output across that boundary.
- **Impact if no action:** A refactor can bring back a Windows path failure
  that the other modules already avoid.
- **Root question:** How should product code get canonical paths that Node
  and npm accept on Windows?
- **Options:**
  - **A.** Keep the two standard library calls. Effort: Small.
  - **B.** Use `dunce::canonicalize` in both, and forbid
    `std::fs::canonicalize` in product code with a Clippy
    `disallowed-methods` rule. The rule is a new lint. Effort: Medium.
- **Left out:** Normalizing only at the Node boundary leaves other Windows
  consumers of the path exposed.
- **Wider fix:** B. The lint stops new verbatim paths at their source.
- **Previous examples:** The real npm failure on Windows that led a native
  CI round of the rebuild to these two calls.
- **Related:** [verbatim-cache-path-check.md](./verbatim-cache-path-check.md)
  concerns the verbatim form that `dunce` keeps for long paths. One branch
  can align both.
- **Recommendation:** B. It aligns all product canonicalization and stops
  a repeat.
- **Action:** ask the user, because B adds a Clippy `disallowed-methods` rule, a
  new lint that the always-on rules reserve for the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6231).
