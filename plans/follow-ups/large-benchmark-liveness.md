# Use progress as the large benchmark liveness signal

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 162 (batch 25 harness note):
`npm run benchmark:large -- --scenario build` stops at its 300-second
liveness deadline, but the large fixture builds with `--strict --base`
take 467 s (HTML) and 921 s (React). Severity Low, effort not recorded.
Options: A, raise the build scenario's deadline above the measured
build times; B, make the deadline a liveness limit that each progress
line resets. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6197).
