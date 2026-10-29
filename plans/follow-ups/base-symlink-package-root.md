# Support linked package roots in base trees

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 174 (W8, outside its scope):
`crates/mokly-compare/src/git_tree.rs:214` reports a symbolic-link
entry as `Symlink`, so a package root that is a link, or goes through
one, loads in the working tree but fails in the base tree. Severity
Low, effort not recorded. Options: to be written in the follow-up.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6327).
