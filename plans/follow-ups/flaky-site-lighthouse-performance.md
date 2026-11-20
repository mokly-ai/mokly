# Site Lighthouse performance flakes near its threshold

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325. Updated on 2026-11-20 with two more failures from the branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds`. The update also corrects the impact, the thresholds, the branch name, and option A. It sets Confidence to High, because three recorded failures each passed one rerun.
- **Location:** The `site-lighthouse` job of `.github/workflows/ci.yml` and the `lighthouse` script of `apps/site`.
- **Reason:** The flake needs a reproduction across several runs, which the move of the cloud did not need.

- **Background:** The `site-lighthouse` CI job scores the site with Lighthouse and fails below 0.95 on each category, except accessibility, which fails below 1.0. The PR #350 branch moved this job from a Blacksmith runner to the GitHub-hosted `ubuntu-24.04` runner under the runner decision of main PR #342. The list below gives more facts.
  - The `Required CI` job of `.github/workflows/ci.yml` does not list `site-lighthouse` in its `needs`. The `main` branch rule requires only the `Required CI` check, as `docs/ops/repository-cutover.md` says. `docs/protocol/cloud/site-delivery.md` makes the Lighthouse budget report-only, so it never blocks the required aggregate.
  - The `site-lighthouse` job sets `continue-on-error: false`. So its failure still makes the whole `CI` workflow run fail until a rerun passes.
  - `measurementWithRetry` in `apps/site/src/lighthouse.ts` measures a route and viewport again only when the first result misses a threshold. It returns the second result. So each failure text below means two misses in a row in one job.
  - On 2026-11-20 the job failed twice more on the branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds`, in the step `Run Lighthouse budget`, with the same text: `site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold.` Each time, the printed table showed that every other route and viewport passed. `Required CI` passed in the same run and validated 5 verification reports with 5,468 observed test results. One rerun of the `site-lighthouse` job passed on the same commit, and the workflow run then ended in success.
    - Commit `2772eca024a938746426dfd1243152964c4a4d87`, a merge of `main` into the branch: run 44684057706, attempt 1, job 136114064879. `Required CI` was job 136122540836. The job id of the rerun is not recorded.
    - Commit `969133546bc8f030f4f1c87d20eec8921497d7a7`: run 44724325009, attempt 1, job 136247781837. `Required CI` was job 136258316015. The rerun was job 136260270412.
  - Between the two failures, the job passed on commit `33b63f5aa1c7a1e820ccdd4eea31bbdf7c76a48b` of the same branch, in run 44708037057, job 136192422162.
  - That branch changes no file under `apps/site` or `.github`. The first failure, in the **Problem** below, came from another branch.
  - The suspected source stays the speed of the shared GitHub-hosted runner.
- **Problem:** On 2026-11-19 the job failed once with "site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold" for route `/`, and passed on the rerun of the same commit. The score depends on runner speed.
- **Impact if no action:** The `CI` workflow run fails now and then on unrelated changes, and each failure costs a rerun. The failure blocks neither `Required CI` nor the merge, because `Required CI` does not depend on the `site-lighthouse` job.
- **Root question:** How does the performance budget measure the site without depending on the speed of a shared runner?
- **Options:**
  - **A.** Keep the current measurement. Both viewports already use Lighthouse's simulated throttling with a fixed CPU slowdown multiplier of 1, in `apps/site/src/lighthouse.ts` and `apps/site/scripts/lighthouse.mjs`. This is not an unimplemented fix. It was in force during the 2026-11-20 failures and did not prevent them. Effort: Small.
  - **B.** Run the audit three times and take the median score. Effort: Small.
  - **C.** Replace the performance score with budgets on the measured resources, such as bytes and request counts, which do not depend on speed. Effort: Medium.
- **Left out:** Lowering the threshold, because it loosens a check of live behaviour without a decision.
- **Wider fix:** C, because a resource budget cannot flake on speed.
- **Previous examples:** None found.
- **Recommendation:** C.
- **Action:** fix after merge, apply C, because it needs a reproduction and a budget choice.
