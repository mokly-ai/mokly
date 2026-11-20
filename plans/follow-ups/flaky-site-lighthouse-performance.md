# Site Lighthouse performance flakes near its threshold

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Source:** Design.
- **Category:** Performance.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325.
- **Location:**
  - `.github/workflows/ci.yml:629`: the `site-lighthouse` job. `.github/workflows/ci.yml:705`: the `required` job, Required CI, whose `needs` list leaves that job out.
  - `apps/site/src/lighthouse.ts:34` and `:50`: the throttling profiles of option A. `:91`: `THRESHOLDS`, whose performance entry option C replaces. `:122`: `measurementWithRetry`, the retry that option B replaces. Option E adds a score rule.
  - `apps/site/scripts/lighthouse.mjs:45-101`: the audit loop, the category scores that it reads, and the shortfall lines. Options B, C, and E change it.
  - `apps/site/tests/lighthouse.test.ts:24-105`: the tests of the audited pages, the CPU multiplier, the retry, and the thresholds. Options B, C, and E change them.
  - `docs/protocol/cloud/site-delivery.md:165-182`: the Performance Budget requirement. Options B, C, and E change it. Option D keeps it.
  - `apps/site/README.md:128`, `:251`, and `:258`: the command table and the Key Code entries of the budget. Options B, C, and E update them.
  - `apps/site/tests/site_ci.test.ts:62`: the test that no Lighthouse result can fail Required CI. Every option keeps it.
  - `apps/site/src/components/home/Stage.astro` and `apps/site/scripts/stage.mjs`: the sandboxed stage frame of the home page, and the script that publishes its documents. Option D starts there.
- **Reason:** The user reserved the choice of option and caps, and the recommended option D is product work beyond this evidence update.

- **Terms:**
  - **Audit:** one Lighthouse run of one route at one width, which gives one score for each category.
  - **Budget run:** one run of `npm run site:lighthouse`, which audits 6 routes at 2 widths and prints one table of results.
  - **Selected result:** the printed audit result for a route and width, using the retry when the first audit fails.
  - **CLS:** cumulative layout shift measures movement during loading across frames, while main-frame CLS measures only the top document.
  - **Transfer and decoded bytes:** transfer bytes count encoded responses and Chrome's response overhead, while decoded bytes count decompressed response bodies.
- **Background:**
  - The `site-lighthouse` job, Site Lighthouse, makes one budget run on the GitHub-hosted `ubuntu-24.04` runner.
  - On 2026-11-19, PR #350 moved the job there from a Blacksmith runner, under the runner decision of main PR #342.
  - The budget audits `/`, `/docs/`, `/docs/authoring/config/`, `/docs/cli/serve/`, `/changelog/`, and `/terms/` at 390 px and 1440 px.
  - The thresholds are performance ≥ 0.95, accessibility = 1, best practices ≥ 0.95, and SEO ≥ 0.95.
  - The performance score checks first contentful paint, largest contentful paint, Speed Index, and total blocking time. It also checks layout stability.
  - The tables use FCP for first contentful paint, LCP for largest contentful paint, and TBT for total blocking time.
  - Both widths use simulated throttling with a fixed CPU slowdown multiplier of 1. The 390 px audit uses slow 4G, and the 1440 px audit uses 40 ms round trips at 10 Mbps.
  - `measurementWithRetry` audits a route and width once more when the first result misses any threshold. Only that second result then counts.
  - A budget run with a failing selected result exits 1. It prints one line for each shortfall, such as `site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold.`
  - The job is report-only. Required CI does not need it, so no Lighthouse result can fail Required CI.
  - A failed budget run still fails its own job, which shows as a failed check and keeps its report as an artifact.
  - `docs/protocol/cloud/site-delivery.md` keeps the job report-only "because measured scores vary between runs on shared runners".
  - The home page embeds a sandboxed stage frame that shows a published mockup. At 1440 px, the frame is `/stage/project-created.desktop.html`.
