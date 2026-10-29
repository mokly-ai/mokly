# Use one typed lockfile model

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The pnpm and Yarn lockfile readers in `crates/mokly-compare`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** code structure.
- **Background:** Base dependency validation scans pnpm and Yarn lockfile scalars. Targeted fixes infer which values are paths.
- **Problem:** The scans have no typed importer or locator context and can classify the same scalar differently across formats.
- **Impact if no action:** A new lockfile shape can bypass path validation or reject a non-path value.
- **Root question:** How should Mokly use one typed lockfile model?
- **Options:**
  - **A.** Keep scalar scans with targeted fixes. Effort: Small.
  - **B.** Parse pnpm and Yarn lockfiles into one typed model. Check only path fields and compare against Yarn's parser corpus. Effort: Large.
- **Left out:** Using each package manager as a runtime parser adds tool startup and version coupling to base validation.
- **Wider fix:** B. Typed path fields remove scalar-position guesses across both formats.
- **Previous examples:** pnpm and Yarn review findings 3 and 4 share this wider fix.
- **Recommendation:** B. It removes the repeated parser class despite its larger cost.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6009).
