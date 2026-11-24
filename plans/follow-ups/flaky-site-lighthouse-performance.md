# Site Lighthouse performance misses 0.95 on two routes

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Source:** Design.
- **Category:** Performance.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s` (PR #350), CI run 44596520325.
- **Location:**
  - `.github/workflows/ci.yml:629`: the `site-lighthouse` job. `.github/workflows/ci.yml:703`: the `required` job, Required CI, whose `needs` list leaves that job out.
  - `apps/site/src/lighthouse.ts:34` and `:50`: the throttling profiles of option A. `:81`: `AUDITED`, the audited routes. `:96`: `THRESHOLDS`, whose performance entry option C replaces and option G restores to 0.95. `:138`: `measurementWithRetry`, the retry that option B replaces. Option E adds a score rule.
  - `apps/site/scripts/lighthouse.mjs:44-102`: the audit loop, the category scores that it reads, and the shortfall lines. Options B, C, and E change it.
  - `apps/site/tests/lighthouse.test.ts:25-145`: the tests of the audited pages, the CPU multiplier, the retry, the thresholds, and the skipped audit. Options B, C, E, and G change them.
  - `docs/protocol/cloud/site-delivery.md:126-147`: the Performance Budget requirement. Options B, C, E, and G change it.
  - `apps/site/README.md:169`, `:355`, and `:366`: the command table and the Key Code entries of the budget. Options B, C, and E update them.
  - `apps/site/tests/site_ci.test.ts:58`: the test that no Lighthouse result can fail Required CI. Every option keeps it.
  - `apps/site/src/pages/pricing.astro` and `apps/site/src/pages/changelog.astro`: the two routes under 0.95. Option G works there.
  - `apps/site/src/pages/index.astro`: the home page. It draws its demos as static components at build time and embeds no frame. #488 deleted the sandboxed stage frame, the script that published its documents, and the code and tests that options D and F named.
- **Reason:** #488 removed the stage frame, so options D and F no longer apply. The user set the 0.9 threshold only until this item is decided, so the user must choose again.

- **Terms:**
  - **Audit:** one Lighthouse run of one route at one width, which gives one score for each category.
  - **Budget run:** one run of `npm run site:lighthouse`, which audits 7 routes at 2 widths and prints one table of results.
  - **Selected result:** the printed audit result for a route and width, using the retry when the first audit fails.
  - **CLS:** cumulative layout shift measures movement during loading across frames, while main-frame CLS measures only the top document.
  - **Transfer and decoded bytes:** transfer bytes count encoded responses and Chrome's response overhead, while decoded bytes count decompressed response bodies.
- **Background:**
  - The `site-lighthouse` job, Site Lighthouse, makes one budget run on the GitHub-hosted `ubuntu-24.04` runner.
  - On 2026-11-19, PR #350 moved the job there from a Blacksmith runner, under the runner decision of main PR #342.
  - The budget audits `/`, `/docs/`, `/docs/authoring/config/`, `/docs/cli/serve/`, `/changelog/`, `/pricing/`, and `/terms/` at 390 px and 1440 px.
  - The thresholds were performance ≥ 0.95, accessibility = 1, best practices ≥ 0.95, and SEO ≥ 0.95.
  - On 2026-11-24, the Canvas redesign (PR #488) gave the same two performance scores in CI runs 45343539672 and 45347529329 and in one local run: `/changelog/` at 390 px scored 0.94, and `/pricing/` at 1440 px scored 0.93. Each other route scored 0.96 or more, the home 0.96 at 390 px and 1.00 at 1440 px. The Canvas home no longer embeds the stage frame.
  - On 2026-11-24, Cal asked for rules that make the budget pass for now. The performance threshold is 0.9 until this item is decided. The other thresholds stay. Each option below names its own threshold.
  - The performance score checks first contentful paint, largest contentful paint, Speed Index, and total blocking time. It also checks layout stability.
  - The tables use FCP for first contentful paint, LCP for largest contentful paint, and TBT for total blocking time.
  - Both widths use simulated throttling with a fixed CPU slowdown multiplier of 1. The 390 px audit uses slow 4G, and the 1440 px audit uses 40 ms round trips at 10 Mbps.
  - `measurementWithRetry` audits a route and width once more when the first result misses any threshold. Only that second result then counts.
  - A budget run with a failing selected result exits 1. It prints one line for each shortfall, such as `site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold.`
  - The job is report-only. Required CI does not need it, so no Lighthouse result can fail Required CI.
  - A failed budget run still fails its own job, which shows as a failed check and keeps its report as an artifact.
  - `docs/protocol/cloud/site-delivery.md` keeps the job report-only "because measured scores vary between runs on shared runners".
  - Until #488, the home page embedded a sandboxed stage frame that showed a published mockup. At 1440 px, the frame loaded seven external stylesheets and one local font.
- **Problem:** Since #488, two routes miss the 0.95 threshold in each recorded run.
  - Until #488, home at 1440 px missed 0.95 in 40 of 87 complete CI budget runs. Chrome sometimes counted a layout shift in the stage frame that it never painted. #488 removed that frame, and home now scores 1.00 at 1440 px.
  - Since #488, `/pricing/` at 1440 px scores 0.93 and `/changelog/` at 390 px scores 0.94. Six CI runs gave the same two scores: runs 45343539672 and 45347529329 of the #488 pull request, which kept them after the retry, and the four `main` runs from #488 to #491, 45376909082, 45386552420, 45390552358, and 45405201390. One local run gave them too. These misses are stable, not flaky.
  - In the same four `main` runs, `/docs/authoring/config/` at 390 px scored 0.96 each time, and `/` at 390 px scored 0.96 to 0.99.
  - The metric that lowers each of the two scores is not known yet.
- **Impact if no action:** With the 0.9 threshold, a regression that lowers any route from 0.95 to 0.9 passes unnoticed. With 0.95, the job fails on every run.
- **Root question:** How should site checks detect real regressions with stable pass or fail results?
- **Options:**
  - **A.** Keep Lighthouse's simulated throttling, the fixed CPU multiplier of 1, and the one conditional retry, with 14 audits for 7 routes at 2 widths. Since #488, A fails every run at 0.95, because the two misses repeat after the retry. At 0.9, A is the lasting lowering that the user excluded on 2026-11-20. Before #488, CI passed 47 of 87 budget runs, and local budget runs passed 6 of 9. Effort: Small.
  - **B.** Run each audit three times and judge the median score of each category, in place of the one retry. B keeps every current metric and triples the audits to 42 for the 7 routes. A median cannot raise a miss that repeats in each audit, so since #488 B fails every run at 0.95, and at 0.9 it is the lasting lowering. Its median can still join G against the variance that remains. Before #488, in three local groups of three budget runs, the medians of the first audits passed once, and each local budget run of 12 audits took 75 to 86 seconds. Effort: Small.
  - **C.** Replace the performance-score threshold with per-route caps on total transfer bytes, script transfer bytes, and requests, from the `resource-summary` audit. Keep the other three thresholds and the report-only status, and print the performance score as a diagnostic only. C stops checking load timing and layout shift, so a page that shifts or loads slowly can pass. The cap table below dates from 2026-11-20: it covers six routes before #488 and has no cap for `/pricing/`. So C first measures a new seven-route baseline, and its caps come from that baseline. Effort: Medium.
  - **D.** Obsolete since 2026-11-24, because #488 removed the stage frame. D read: find the source of the shift outside the main frame with repeated local budget runs. If the runs confirm a source in the page, remove the shift there. Keep the 0.95 threshold, the retry, the other three thresholds, and the report-only status. Judge D by the CLS of each audit, because a CLS of 0.143 still passes. A confirmed fix comes with a deterministic regression test for the shift. If users cannot see the shift, or the page cannot remove it, D returns to the user. D is product work beyond this item, and its pass rate is not known. On 2026-11-20, D stopped, because users cannot see the shift. D does not apply as a visible page fix. Effort: Medium.
  - **E.** Keep the score check, but compute the performance score with main-frame CLS in place of whole-page CLS. Every timing metric still counts. E drops the protection against shifts inside frames, such as the sample frames of the docs pages. It needs a custom score rule beside the Lighthouse score, and a protocol change. Neither `/pricing/` nor `/changelog/` renders a frame, so E changes neither miss: since #488 it fails every run at 0.95, and at 0.9 it is the lasting lowering. Before #488, main-frame CLS was 0 in all 14 local home audits at 1440 px. Effort: Medium.
  - **F.** Obsolete since 2026-11-24, because #488 removed the stage frame and its publication code. PR #431 built F, and it closed without a merge. F read: publish each stage document with its seven stylesheets inline, in their order and with rebased URLs, in place of copied external stylesheets. The font stays a separate local file. Keep every check, the 0.95 threshold, the retry, the job, the empty sandbox, the three hidden documents that are never fetched, the copy, and the final design. F avoids the trigger in Chrome, and it does not fix a visible defect. It changes the Home Stage publication requirement. In a focused prototype, 10 of 10 home audits at 1440 px scored 1.00. The full proof and a deterministic regression test are pending. Effort: Medium.
  - **G.** Measure `/pricing/` at 1440 px and `/changelog/` at 390 px with focused audits, and find the metric that lowers each score. Fix that cause in the page, and restore the 0.95 threshold, with 14 audits and the one retry. G keeps every check. The cause is not known yet, and a page fix can change the design. At 0.95, `/docs/authoring/config/` at 390 px and `/` at 390 px keep a margin of only 0.01 in some runs, so G measures them too, and B can join G when they flake. Effort: Medium.
- **Left out:**
  - Lowering the performance threshold for good. On 2026-11-20 the user excluded it. On 2026-11-24 the user set 0.9 only until this item is decided.
  - Removing the whole job. It fails the goal, because nothing then measures performance. The three other category checks, which never varied, also go.
  - A dedicated or faster runner. It breaks the rule of `docs/protocol/ci-workflow.md:130` that every job runs on a GitHub-hosted standard runner.
  - Applied throttling. It fails the goal, because each timing metric then depends on the speed of the shared runner.
  - Warm-cache audits. They fail the goal, because they stop measuring a first visit with an empty cache.
  - More retries. They fail the goal, because the result still changes between runs, and they hide a real regression more often.
  - Waiting for a Chrome fix. It fails the goal of stable results for an unknown time.
  - The approaches that this item left out for the stage frame no longer apply, because #488 removed the frame: blocking the frame in the audit, one combined external stylesheet, hiding the stage content until its styles apply, and eager loading of the stage documents or `allow-same-origin`.
  - Since #488, only C and G can pass at 0.95, because A, B, and E cannot raise a miss that repeats in each audit. A, B, and E stay listed, so that the user can drop them in the same answer.
  - Shared by every option: the job stays report-only, and the other three thresholds stay, as `docs/protocol/cloud/site-delivery.md` requires. A, B, C, and E leave page rendering unchanged. G changes the two pages only where the measurement finds the cause.
- **Wider fix:** None in this repository. The frame shift that defined the class left with #488, and G fixes each new miss at its cause.
- **Previous examples:** The CI table below confirms main commits `940ddd742`, `b32f3e907`, and `3f01b5f4e`, plus PRs #373, #386, and #390. The History section keeps the original PR #350 failure and rerun.
- **Recommendation:** G. The two misses repeat in each run, so a measurement can find their cause, and a page fix restores the 0.95 threshold without a weaker check. It replaces F, which #488 made obsolete. C stays the resource-budget alternative, after a new seven-route baseline.
- **Action:** ask the user, because G restores the 0.95 threshold that the user lowered to 0.9 until this item is decided, and its page fix can change the design.

## History

- 2026-11-19: The item was added with the kind Fix after merge, Effort Small, and Confidence Medium. Its recommended option C had Effort Medium.
- Its Reason was "The flake needs a reproduction across several runs, which the move of the cloud did not need."
- Its Problem was that on 2026-11-19 the job failed once with "site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold" for route `/`, and passed on the rerun of the same commit.
- Its Action was "fix after merge, apply C, because it needs a reproduction and a budget choice." Its wider fix was C, "because a resource budget cannot flake on speed".
- 2026-11-20: The evidence below corrected three claims. The thresholds are not 0.95 for each category, because accessibility needs 1. The evidence does not show that "the score depends on runner speed". Required CI does not fail when the job fails.
- 2026-11-20: The user said that C removes a check and adds new checks, so the item waits for the user's answer. The user asked for a pull request that changes only this item before any check changes.
- 2026-11-20: An options check added D and E. The recommendation changed from C to D after the local CLS evidence. C stays as an option.
- 2026-11-20, 10:44 UTC: The user authorized D. D had to find the actual element and cause, and fix only a page defect, with the final design and copy unchanged. It had to keep the threshold, the retry, and the job, add a regression test only for a defect, and run nine budget runs after a fix. It had to stop and report if the shift was not a page defect, or if a fix needed a design or copy change.
- 2026-11-20: D stopped, because the shift is not a visible page defect. No tracked file changed. The investigation proposed F, and the recommendation changed from D to F. The user has not answered F yet.
- 2026-11-20: The user chose F, and PR #431 built it.
- 2026-11-24: #488 removed the stage frame. On the user's answer of the same day, PR #431, which built F, closed without a merge. Options D and F became obsolete, option G was added, and the recommendation changed from F to G. Options A, B, C, and E keep their measurements from before #488.
- 2026-11-24: A review of the same change gave A, B, C, E, and G their threshold, their audit count, and their limits after #488, from four more `main` runs.

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
- Lighthouse names no consistent element or cause for the largest shift. The D investigation below explains why.
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

## D investigation and F prototype, 2026-11-20

The investigation changed no tracked file. It ran local Lighthouse audits and plain Chrome loads of home at 1440 px.

| Stage frame element        | Box before the shift, y and height | Box after the shift, y and height |
| -------------------------- | ---------------------------------- | --------------------------------- |
| `header.fo-account-header` | 18 and 44                          | 0 and 48                          |
| `main.fo-account-main`     | 62 and 380                         | 48 and 532, inside the viewport   |
| `footer.fo-account-footer` | 458 and 18                         | Below the 580 px frame viewport   |

- A Chrome DevTools Protocol session on the frame resolved these elements in the renderer of the frame. Lighthouse's own attribution names unrelated top-document elements.
- The seven external stylesheets in the head of the stage document block rendering while they load. Chrome sometimes lays out the unstyled document during that wait. It then counts the styled layout as a shift from boxes that it never painted.
- 21 traces had the large shift: 8 Lighthouse audits, 12 plain Chrome loads, and 1 mapping run. None had a Paint event or a painted layout object before the shift.
- None fired `pagereveal`, the first rendering opportunity, before the first layout. In all 21, the first layout came before all seven stylesheets were parsed.
- A second pass over 33 traces confirmed the 21 large shifts and no paint before them.
- In one failing audit, the times after the HTML parse of the frame were: first layout 3.17 ms, `pagereveal` 21.27 ms, large shift 29.68 ms, first paint 29.75 ms, and the FCP mark 55.29 ms.
- So users cannot see the old positions. The exact Chrome trigger is not known. No page fix is justified under D.
- Before the prototype, 12 focused audits scored 0.93 six times, 0.95 twice, and 1.00 four times. So 6 failed, 6 passed, and 8 had a large CLS.
- Plain Chrome without a DevTools client had the large shift in 12 of 20 loads. So Chrome records it outside Lighthouse too.
- The prototype changed only a local copy of the built site. It inlined the seven stylesheets, in order, into the four stage documents, with rebased URLs. The font stayed a local file.
- With the prototype, 10 of 10 focused audits scored 1.00, each with CLS 0.00001212477 from the small font shift. None of 20 plain Chrome loads had the large shift.
- Headless screenshots of the stage figure at 1440 px and 390 px, in light and dark, had 0 different pixels. Desktop Chrome screenshots before and with the prototype showed the same layout, within antialiasing noise.
- Home at 1440 px dropped from 15 to 8 requests, and from 392097 to 384590 transfer bytes.
- Limits: the 10 prototype audits are not nine whole-site budget runs, not a production source change, and not CI proof. No regression test, repeated test runs, targeted site checks, or full gate ran. They wait for the user's approval.
- CI logs hold rounded scores only, so they do not prove that all 40 CI failures have this cause.
- On PR #398, CI run 44721416931 failed only its Site Lighthouse job, with home at 1440 px at 0.93. The Site, Preview, and both Title workflows passed. That run came before any fix and is outside the 100-run sample.

## Step 4 CI occurrences, 2026-11-20

The branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds` recorded two more failures before this integration.
Both failed in `Run Lighthouse budget` with this text:

