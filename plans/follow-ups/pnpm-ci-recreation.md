# Make pnpm recreation independent of CI

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The pnpm base dependency installer in `crates/mokly-compare`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** pnpm can recreate a tracked `node_modules` directory. It prompts before removal outside CI and proceeds automatically in CI.
- **Problem:** The same base source falls back to tier three locally but uses tier two in CI.
- **Impact if no action:** Comparison dependency selection changes by environment.
- **Root question:** How should Mokly make pnpm recreation independent of CI?
- **Options:**
  - **A.** Disable the recreation prompt for Mokly's private installs. Effort: Small.
  - **B.** Document that CI can select a different dependency tier. Effort: Small.
- **Left out:** Forcing every install into CI mode can change other package-manager behavior.
- **Wider fix:** A. A noninteractive private install makes the result environment-independent.
- **Previous examples:** pnpm CI fix finding 1 recorded the tracked `.modules.yaml` case.
- **Recommendation:** A. It gives local and CI runs the same tier.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6158).