- **Problem:** Home at 1440 px missed the 0.95 performance threshold in 40 of 87 complete CI budget runs. It missed in 3 of 9 local budget runs. CLS alone penalized each failing local result. Whole-page CLS was about 0.168, and main-frame CLS was 0. The cause remains unknown. Host timing can still affect layout.
- **Impact if no action:** Each failure shows a failed check and can need a rerun. Repeated failures can obscure a new regression.
- **Root question:** How should site checks detect real regressions with stable pass or fail results?
- **Options:**
  - **A.** Keep Lighthouse's simulated throttling and fixed CPU multiplier of 1. These settings already apply at both widths, with one conditional retry. CI passed 47 of 87 budget runs. Local budget runs passed 6 of 9. A adds no new control for the observed shift. Effort: Small.
  - **B.** Run each audit three times and judge the median score of each category, in place of the one retry. B keeps every current metric. In three local groups of three budget runs, the medians of the first audits passed once. B needs two passing audits in three, and the retry needs one in two. Locally, 5 of 9 first home audits at 1440 px failed. Each local budget run took 75 to 86 seconds, and B triples its audits to 36. Effort: Small.
  - **C.** Replace the performance-score threshold with per-route caps on total transfer bytes, script transfer bytes, and requests, from the `resource-summary` audit. The cap table below gives candidate values. Keep the other three thresholds and the report-only status, and print the performance score as a diagnostic only. C stops checking load timing and layout shift, so a page that shifts or loads slowly can pass. C does not fix the shift. Effort: Medium.
  - **D.** Find the source of the shift outside the main frame with repeated local budget runs. If the runs confirm a source in the page, remove the shift there. Keep the 0.95 threshold, the retry, the other three thresholds, and the report-only status. Judge D by the CLS of each audit, because a CLS of 0.143 still passes. A confirmed fix comes with a deterministic regression test for the shift. If users cannot see the shift, or the page cannot remove it, D returns to the user. D is product work beyond this item, and its pass rate is not known. Effort: Medium.
  - **E.** Keep the score check, but compute the performance score with main-frame CLS in place of whole-page CLS. Every timing metric still counts. E drops the protection against shifts inside frames. It needs a custom score rule beside the Lighthouse score, and a protocol change. Its pass rate is not measured, although main-frame CLS was 0 in all 14 local home audits at 1440 px. Effort: Medium.
- **Left out:**
  - Lowering the performance threshold. The user explicitly excluded it, and the score would still vary between audits of one build.
  - Removing the whole job. It fails the goal, because nothing then measures performance. The three other category checks, which never varied, also go.
  - A dedicated or faster runner. It breaks the rule of `docs/protocol/ci-workflow.md:130` that every job runs on a GitHub-hosted standard runner.
  - Applied throttling. It fails the goal, because each timing metric then depends on the speed of the shared runner.
  - Warm-cache audits. They fail the goal, because they stop measuring a first visit with an empty cache.
  - Blocking the stage frame in the audit. It fails the goal, because the audit then measures a page that users never get.
  - More retries. They fail the goal, because the result still changes between runs, and they hide the shift more often.
  - Shared by every option: the job stays report-only, and the other three thresholds stay, as `docs/protocol/cloud/site-delivery.md` requires. A, B, C, and E leave page rendering unchanged. The original item listed audit-policy changes. D permits a page investigation.
- **Wider fix:** None yet, because the cause of the shift is not known. C changes what the check protects, and it does not fix the shift.
- **Previous examples:** The CI table below confirms main commits `940ddd742`, `b32f3e907`, and `3f01b5f4e`, plus PRs #373, #386, and #390. The History section keeps the original PR #350 failure and rerun.
- **Recommendation:** D. It seeks to keep the current performance coverage of load timing and layout stability. It replaces the first recommendation, C, after the local CLS evidence. C stays the measured resource-budget alternative if D stops.
- **Action:** ask the user, because the user reserved this choice, and D widens the approved scope to product work.

## History

- 2026-11-19: The item was added with the kind Fix after merge, Effort Small, and Confidence Medium. Its recommended option C had Effort Medium.
- Its Reason was "The flake needs a reproduction across several runs, which the move of the cloud did not need."
- Its Problem was that on 2026-11-19 the job failed once with "site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold" for route `/`, and passed on the rerun of the same commit.
- Its Action was "fix after merge, apply C, because it needs a reproduction and a budget choice." Its wider fix was C, "because a resource budget cannot flake on speed".
- 2026-11-20: The evidence below corrected three claims. The thresholds are not 0.95 for each category, because accessibility needs 1. The evidence does not show that "the score depends on runner speed". Required CI does not fail when the job fails.
- 2026-11-20: The user said that C removes a check and adds new checks, so the item waits for the user's answer. The user asked for a pull request that changes only this item before any check changes.
- 2026-11-20: An options check added D and E. The recommendation changed from C to D after the local CLS evidence. C stays as an option.

