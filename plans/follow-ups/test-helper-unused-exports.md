# Check test helper trees for unused exports

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The internal-export audit and the Node test helper trees.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** process.
- **Background:** The unused internal export audit checks product source trees. Test helper trees are outside its scope.
- **Problem:** Unused exports in browser and viewer test helpers can accumulate without a failure.
- **Impact if no action:** Dead test helpers increase maintenance cost and hide wrong fixture APIs.
- **Root question:** How should Mokly check test helper trees for unused exports?
- **Options:**
  - **A.** Keep the current product-only audit. Effort: Small.
  - **B.** Audit `tests/browser`, `tests/helpers`, and `packages/viewer/tests`. Exclude catalogue fixtures. Effort: Medium.
- **Left out:** Auditing generated or authored catalogue fixtures would report intentional exports.
- **Wider fix:** B. Extending the existing audit prevents the same class in test helper owners.
- **Previous examples:** Earlier cleanup commits `ec52f856` and `fe3624df` removed 47 unused exports.
- **Recommendation:** B. The current helper trees have no baseline entries, so the check starts clean.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5953).
