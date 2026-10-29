# Disable persisted credentials in CI checkouts

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 164 (final review R3): six `ci.yml` checkouts keep
persisted credentials (the `useblacksmith/checkout` default), so pull
request code can read the checkout token from `.git/config`. The same
setting is on `main`, the repository is public, and the token has
`contents: read` only. Severity Medium, effort not recorded. Options:
A, set `persist-credentials: false` on the six checkouts; B, add a
policy test that rejects persisted credentials (a new gate, which needs
the user's approval). Recommended: A, and B later if approved.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6213).