```text
site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold.
```

- Commit `2772eca024a938746426dfd1243152964c4a4d87`: run [44684057706](https://github.com/mokly-ai/mokly/actions/runs/44684057706), attempt 1, Site Lighthouse job [136114064879](https://github.com/mokly-ai/mokly/actions/runs/44684057706/job/136114064879). Required CI job [136122540836](https://github.com/mokly-ai/mokly/actions/runs/44684057706/job/136122540836) passed. One Site Lighthouse rerun passed on the same commit. The rerun job ID was not recorded.
- Commit `969133546bc8f030f4f1c87d20eec8921497d7a7`: run [44724325009](https://github.com/mokly-ai/mokly/actions/runs/44724325009), attempt 1, Site Lighthouse job [136247781837](https://github.com/mokly-ai/mokly/actions/runs/44724325009/job/136247781837). Required CI job [136258316015](https://github.com/mokly-ai/mokly/actions/runs/44724325009/job/136258316015) passed. One Site Lighthouse rerun passed on the same commit, job [136260270412](https://github.com/mokly-ai/mokly/actions/runs/44724325009/job/136260270412).
- Each failing table showed that every other route and viewport passed. Each Required CI job validated five reports with 5,468 observed test results. Each workflow run ended in success after its one rerun.
- Between those failures, Site Lighthouse passed on commit `33b63f5aa1c7a1e820ccdd4eea31bbdf7c76a48b`, run [44708037057](https://github.com/mokly-ai/mokly/actions/runs/44708037057), job [136192422162](https://github.com/mokly-ai/mokly/actions/runs/44708037057/job/136192422162).
- Step 4 changed no `apps/site` or `.github` file before this integration.
- The branch's earlier record suspected shared-runner speed. That cause was not proven. The investigation above supersedes that hypothesis.
- This appendix preserves the branch's observations. It changes no threshold, option, recommendation, or pending decision above.

## Eager base CI occurrence, 2026-11-21

On commit `10a28ba3bc3b21816fdcdfcc9d19ab42801b8343` of PR #461,
[CI run 44906326812](https://github.com/mokly-ai/mokly/actions/runs/44906326812)
failed only Site Lighthouse. The failure was:

```text
site:lighthouse / at 1440px scored 0.93 for performance, under the 0.95 threshold.
```

Required CI passed on that commit. No site or CI source file changed in the
branch. A newer audited merge superseded the commit before a rerun. This
occurrence used no Lighthouse rerun. The user permits at most one rerun and
classifies this known Site Lighthouse failure separately from Required CI.
The item keeps its existing decision, options, recommendation, and cause limits.

On commit `487601e1e227982c3cfe6dd78c984ace2f58e8b0` of the same PR,
[CI run 44918955595](https://github.com/mokly-ai/mokly/actions/runs/44918955595),
[Site Lighthouse job 136890551428](https://github.com/mokly-ai/mokly/actions/runs/44918955595/job/136890551428)
failed with the same home-page score and threshold text above.
GitHub refused an early job rerun request while the workflow was active.
No rerun started. The performance orchestrator then instructed no rerun on
2026-11-21, because this known failure is unrelated and is outside Required CI.
The PR records the failure. No site, threshold, test, or gate changed for it.
This occurrence changes no option, recommendation, or pending decision of this item.
