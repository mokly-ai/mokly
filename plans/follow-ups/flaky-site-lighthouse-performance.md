# Site Lighthouse performance flakes near its threshold

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325.
- **Location:** The `site-lighthouse` job of `.github/workflows/ci.yml` and the `lighthouse` script of `apps/site`.
- **Reason:** The flake needs a reproduction across several runs, which the move of the cloud did not need.

- **Background:** The `site-lighthouse` CI job scores the site with Lighthouse and fails below 0.95 on each category. The branch moved this job from a Blacksmith runner to the GitHub-hosted `ubuntu-24.04` runner under the runner decision of main PR #342.
- **Problem:** On 2026-11-19 the job failed once with "site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold" for route `/`, and passed on the rerun of the same commit. The score depends on runner speed.
- **Impact if no action:** Required CI fails now and then on unrelated changes, and each failure costs a rerun.
- **Root question:** How does the performance budget measure the site without depending on the speed of a shared runner?
- **Options:**
  - **A.** Measure with Lighthouse's simulated throttling and a fixed CPU benchmark multiplier, so that the score depends less on the runner. Effort: Small.
  - **B.** Run the audit three times and take the median score. Effort: Small.
  - **C.** Replace the performance score with budgets on the measured resources, such as bytes and request counts, which do not depend on speed. Effort: Medium.
- **Left out:** Lowering the threshold, because it loosens a check of live behaviour without a decision.
- **Wider fix:** C, because a resource budget cannot flake on speed.
- **Previous examples:** None found.
- **Recommendation:** C.
- **Action:** fix after merge, apply C, because it needs a reproduction and a budget choice.
