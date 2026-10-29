# Confine Yarn TLS file settings

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 153 (145 B probe): Yarn TLS file settings read
outside files. Severity Medium, security, effort Small. Options: A,
tier three when a base `.yarnrc.yml` sets `httpsCaFilePath`,
`httpsKeyFilePath`, or `httpsCertFilePath`, Small; B, clear them,
effort not recorded; C, confine them to the repository, effort not
recorded. Recommended: A.

- Security: the hub recommends a decision before the first npm release.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