## CI evidence, 2026-11-20

The sample is the latest 100 CI workflow runs at 2026-11-20 09:54:07 UTC. They were created from 00:31:00 to 09:50:23 UTC. `apps/site/src/lighthouse.ts`, `apps/site/scripts/lighthouse.mjs`, and `.github/workflows/ci.yml` each had one SHA-256 across the 97 checkout commits of the completed jobs.

| Sample                                     | Count         |
| ------------------------------------------ | ------------- |
| Workflow runs                              | 100           |
| Runs with a Site Lighthouse job            | 99            |
| Job attempts, manual reruns included       | 104           |
| Attempts cancelled before a complete table | 15            |
| Attempts still in progress                 | 2             |
| Complete budget runs, with all 12 rows     | 87            |
| Passed complete budget runs                | 47, or 54.02% |
| Failed complete budget runs                | 40            |

- First job attempts alone passed 44 of 83, or 53.01%. Complete manual reruns passed 3 of 4, or 75%. Reruns follow failures, so their rate does not predict a fresh run.
- Each failure was `/` at 1440 px with performance 0.93, and it was the only shortfall of its run.
- Home performance at 1440 px was 0.93 in 40 runs, 0.95 in 16, and 1.00 in 31. At 390 px it was 0.99 in 75 and 1.00 in 12.
- Every other route, width, and category scored 1.00 in all 87 runs.
- The logs print selected results to two decimals. They hold no first result of a retried audit, no metric values, and no resource data.
- No checkout commit has three complete budget runs, so CI gives no rate for B. The logs have no resource data, so CI gives no rate for C.
- Workflow runs 44653906270, 44659114871, 44684057706, and 44695615601 have complete same-commit reruns. Three went from 0.93 to a pass. The PR #386 commit failed both times with 0.93.

The six reported cases:

