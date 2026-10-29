# Redact literal percent signs in secrets

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 177 (delta review 2):
`crates/mokly-publish/src/redaction.rs:85`: `SecretMatcher` reads every
`%` as an escape, so it does not redact the literal form of a secret
that contains `%`. The old redactor did. A valid token cannot contain
`%`. Severity Low, security, effort not recorded. Options (estimate):
A, also match a literal `%` byte; B, keep it and document that a token
cannot contain `%`. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6357).
