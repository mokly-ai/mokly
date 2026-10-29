# Remove the publish token from the sidecar environment

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 180 (delta review 5, older than the delta):
`crates/mokly-sidecar/src/process_factory.rs:82`: the sidecar inherits
`MOKLY_TOKEN`, so PostCSS, renderer, and component code from the
repository and from the base commit can read it. `main` ran that code
with the same environment. Related to user item 151. Severity Low,
security, effort not recorded. Options (estimate): A, remove
`MOKLY_TOKEN` from the sidecar environment; B, an allowlisted sidecar
environment, as 145 B gives base installs. Recommended: A, because an
allowlist can break consumer PostCSS settings that read other
variables.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6384).
