# Make the deployment test observe its step failure

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** The deployment flow test replaces a deployment while a step load is failing.
- **Problem:** The replacement aborts the load before its 404 arrives. The test can pass without observing the failure named in its title.
- **Impact if no action:** The test does not protect failure delivery. A regression can pass unnoticed.
- **Root question:** How should Mokly make the deployment test observe its step failure?
- **Options:**
  - **A.** Rename the test and assert only the replacement abort that it reaches. Effort: Small.
  - **B.** Add an explicit failure-ready signal. Assert the 404 before the replacement abort. Effort: Medium.
- **Left out:** Keeping the current title and assertions leaves a test that cannot fail for its stated behavior.
- **Wider fix:** B.
- **Previous examples:** The completed plan records the same abort race in the static deployment flow.
- **Recommendation:** A. It makes the test state only the behavior that its current scenario can prove.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6090).
