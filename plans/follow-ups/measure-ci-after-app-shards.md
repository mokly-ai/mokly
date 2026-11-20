# CI time of the cloud app shards is unmeasured

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the post-merge follow-up of the plan `plans/app-browser-suite-shards.md`, on the branch `calummoore/ci-pipeline-duration`.
- **Location:** The cloud app shard jobs of `.github/workflows/ci.yml`, `packages/app/playwright.config.ts:5-22`, `:38` and `:40`, `xtask/src/check/cloud_commands.rs`, `packages/app/src/_tests_/members.ts:55-79`, `crates/mkc-auth/src/links.rs:37-38`, and the Cloud Suites section of `docs/protocol/ci-verification.md`.
- **Reason:** The measurement needs CI runs on `main` of this repository after its CI runs the cloud jobs, which no branch can produce.

- **Terms:**
  - **App browser suite:** The Playwright tests in `packages/app/src/_tests_/**/*.spec.ts`, which drive the exported web app against a real `mkc-api` and Postgres.
  - **App shard job:** One of the four CI jobs that run `cargo xtask check --suite cloud-app --shard n/4`. Each job builds its own web export and runs one partition of the App browser suite. Shard 1 also runs the app logic tests. In the old cloud repository, job `n` ran `cargo xtask app-check` with `MKC_APP_SHARD=n/4`.
  - **Passed first attempt:** A CI run whose first attempt passed, with no rerun.
  - **Runner minutes:** The sum of the times of all jobs of one CI run.
  - **Sign-in rate limit:** The API admits one sign-in link for each email address and 20 for each client address in each minute, at `crates/mkc-auth/src/links.rs:37-38`.
- **Background:**
  - On 2026-11-17 the cloud moved from `mokly-ai/mokly-cloud` into this repository, `mokly-ai/mokly`. The old repository is frozen, and its CI no longer runs. In this repository, the cloud checks are suites of `cargo xtask check`. The cloud Rust tests run in the `cloud-rust` suite, apart from the shared Repository checks. The facts below about the old CI jobs App checks, Workspace checks and Mockup checks are history.
  - Before the shard change, one CI job of the old repository, App checks, ran the whole App browser suite. The CI workflow starts its jobs at the same time, so the slowest job sets the total.
  - The baseline is the median of the 10 passed first attempts of 31 October and 1 November 2026, in the old repository:
    - A CI run took about 33 minutes, with a range of 31 to 36 minutes.
    - App checks took 32.5 minutes.
    - Workspace checks took 11.2 minutes, and `cargo test` took 7.3 minutes of them. Mockup checks took 7.5 minutes.
    - A run used about 70 runner minutes.
  - The suite then had 371 tests. They ran one at a time against one API and one database, and took 28.0 minutes in total. Twelve tests each waited about one minute for the limit of one email address, 12.5 minutes in total.
  - The branch `calummoore/ci-pipeline-duration` made two changes:
    - Ten tests no longer sign one member in twice. `addMember` returns the member's saved session, and `switchSession` restores it. The sum of their test durations fell from 644.735 seconds to 61.875 seconds on 2026-11-02. Each changed test also passed ten repeated runs.
    - The suite runs as four App shard jobs. Each job has its own runner, Postgres and API, and builds the web app. Shard 1 also runs the app logic tests. Each job runs one test at a time.
  - On 2026-11-02, the four shards held 98, 94, 99 and 80 of the 371 tests, and each test was in exactly one shard. In local runs, shard 1 passed its 98 browser tests in 5.0 minutes, and shard 4 passed its 80 in 4.4 minutes.
  - On 2026-11-17, local runs of the four `cloud-app` shards in this repository passed 109, 101, 106 and 97 browser tests, 413 in total. Shard 1 also passed 368 logic tests and 5 script tests. Each run on a warm host took, with setup and its web build: 15m 01s, 6m 10s, 11m 42s and 5m 59s. Two native builds ran beside shard 1. These are local runs, not CI runs.
  - Two tests keep their second sign-in, because it is the behaviour under test: `settings-address-handoff.spec.ts:42` and `:143` under `packages/app/src/_tests_/`. They still wait about one minute each, in one shard.
  - The estimates before the shard change:
    - Each App shard job takes about 10 minutes. Each job has about 3 to 4 minutes of fixed work: setup, the web build and the API start.
    - CI takes about 11 to 12 minutes, and Workspace checks set the total.
    - Runner minutes stay about the same as before.
  - A model of Playwright's split by test count put the tests of the slowest shard at 8.0 minutes with three shards, 5.7 with four and 4.7 with five. Four is the smallest count that kept the slowest App shard job under Workspace checks.
  - Eighteen tests varied by 10 to 26 seconds between passed first attempts, about 1.9 minutes in each run. That fits partial waits for the limit of one client address. The estimates include these waits. They can grow after the sign-in fix, because the one-minute waits no longer reset the window of the client limit.
  - In the local run after the sign-in fix, one of the ten changed tests still took about 25 seconds, and the others took 2 to 7 seconds. That also fits a partial wait for the client limit.
  - The suite grew by about 4.5 tests each day until 2026-11-02, and by about 2.8 tests each day from then to 2026-11-17. By the estimate of 2026-11-02, the slowest App shard job would take longer than Workspace checks again in about one month.
  - The user decided these points on 2026-11-01:
    - CI uses four fixed shards. A shard count derived from the suite size waits for the real shard times that this task measures.
    - Workspace checks stay unchanged until this measurement.
    - Every pull request keeps running every CI job.
  - The plan listed these ways to make the slowest job faster. The user has not approved their implementation. Each estimate is from before the move, for the old CI.
    - Move `cargo test` into its own CI job. In this repository, the cloud Rust tests already run in their own `cloud-rust` suite.
    - Also let the scenario lock admit two or three tests at a time, use five App shards, and run Mockup checks on 4 vCPU. CI then takes about 9 minutes. The scenario lock is the `DATABASE_SCENARIO` mutex that lets only one GitHub or billing integration test of `mkc-api` use Postgres at a time.
    - Run Workspace checks on a 4-vCPU runner. The 3.7 minutes of serial scenarios do not get faster. It saves about 1 minute, and each run uses about 9 more 2-vCPU minutes.
    - Run the Rust tests with `cargo-nextest`. It adds a pinned tool, the scenario lock then needs a nextest test group, and the doc tests still need `cargo test --doc`.
    - Profile the slow serial tests: 66 GitHub scenarios at about 2.6 seconds each, and the old xtask CLI tests at 91 to 110 seconds. The gain is unknown.
    - Cut the fixed work of each job with exact-key caches, such as for the npm install and the web export. A wrong key can test a stale build. The gain is unknown, and likely under 1 minute for each job.
