# Test every axis of Affected links

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/browser/branch_point_affected.ts` and `packages/viewer/tests/affected_comparison.test.ts`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** Affected links select an entry, viewport, color scheme, comparison, and Details text. Two test suites cover these links.
- **Problem:** One test derives its expected viewport from the link under test. The other test does not inspect link URLs.
- **Impact if no action:** A link can use the wrong axis while both tests pass.
- **Root question:** How should Mokly test every axis of Affected links?
- **Options:**
  - **A.** Add independent viewport and scheme values to the fixture. Assert each URL and its Details text. Effort: Small.
  - **B.** Add one shared helper with independent destination, axis, comparison, and Details expectations. Effort: Medium.
- **Left out:** Reading expected values from the generated link repeats the current defect.
- **Wider fix:** B. One helper prevents both suites from deriving expectations from output.
- **Previous examples:** The completed plan records the two affected test ranges.
- **Recommendation:** B. Shared independent expectations protect every link axis.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6099).
