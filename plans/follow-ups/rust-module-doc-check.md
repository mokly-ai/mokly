# Decide on a Rust module documentation check

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #223 and its completed plan.
- **Location:** The repository Rust checks.
- **Reason:** The review or plan deferred this work until after PR #223.

## Task

A review proposed an xtask check that every Rust file starts with a module doc. This adds a stricter gate and needs user approval.

## Decision

- **Source:** Review.
- **Category:** process.
- **Background:** Rust module docs explain each file's role. The repository has no check that every Rust file starts with one.
- **Problem:** New modules can omit their module doc. Adding a check creates a stricter repository gate.
- **Impact if no action:** Reviewers must find missing module docs by inspection.
- **Root question:** How should Mokly decide on a Rust module documentation check?
- **Options:**
  - **A.** Keep review-only enforcement. Effort: Small.
  - **B.** Add an xtask check for a module doc at the start of every Rust file. Effort: Medium.
  - **C.** Enable a compiler missing-docs lint for public modules only. This does not cover private files. Effort: Medium.
- **Left out:** A new standalone linter duplicates xtask ownership.
- **Wider fix:** B.
- **Previous examples:** Review 1 of PR #223 found a missing module doc.
- **Recommendation:** B. It checks the exact repository rule for every Rust file.
- **Action:** ask the user, because condition 3 holds. The recommended option adds a new repository gate.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L381).
