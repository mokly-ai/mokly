# Align CSS Module checks for custom-property-like rules

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 113 (M14 nesting report item 28, round 7
differential): in a rule list, the module check at
`crates/mokly-css/src/module_checks.rs:30` skips the block of a
statement that starts like a custom property, such as `--x:{…}`. The
renamer and the token check read the same statement as a rule with a
block, so an `@value` in that block passes the module check. In
keyframes and `@document` blocks, such a stylesheet builds today.
Severity Low. Options: A, keep the skip, Small; B, delete it, so that
an `@value` there fails with its catalogued message, Small.
Recommended: B, because it removes the last statement that one
scanner reads on its own, and `@value` fails at every rule level. B
rejects stylesheets that build today, so keep the skip until the
user decides.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5982).
