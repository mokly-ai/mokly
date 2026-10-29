# Return Linux Rust jobs to two vCPUs

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Follow-up (Low, cost, not a user item): move the Linux CI jobs that
compile Rust back to 2 vCPUs. On 2026-10-26 the user raised them from
2 to 8 vCPUs for a limited time, until the Rust build cache of #215 and
the other CI speed work land. The Windows native job stays on 8 vCPUs.
On 2026-10-27 the user chose 8 over 16 vCPUs for it, because with the
Rust build cache 16 vCPUs gave no speed-up. On 2026-10-27 the user also
asked that the remote gate's Testboxes match the CI suite jobs and stay
aligned, so that a remote gate takes the time and cost of CI. The
Testbox job therefore moves back with the Linux jobs. Measure the cached
job times on 2 vCPUs first. Update `docs/protocol/ci-workflow.md`,
`docs/protocol/remote-verification-testbox.md`, and the runner size test
in the same change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6715).
