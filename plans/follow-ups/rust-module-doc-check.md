# Decide on a Rust module documentation check

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #223 and its completed plan, the wider fix
  that its first implementation review split off finding 7.
- **Location:** None yet. A new check would live under `xtask/src`. The
  rule comes from the shared `rust` skill that `AGENTS.md` names.
- **Reason:** The wider fix adds a repository gate, and the repository rules
  reserve a new gate for the user.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Module doc:** the `//!` comment at the start of a Rust file that says
    what the module does.
  - **xtask:** the Rust verification task runner under `xtask/`.
    `cargo xtask check` runs the repository gates.
- **Background:**
  - The shared `rust` skill requires that every module has a module-level
    doc comment.
  - No repository check enforces the rule today. Reviewers find a missing
    module doc by reading the file.
  - The first implementation review of PR #223 found a missing module doc
    on 2026-10-27. It was fixed in that pull request. The review
    then recorded an xtask check as the wider fix.
  - On 2026-10-30, 7 of the 1,593 tracked Rust files under `crates/` and
    `xtask/` had no `//!` line in their first five lines. All 7 are test
    modules under `src/_tests_/` in `mokly-graph` and `mokly-render`.
- **Problem:** New modules can omit their module doc. Adding a check creates
  a stricter repository gate.
- **Impact if no action:** Reviewers must find missing module docs by
  inspection.
- **Root question:** How should Mokly make sure that every Rust module has
  its module doc?
- **Options:**
  - **A.** Keep review-only enforcement. Effort: Small.
  - **B.** Add an xtask check for a module doc at the start of every Rust
    file. Effort: Medium.
  - **C.** Enable a compiler missing-docs lint for public modules only. This
    does not cover private files. Effort: Medium.
- **Left out:** A new standalone linter duplicates xtask ownership.
- **Wider fix:** B. It checks the exact rule of the `rust` skill for every
  Rust file.
- **Previous examples:** None found before PR #223, as its review recorded.
  The seven test modules above are current cases.
- **Recommendation:** B. It checks the exact repository rule for
  every Rust file.
- **Action:** ask the user, because the recommended option adds a new repository
  gate.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L381).
