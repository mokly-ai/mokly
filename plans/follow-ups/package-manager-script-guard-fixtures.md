# Add fixtures for package-manager script guards

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Package-manager command tests and cold-install fixtures.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** Private installs pass script and hook guards to pnpm and Yarn. Current tests inspect only part of those commands.
- **Problem:** No marker fixture proves `--ignore-pnpmfile`, `YARN_IGNORE_PATH`, `--no-default-rc`, or removal of `YARN_PLUGINS`.
- **Impact if no action:** A manager can run a blocked hook while command-level tests still pass.
- **Root question:** How should Mokly add fixtures for package-manager script guards?
- **Options:**
  - **A.** Assert every guard flag in manager command tests. Effort: Small.
  - **B.** Apply A and add marker fixtures for pnpm files, Yarn paths, and ancestor configuration. Effort: Medium.
- **Left out:** One generic marker cannot exercise the different pnpm and Yarn hook locations.
- **Wider fix:** B. Real marker fixtures prove each guard at the process boundary.
- **Previous examples:** pnpm and Yarn review finding 7 lists the missing guards.
- **Recommendation:** B. It tests both the command and the behavior.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5996).
