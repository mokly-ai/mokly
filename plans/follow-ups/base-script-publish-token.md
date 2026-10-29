# Keep the publish token from base install scripts

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 151 (135 B review finding 43): a script can read the
publish token. A script reads `MOKLY_TOKEN` from Mokly's own
`/proc/{pid}/environ`. Severity Medium, security, effort Small.
Options: A, document it and advise `--no-base-install-scripts`,
effort not recorded; B, keep scripts off when a token is present, with
a warning, Small; C, a separate process space, effort not recorded.
Recommended: B.

- Security: the hub recommends a decision before the first npm release.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6118).
