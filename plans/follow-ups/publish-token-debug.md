# Redact publish tokens from Debug output

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 181 (delta review 6, older than the delta):
`crates/mokly-cli/src/grammar.rs:116`: `Publish` derives `Debug` and
holds the raw `--token` value. No code formats it now. Severity Low,
security, effort not recorded. Options (estimate): A, a redacting
`Debug` for `Publish`; B, one secret type with a redacting `Debug` for
every token field. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6395).
