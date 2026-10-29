# Normalize verbatim cache paths before safety checks

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-compare/src/locations.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Mokly rejects a cache directory inside the repository. Windows paths can use plain or verbatim `\\?\` forms.
- **Problem:** A long or reserved path can compare one form against the other and miss containment.
- **Impact if no action:** If `LOCALAPPDATA` points into the repository through that form, Mokly can write cache data inside the source tree.
- **Root question:** How should Mokly normalize verbatim cache paths before safety checks?
- **Options:**
  - **A.** Normalize both paths to one Windows form before containment checks. Effort: Small.
  - **B.** Document the long-path limitation. Effort: Small.
- **Left out:** String-prefix checks remain unsafe across separators and path aliases.
- **Wider fix:** A. One path representation protects every containment check.
- **Previous examples:** Delta review 4 found the mixed plain and verbatim case.
- **Recommendation:** A. It preserves the safety rule for long Windows paths.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6375).
