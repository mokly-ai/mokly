# Measure Git opaque-asset reads and delivery copies

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Measure Git opaque-asset digest commands and buffered delivery under
the M14 comparison workloads. Use the cost to decide on streamed blob
copies and batched digests; keep the 64 MiB Git bound (review 6, finding 8B).
Evidence: `.context/rust-rebuild/m9-lookup-and-matching/git-assets.md`.

- Moved here from Milestone 14 on 2026-10-22, under user decision 147 B.
  The measurement informs user item 64 above.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5844).
