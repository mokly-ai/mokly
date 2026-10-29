# Keep healthy remote Testbox runs alive

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `.github/workflows/blacksmith-testbox.yml`.
- **Reason:** The review found this problem outside the change that it reviewed.

- **Source:** Review.
- **Category:** process.
- **Background:** Remote verification gives each Testbox job 30 minutes. One healthy file-delivery job reached that limit before report download.
- **Problem:** The guard can stop a healthy suite. Raising it also raises the cost and failure-detection limit.
- **Impact if no action:** A valid remote gate can fail without a report.
- **Root question:** How should Mokly keep healthy remote Testbox runs alive?
- **Options:**
  - **A.** Keep the 30-minute guard and rerun a stopped job. Effort: Small.
  - **B.** Raise the job timeout. This weakens the current cost guard. Effort: Small.
  - **C.** Measure the suite and reduce or redistribute its work under the 30-minute guard. Effort: Medium.
- **Left out:** Removing the timeout loses the remote cost and liveness bound.
- **Wider fix:** C.
- **Previous examples:** CI timing calibration balanced other Testbox jobs. Evidence is in `.context/ci-release-fixes/testbox-timeout-annotations.json`.
- **Recommendation:** C. It preserves the guard and makes the suite fit it.
- **Action:** ask the user, because condition 6 holds. This performance or process change needs the user to choose its cost.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4212).