- **Task:**
  1. After the CI workflow of this repository runs the cloud jobs on `main`, list the CI runs on `main`. For example, run `gh run list --repo mokly-ai/mokly --workflow ci.yml --branch main --event push --limit 30 --json databaseId,attempt,conclusion,createdAt,headSha`.
  2. Take the first five runs whose first attempt passed and whose jobs include the four App shard jobs. Their `attempt` is 1 and their `conclusion` is `success`.
  3. Read the jobs of each run with `gh api "repos/mokly-ai/mokly/actions/runs/<run>/attempts/1/jobs?per_page=100"`. The time of a job is its `completed_at` minus its `started_at`. The total of a run is the time from its first job start to its last job end. The runner minutes of a run are the sum of its job times.
  4. Give the median time of each job, the median total and the median runner minutes. Name the slowest job other than the App shard jobs. Compare the App shard jobs with it, with the baseline and with the estimates above.
  5. Give the time that tests wait for the sign-in rate limit. Use recorded HTTP 429 responses and `Retry-After` waits.
     - Keep waits for one email address separate from waits for one client address. A slow test alone does not prove either cause.
     - If the five logs lack wait diagnostics, report that limit. Collect a diagnostic CI run and report its wait measurements separately.
     - Give the times of the two address-handoff tests. Label any estimate derived from test durations as an estimate.
  6. Do not change the other cloud jobs before this measurement ends. Then give the result to the user for the choice of how to make the slowest job faster, with the ways that the background lists.
  7. When the slowest App shard job is the slowest job of the run, raise with the user the choice of a shard count derived from the suite size. Do not implement it in this task.
     - A short first CI step counts the tests and starts one shard job for each fixed number of tests. The protocol then states the rule, not the number four.
     - Costs: the step adds time before the App shard jobs, the job names change with the count, and runner minutes grow with the suite without a review.
  8. Report the result to the user. Record it in the pull request description of the branch that deletes this item.
- **Impact if no action:** Nobody knows whether the shards met their estimate in the combined CI. The deferred choice for the slowest job has no data. As the suite grows, the App shard jobs can become the slowest jobs, and nobody sees it.
- **Needs:** The cloud jobs in the CI workflow of this repository, five CI runs on `main` with them whose first attempts passed, and read access to the GitHub Actions runs and logs. Measure before the repository deletes the run logs.
- **Done when:** The user has the median time of each job, the median total, the median runner minutes and the sign-in waits of the five runs, compared with the slowest other job, the baseline and the estimates. When the slowest App shard job is the slowest job of the run, the user also has the choice of a derived shard count.

Source: [the post-merge follow-up of the plan](https://github.com/mokly-ai/mokly-cloud/blob/b2151cfddb8f94c9936d17b9d317318e7cf0a1b3/plans/app-browser-suite-shards.md?plain=1#L441-L449).
