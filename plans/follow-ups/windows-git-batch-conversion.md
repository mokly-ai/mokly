# Batch converted base reads on Windows

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 165 (native CI round 6 decision): under decision
69 C, a base read starts one Git process per file when
`core.autocrlf` is not false, and Git for Windows sets it to true by
default. The round 6 record gives no severity. Options: A, document
the cost, Small; B, use the raw batch also for paths whose attributes
make checkout an identity, Small; C, convert each batch in one
`git checkout-index --temp` process with a private index, and fall
back per file on a failure, Medium. Recommended: C.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6222).
