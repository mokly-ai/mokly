# Confine opaque PostCSS inputs

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Design confined inputs for the PostCSS reads that observation leaves
opaque: native addons, helper processes, workers, metadata reads,
`fs.openAsBlob`, and WASI. Cover native, helper, and worker reads,
private resolution metadata, unknown descriptor positions, opaque
providers and options, and unavailable native identity. User decision
114 A (2026-10-21) moved this work after the merge. Design:
`.context/rust-rebuild/delegation/m9-compare/design-postcss-digests.md`.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5437).
