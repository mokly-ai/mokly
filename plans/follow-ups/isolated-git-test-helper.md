# Use the isolated Git test helper

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 173 (W8 decision 7):
`crates/mokly-compare/tests/large_sources_tests.rs:17` runs `git`
without the isolated `support::git`, so a global setting such as
`commit.gpgsign = true` can fail it locally. Severity Low, effort
Small. Options: A, use `support::git`, Small; B, A, and add a check
that rejects `Command::new("git")` in Rust tests outside the support
modules (a new gate, which needs the user's approval). Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6319).
