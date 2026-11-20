# Site Lighthouse performance flakes near its threshold

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325.
- **Location:** The `site-lighthouse` job of `.github/workflows/ci.yml` and the `lighthouse` script of `apps/site`.
- **Reason:** The flake needs a reproduction across several runs, which the move of the cloud did not need.

- **Background:** The `site-lighthouse` CI job scores the site with Lighthouse and fails below 0.95 on each category. The branch moved this job from a Blacksmith runner to the GitHub-hosted `ubuntu-24.04` runner under the runner decision of main PR #342.
- **Problem:** On 2026-11-19 the job failed once with "site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold" for route `/`, and passed on the rerun of the same commit. The score depends on runner speed.
  - Only the home page at 1440px misses. Every other route scores 1.00 at 390px and at 1440px.
  - A route that misses a threshold runs once more, and the second result must pass. The job keeps only the score table, so CI does not show which metric is slow.
  - Earlier evidence from the old cloud repository, where the job was report-only: CI run 44375124852 of branch `calummoore/mac-title-bar-integration` at `f4bc497b` scored 0.93, and a rerun passed. CI run 44386980398 of the same branch at `6704dc72` scored 0.93, and a rerun scored 1.00. The push CI run 44075800012 of cloud `main` at `f1318c26`, on 2026-11-17, scored 0.93. The push CI run 44317528329 of cloud `main` at `55972c86` passed with 0.95 at 1440px and 0.99 at 390px for the home page. Cloud pull request #107 reported the same 0.93, also after a rerun.
- **Impact if no action:** Required CI fails now and then on unrelated changes, and each failure costs a rerun.
- **Root question:** How does the performance budget measure the site without depending on the speed of a shared runner?
- **Options:**
  - **A.** Measure with Lighthouse's simulated throttling and a fixed CPU benchmark multiplier, so that the score depends less on the runner. Effort: Small.
  - **B.** Run the audit three times and take the median score. Effort: Small.
  - **C.** Replace the performance score with budgets on the measured resources, such as bytes and request counts, which do not depend on speed. Effort: Medium.
  - **D.** Find the slow metric of the home page at 1440px in a full Lighthouse report. Make the page faster, so that it keeps a margin over the threshold. The fix can change how the page loads or looks. Effort: Medium.
  - **E.** Run the job on a dedicated or larger runner, so that the load of the runner changes less. It needs infrastructure. Effort: Medium.
- **Left out:** Lowering the threshold, because it loosens a check of live behaviour without a decision.
- **Wider fix:** C, because a resource budget cannot flake on speed.
- **Previous examples:** Cloud pull request #107 met the same miss and left it, because the job was report-only in the old cloud repository.
- **Recommendation:** C.
- **Action:** fix after merge, apply C, because it needs a reproduction and a budget choice.