| Case             | Job attempts                                                                                                                                                                                                                                                                                                                                                                           | Home 1440 px performance | Outcome                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| main `940ddd742` | [44691435898/1](https://github.com/mokly-ai/mokly/actions/runs/44691435898/job/136138164470)                                                                                                                                                                                                                                                                                           | 0.93                     | Failed                                                       |
| main `b32f3e907` | [44690830103/1](https://github.com/mokly-ai/mokly/actions/runs/44690830103/job/136136175803)                                                                                                                                                                                                                                                                                           | 0.93                     | Failed, and the workflow run was cancelled                   |
| main `3f01b5f4e` | [44683096617/1](https://github.com/mokly-ai/mokly/actions/runs/44683096617/job/136110919438)                                                                                                                                                                                                                                                                                           | 0.93                     | Failed, and the workflow run was cancelled                   |
| PR #373          | [44653843273/1](https://github.com/mokly-ai/mokly/actions/runs/44653843273/job/136015113011), [44659297634/1](https://github.com/mokly-ai/mokly/actions/runs/44659297634/job/136033261979), [44661928033/1](https://github.com/mokly-ai/mokly/actions/runs/44661928033/job/136042081987)                                                                                               | 0.93, 0.93, 0.93         | Failed on three different head commits                       |
| PR #386          | [44695615601/1](https://github.com/mokly-ai/mokly/actions/runs/44695615601/job/136151529415), [44695615601/2](https://github.com/mokly-ai/mokly/actions/runs/44695615601/job/136165589505)                                                                                                                                                                                             | 0.93, 0.93               | Failed, and the same-commit rerun failed again               |
| PR #390          | [44701659818/1](https://github.com/mokly-ai/mokly/actions/runs/44701659818/job/136171254828), [44702843604/1](https://github.com/mokly-ai/mokly/actions/runs/44702843604/job/136175409360), [44704259351/1](https://github.com/mokly-ai/mokly/actions/runs/44704259351/job/136180040439), [44709326261/1](https://github.com/mokly-ai/mokly/actions/runs/44709326261/job/136196703137) | 0.93, 0.93, 0.93, 1.00   | Failed three times, then passed on a later head `2d74f745d6` |

## Local evidence, 2026-11-20

- One build of commit `e5acd1a25355139eeaa4559b3fed0ade35afabee`. The site and audit sources are the same at `4eb342907`.
- Node 24.21.0, npm 11.21.0, Lighthouse 13.4.1, and Playwright 1.61.1 with Chromium 149.0.7827.55, on Linux with 4 vCPUs of an AMD Ryzen 7 9700X.
- `npm ci`, `npm run build`, `npm run mockups:build`, and `npm run site:build` passed.
- Nine budget runs then ran one after another, each as `npm run lighthouse --workspace @mokly-cloud/site`.
- A capture hook only saved each raw Lighthouse result. It changed no argument or setting.
- Each budget run started a fresh Chrome profile. Lighthouse reset the cache and the storage before each audit.
- No test, build, or artificial load ran at the same time.
- The nine budget runs made 113 audits: 108 first audits and 5 retries. Each budget run took 75 to 86 seconds.

| Measure                                                       | Passed | Rate  |
| ------------------------------------------------------------- | ------ | ----- |
| Budget runs as they run now, with the retry                   | 6 of 9 | 66.7% |
| Budget runs judged on first audits only                       | 4 of 9 | 44.4% |
| B: category medians of first audits in runs 1–3, 4–6, and 7–9 | 1 of 3 | 33.3% |

- Runs 2, 3, and 4 failed, each with home performance 0.93 at 1440 px.
- The B medians of home performance at 1440 px were 0.93, 0.93, and 0.95.
- A median of the selected results passed 2 of 3 groups, but it uses the extra audits that the retry hides.
- Every other score was 1, except home performance: 0.99 or 1 at 390 px, and 0.93, 0.95, or 1 at 1440 px.
- Nine ordered budget runs and three groups are a small sample. They do not predict CI rates.

### The home page at 1440 px

| Performance | Whole-page CLS               | Audits |
| ----------- | ---------------------------- | ------ |
| 0.93        | 0.1684331753 to 0.1684948324 | 8      |
| 0.95        | 0.143188                     | 3      |
| 1           | 0.000012                     | 3      |

| Run 1 audit | Performance | Whole-page CLS            | Main-frame CLS | FCP, LCP, and Speed Index | TBT  | Transfer bytes | Requests |
| ----------- | ----------- | ------------------------- | -------------- | ------------------------- | ---- | -------------- | -------- |
| First       | 0.93        | 0.1684331753, scored 0.70 | 0              | 243.95 ms                 | 0 ms | 392097         | 15       |
| Retry       | 1           | 0.00001212477             | 0              | 247.28 ms                 | 0 ms | 392097         | 15       |

- All 14 home audits at 1440 px had main-frame CLS 0 and TBT 0 ms.
- Their FCP, LCP, and Speed Index were 243.32 to 256.87 ms, and those metrics and TBT scored 1. So only CLS lowered the failing scores.
- CLS uses the recorded page-load trace. Its computation does not apply the simulated CPU multiplier. Host timing can still affect layout.
- Whole-page CLS counts frames too. So a main-frame CLS of 0 puts the counted shift outside the top document.
- The only frame document that the page requests at 1440 px is the stage frame.
- Lighthouse names no consistent element or cause for the largest shift.
- The evidence does not show why only some loads shift, or that runner CPU speed alone causes it. Frame timing or other page behaviour can cause it.

### Resources

- Transfer bytes come from the `resource-summary` audit. Decoded bytes are the `resourceSize` values of the `network-requests` audit.
- Astro preview compresses text responses. Small files and the font transfer more bytes than they decode to, because of the response overhead.
- The values include the network requests of the main page and of each recorded frame, also when the frame sandbox stops a script.
- They leave out non-network URLs and an Other-type `/favicon.ico` request. The one Other request in the tables is `/favicon.svg`.
- They leave out other routes, frames that the browser never requested, and resources that only an interaction loads.
- Across 113 audits, resource values and request URLs stayed constant within each route and width. No request was a cache hit or went to a third party.
- A frame or an island that loads late can change which requests enter an audit. The stable values do not prove that this never happens.

| Route                     | Width | Audits | Transfer bytes | Decoded bytes | Script transfer bytes | Requests |
| ------------------------- | ----- | ------ | -------------- | ------------- | --------------------- | -------- |
| `/`                       | 390   | 9      | 392076         | 498305        | 6231                  | 15       |
| `/`                       | 1440  | 14     | 392097         | 498376        | 6231                  | 15       |
| `/docs/`                  | 390   | 9      | 87426          | 270143        | 74029                 | 15       |
| `/docs/`                  | 1440  | 9      | 87426          | 270143        | 74029                 | 15       |
| `/docs/authoring/config/` | 390   | 9      | 89434          | 279525        | 74029                 | 15       |
| `/docs/authoring/config/` | 1440  | 9      | 89434          | 279525        | 74029                 | 15       |
| `/docs/cli/serve/`        | 390   | 9      | 88772          | 273667        | 74029                 | 15       |
| `/docs/cli/serve/`        | 1440  | 9      | 88772          | 273667        | 74029                 | 15       |
| `/changelog/`             | 390   | 9      | 28289          | 126901        | 1149                  | 4        |
| `/changelog/`             | 1440  | 9      | 28289          | 126901        | 1149                  | 4        |
| `/terms/`                 | 390   | 9      | 14040          | 52444         | 1149                  | 4        |
| `/terms/`                 | 1440  | 9      | 14040          | 52444         | 1149                  | 4        |

Each cell below gives transfer bytes / decoded bytes [requests]. "Both" marks a route whose two widths are equal. Image, media, and third-party requests are 0 everywhere.

| Route, width                    | Script              | Stylesheet        | Font                | Document           | Other         |
| ------------------------------- | ------------------- | ----------------- | ------------------- | ------------------ | ------------- |
| `/`, 390                        | 6231 / 9327 [2]     | 20808 / 79942 [9] | 352792 / 352240 [1] | 11252 / 56352 [2]  | 993 / 444 [1] |
| `/`, 1440                       | 6231 / 9327 [2]     | 20808 / 79942 [9] | 352792 / 352240 [1] | 11273 / 56423 [2]  | 993 / 444 [1] |
| `/docs/`, both                  | 74029 / 204015 [11] | 5492 / 22716 [2]  | 0 [0]               | 6912 / 42968 [1]   | 993 / 444 [1] |
| `/docs/authoring/config/`, both | 74029 / 204015 [11] | 5492 / 22716 [2]  | 0 [0]               | 8920 / 52350 [1]   | 993 / 444 [1] |
| `/docs/cli/serve/`, both        | 74029 / 204015 [11] | 5492 / 22716 [2]  | 0 [0]               | 8258 / 46492 [1]   | 993 / 444 [1] |
| `/changelog/`, both             | 1149 / 598 [1]      | 3101 / 13499 [1]  | 0 [0]               | 23046 / 112360 [1] | 993 / 444 [1] |
| `/terms/`, both                 | 1149 / 598 [1]      | 3101 / 13499 [1]  | 0 [0]               | 8797 / 37903 [1]   | 993 / 444 [1] |

### Option C candidate caps

- Each maximum covers both widths and every local audit of the route, retries included.
- A byte cap is `ceil(1.2 × maximum / 1024) × 1024`, which rounds up to a whole KiB of 1024 bytes.
- A request cap is `ceil(1.2 × maximum)`, which rounds up to a whole request.
- So each margin is at least 20%. The rounding gives the small script caps larger margins: 31.47% on `/`, and 78.24% on `/changelog/` and `/terms/`.

| Route                     | Audits | Transfer bytes, maximum → cap | Script transfer bytes, maximum → cap | Requests, maximum → cap |
| ------------------------- | ------ | ----------------------------- | ------------------------------------ | ----------------------- |
| `/`                       | 23     | 392097 → 471040               | 6231 → 8192                          | 15 → 18                 |
| `/docs/`                  | 18     | 87426 → 105472                | 74029 → 89088                        | 15 → 18                 |
| `/docs/authoring/config/` | 18     | 89434 → 107520                | 74029 → 89088                        | 15 → 18                 |
| `/docs/cli/serve/`        | 18     | 88772 → 107520                | 74029 → 89088                        | 15 → 18                 |
| `/changelog/`             | 18     | 28289 → 34816                 | 1149 → 2048                          | 4 → 5                   |
| `/terms/`                 | 18     | 14040 → 17408                 | 1149 → 2048                          | 4 → 5                   |

- The transfer margins are 20.13% to 23.99%. The request margins are 20% for 15 requests and 25% for 4 requests.
- All 113 local audits and all 9 budget runs fit these caps by construction. That is not an independent test of the caps.
- C keeps accessibility = 1, best practices ≥ 0.95, SEO ≥ 0.95, and the report-only status. It lowers no threshold.
- The user can accept these caps or give other margins.
