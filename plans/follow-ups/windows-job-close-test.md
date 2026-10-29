# Make the Windows job-close test effective

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 176 (delta review 1):
`crates/mokly-platform/tests/process_tests.rs:104`: the Windows
job-close test cannot fail when the job does not kill the child,
because `Child::wait` closes stdin, so `set /p` ends cmd by itself.
Severity Medium, test, effort not recorded. Options (estimate): A,
append `&echo leaked` to the command and assert that it never prints;
B, a shared test helper that proves the job killed the child, used by
every job-close test. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6348).
