# Linux CI Runner Size

Status: Active. On branch `calummoore/linux-ci-runner-size-plan`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Five Linux jobs build the Rust workspace and run the verification suites.
Four are the Repository, Viewer, browser shard, and Static delivery jobs of
`.github/workflows/ci.yml`. The fifth is the Testbox job of
`.github/workflows/blacksmith-testbox.yml`, which prepares the runners of
the remote gate. All five run on `blacksmith-8vcpu-ubuntu-2404`.

On 2026-10-26 the user raised the four CI jobs from 2 to 8 vCPUs for a
limited time, until the Rust build cache of
[PR #215](https://github.com/mokly-ai/mokly/pull/215) and the other CI speed
work landed. [PR #216](https://github.com/mokly-ai/mokly/pull/216) made the
raise. PR #215 merged on 2026-10-27. On the same day the user saw a cached
comparison in PR #216 and kept the Linux jobs on 8 vCPUs for the time being.
The user also kept the CI Windows native job on 8 vCPUs instead of 16,
because with the Rust build cache 16 vCPUs gave no speed-up.

On the same day the user asked that the Testboxes match the CI suite jobs and
stay aligned, so that a remote gate takes the time and cost of CI. So the
Testbox job moved to 8 vCPUs too.

The follow-up item
[linux-ci-runner-size.md](follow-ups/linux-ci-runner-size.md) asks for the
move back to 2 vCPUs. It asks to measure the cached job times on 2 vCPUs
first. When 2 vCPUs make CI much slower, the user sees both times before the
change. The CI runs of 2026-10-27 already gave these times, and 2 vCPUs make
CI much slower. On 2026-11-01 the user chose 4 vCPUs in decision 1, and a
fresh measurement of 2 and 4 vCPUs first in decision 2.

The change moves the five jobs to `blacksmith-4vcpu-ubuntu-2404`. It aligns
the docs, the `actionlint` labels, and the runner size test, and it measures
the tier before the merge. It also deletes the follow-up item.

Out of scope:

- The CI Windows native job. It stays on 8 vCPUs under the user's decision
  of 2026-10-27.
- The macOS native job. It uses the smallest macOS tier, 6 vCPUs.
- The design attribution matrix. It keeps its own 8-vCPU exception, which
  is older than the raise.
- The Runtime profile and Required CI jobs. They already use 2 vCPUs.
- The CI job limits and the 30-minute Testbox job guard. They stay, and
  milestone 3 checks them on the chosen tier. The follow-up item
  [remote-testbox-timeout.md](follow-ups/remote-testbox-timeout.md) owns
  the guard.

No brainstorm ran. The follow-up item and the user's decisions of 2026-10-26
and 2026-10-27 choose the approach. The approach measures and compares the
tiers. Then it moves the jobs, or it keeps them when the user chooses so.

Evidence goes under `.context/linux-ci-runner-size/`. Its `measurements.md`
holds the job times, the billed minutes, and the cost estimates of
decision 1.

Contract owners:

- [CI workflow graph](../docs/protocol/ci-workflow.md#job-execution): the
  runner tiers and the job limits.
- [Testbox execution](../docs/protocol/remote-verification-testbox.md#workflow):
  the Testbox runner.
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md#test-concurrency):
  the concurrency example names a CI runner size.
- The [verification scripts README](../scripts/verification/README.md#workflow-syntax):
  the `actionlint` label list stays aligned with the workflow runners.

## Decisions

Decisions 1 and 2 were asked on 2026-11-01, and the user answered both on the
same day. Decision 2 came from the report message and had no options check.

Decision 1 went through the options check of the `plans` skill. The check
rewrote the root question and added options F, G, and H. It brought back two
approaches from **Left out** and kept the recommendation C. It also corrected
the length of the billing sample. Its notes are under
`.context/linux-ci-runner-size/options-check/`.

### 1. The runner tier of the Linux suite jobs

Decision 1 (2026-11-01, the user): option C, `blacksmith-4vcpu-ubuntu-2404`
for the four Linux CI suite jobs and the Testbox job. Rejected: A, B, D, E,
F, G, and H.

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `.github/workflows/ci.yml:64`, `:111`, `:159`, and `:264`,
  `.github/workflows/blacksmith-testbox.yml:24`, and
  `docs/protocol/ci-workflow.md:115-119`.
- **Terms:**
  - **Blacksmith:** the CI runner provider. Its runner labels name the size,
    for example `blacksmith-8vcpu-ubuntu-2404`.
  - **Testbox:** a Blacksmith runner that the remote gate prepares with
    `.github/workflows/blacksmith-testbox.yml`. It runs one suite command.
  - **Remote gate:** `cargo xtask check` on seven Testboxes, one for each
    suite command. Agents run it before they push.
  - **Rust build cache:** the Cargo registry and dependency builds that CI
    saves on `main`. Each CI job that runs Cargo, and each Testbox, restores
    it.
  - **Slowest job:** the CI job of a run that finishes last. It sets the time
    until the run gives its result.
- **Background:**
  - Between the merges of PR #215 and PR #216, CI runs with the Rust build
    cache ran on both tiers. These are their median job minutes, 2 vCPUs
    against 8 vCPUs:
    - Repository: 10.2 against 5.6.
    - Viewer: 9.5 against 4.4.
    - Browser shard: 15.9 against 10.4.
    - Static delivery: 14.2 against 7.6.
  - The slowest job of a run took 19.4 minutes on 2 vCPUs and 12.7 minutes
    on 8 vCPUs. On `main` since then, the slowest job has an 8-vCPU median
    of 12.6 minutes.
  - In 15 of those 24 `main` runs, the CI Windows native job finished last.
    A smaller Linux tier changes the result time only when a Linux job then
    finishes after it.
  - On 8 vCPUs, the browser shards and Static delivery keep about a quarter
    of the CPU busy at the median. The Viewer job keeps about 60 percent
    busy. On 2 vCPUs, every suite job keeps 72 to 97 percent busy.
  - Blacksmith can move a runner one tier up for free. The memory of each
    sample VM shows that no sample job got such an upgrade.
  - One remote gate on 8 vCPUs had a longest Testbox of 13.3 minutes. Two
    gates on 2 vCPUs without the cache had 23.3 and 27.4 minutes.
  - From 2026-10-29 00:00 to 2026-11-01 15:25 UTC, the Linux suite jobs
    billed 5,614 minutes and 448 Testboxes billed 3,753 minutes. All ran on
    8 vCPUs.
  - Blacksmith's list price is $0.016 a minute at 8 vCPUs, $0.008 at 4, and
    $0.004 at 2. So the five jobs cost about $1,235 per 30 days.
  - No run used 4 vCPUs. A model in which part of each job scales with the
    vCPU count gives 4-vCPU estimates. Each job takes its 8-vCPU time plus
    one third of the gap to its 2-vCPU time:
    - Repository: 7.1.
    - Viewer: 6.1.
    - Browser shard: 12.2.
    - Static delivery: 9.8.
  - The low CPU use on 8 vCPUs suggests that the model overstates the 4-vCPU
    times of the browser shards and Static delivery.
- **Problem:** The raise was for a limited time, and the Rust build cache has
  landed. But on 2 vCPUs the slowest job of a CI run still takes about 6 to
  7 minutes longer. The follow-up item asks the user to choose when 2 vCPUs
  make CI much slower.
- **Impact if no action:** CI and the Testboxes keep the 8-vCPU price after
  the limited time that the user set. At list price, that is about $488 to
  $725 more per 30 days than the smaller tiers.
- **Root question:** Which balance of result time and cost should CI and the
  remote gate have, now that the Rust build cache has landed?
- **Options:**
  - **A.** Keep 8 vCPUs. CI and the remote gate stay as fast as today. They
    keep costing about $1,235 per 30 days at list price. Effort: Small.
  - **B.** Move the five jobs to 2 vCPUs, as the follow-up item says. This
    saves about $725 per 30 days. The slowest CI job takes about 19 instead
    of 13 minutes. The longest Testbox of a remote gate takes about 20
    instead of 13 minutes. The slowest Testboxes can take 24 to 26 minutes,
    near their 30-minute guard. Effort: Small.
  - **C.** Move the five jobs to 4 vCPUs, `blacksmith-4vcpu-ubuntu-2404`. The
    model estimates a saving of about $488 per 30 days. The slowest CI job
    then takes about 15 minutes, and the longest Testbox about 16 minutes.
    Milestone 3 measures these estimates before the merge. Effort: Small.
  - **D.** Move the five jobs to 2 vCPUs, and split the slowest suites into
    more jobs. Examples are eight browser shards and one Static delivery job
    for each delivery mode. The result time then nears today's at about the
    cost of B. This changes the shard count, the required reports, and the
    seven remote gate commands. It needs its own plan. Effort: Large.
  - **E.** Move the five jobs to Blacksmith's ARM64 Linux runners, for
    example `blacksmith-4vcpu-ubuntu-2404-arm`. ARM64 costs 37.5 percent less
    per minute at each size, and Testboxes support it. ARM64 runners have
    less memory: 12 GB at 4 vCPUs, against 16 GB on x64. The suites then stop
    running on x64 Linux, and their ARM64 speed is unmeasured.
    Effort: Medium.
  - **F.** Give each CI suite job the smallest tier that keeps the result
    time. For example, the browser shards and Static delivery use 4 vCPUs,
    and Repository and Viewer use 2. The Testbox workflow gets one job for
    each CI suite job, and `xtask` warms up each Testbox with `--job` for its
    command. The model gives about 5 percent less cost than C at about its
    speed. Each Testbox then also gets the Rust build cache of its own CI
    job. This changes the `xtask` warmup, the Testbox workflow, and the
    one-job rule of the Testbox protocol. What `--job` does with the other
    jobs of the workflow is unconfirmed. Effort: Medium.
  - **G.** Keep the chosen tier, and skip the four browser shards and Static
    delivery when a change touches only `plans/`. `Required CI` then accepts
    these skipped jobs for such a change only. The options check counted 451
    of the 5,614 CI minutes on such runs, about 8 percent. That is about
    5 percent of the cost of the five jobs, with no slowdown. This changes
    the fail-closed rule of `Required CI` and the report count of the
    aggregate. A CI script sorts the changed paths, and a test runs that
    script. Effort: Medium.
  - **H.** Keep 8 vCPUs, and run two Playwright workers in each browser shard
    and each browser Testbox. One sample of browser shard 1/4 suggests about
    15 percent less time for each shard. That saves about 10 percent of the
    cost of the five jobs, at the speed of A or better. This changes the rule
    of the CI suite evidence protocol that worker limits are never relaxed to
    meet a timing target. Two workers can make the five-second preview load
    fail more often, and nobody has measured that. Effort: Medium.
- **Left out:**
  - 16 vCPUs or more. It fails the goal of a fair cost, because it doubles
    the price per minute of A. The Windows job finished last in 15 of the 24
    `main` runs, so faster Linux jobs rarely shorten a run. With the cache,
    the Windows job was not faster on 16 vCPUs than on 8.
  - Different tiers for CI and the Testboxes. It breaks the user's decision
    of 2026-10-27 that each Testbox matches its CI job.
  - GitHub-hosted runners. They break the same decision, because only
    Blacksmith provides Testboxes. The trade is large: the repository is
    public, so GitHub's standard 4-vCPU Linux runners cost nothing. The CI
    suite jobs billed 5,614 of the 9,367 minutes of the sample. Only a change
    to the alignment decision can bring this approach back.
- **Assumptions:**
  - The CI Windows native job stays on 8 vCPUs. Source: the user's decision
    of 2026-10-27. Kept.
  - Each Testbox matches the CI job of its command. Source: the user's
    decision of 2026-10-27. Kept.
  - All CI suite jobs share one runner. Source: the Testbox protocol and
    `tests/ci_testbox_alignment.test.ts`. This is a mechanism, not the
    user's choice. F drops it.
  - Every change runs every suite job. Source: the `Required CI` rule of the
    CI workflow protocol. G drops it.
  - Each browser shard runs one Playwright worker. Source: the CI suite
    evidence protocol. H drops it.
  - Every suite keeps all of its tests. Source: the CI workflow protocol.
    Kept.
  - The CI job limits and the 30-minute Testbox guard stay. Source: the
    three-times rule of the CI workflow protocol and the follow-up item
    `remote-testbox-timeout.md`. Kept. Milestone 3 checks both.
  - The raise was for a limited time. Source: the user's decision of
    2026-10-26. A and H drop it.
  - The suites run on x64 Linux. Source: the runner labels of the workflows.
    E drops it.
- **Wider fix:** None. The tier is one label in each job. The runner rule of
  the CI workflow protocol and the runner size test already hold each tier.
- **Previous examples:**
  - [PR #116](https://github.com/mokly-ai/mokly/pull/116) moved every
    workflow to the smallest Blacksmith tiers on 2026-09-22.
  - On 2026-10-21 the user raised the Repository and Viewer job limits to 75
    and 40 minutes instead of buying larger runners.
  - PR #216 raised the Linux suite jobs to 8 vCPUs on 2026-10-27. In its
    decision of that day, the user kept them and the Windows job on 8 vCPUs.
    The rejected options were 16 vCPUs for Windows and a return to the old
    runners.
- **Related:**
  - The follow-up item `remote-testbox-timeout.md` waits for this answer. Its
    measurement of the Testbox suites must run on the chosen tier.
  - Open [PR #212](https://github.com/mokly-ai/mokly/pull/212) moves the
    runner size test to Rust. Design call 4 says which change carries the
    tier.
- **Recommendation:** C, because the model gives 4 vCPUs two thirds of the
  saving of B for one third of its slowdown. The low CPU use on 8 vCPUs and
  the Windows job, which often finishes last, suggest an even smaller
  slowdown. Milestone 3 measures this before the merge. D gives both the
  speed of A and the cost of B, but it is a separate redesign of the suite
  split.
- **Action:** ask the user, because C changes the runner rule of the CI
  workflow protocol, which the decision of 2026-10-26 does not cover.

### 2. Measure today's code before the change

Decision 2 (2026-11-01, the user): option C, two manual CI runs at the same
time, one on 2 vCPUs and one on 4 vCPUs. Milestone 3 runs them first.
Rejected: A, no new run, B, one 2-vCPU run only, and D, C with one remote
gate on each tier.

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** Design call 1 of this plan.
- **Background:** The 2-vCPU times of decision 1 come from runs of
  2026-10-27. Since then, the 8-vCPU times on `main` have barely changed.
  Option C of decision 1 rests on a model only. A manual CI run on a scratch
  branch can use any tier. The follow-up item needs the user's permission for
  such a run.
- **Problem:** Decision 1 uses 2-vCPU times that are five days old and a
  4-vCPU estimate that no run has measured.
- **Impact if no action:** The user chooses from these figures. Milestone 3
  then measures the chosen tier on the branch. It stops when a job misses its
  figure by more than a quarter.
- **Root question:** Does the user want measured times on today's code before
  the change?
- **Options:**
  - **A.** Start no run now. Effort: Small.
  - **B.** Start one manual CI run on 2 vCPUs. It takes about 20 minutes and
    costs about $1.20 at list price. Effort: Small.
  - **C.** Start two manual CI runs at the same time, one on 2 vCPUs and one
    on 4 vCPUs. They take about 20 minutes and cost about $2.50.
    Effort: Small.
  - **D.** Do C, and also run one remote gate on each tier. This takes about
    30 minutes and costs about $4. Effort: Small.
- **Left out:** A run on 8 vCPUs. The 24 `main` runs since 2026-10-27 already
  measure that tier.
- **Wider fix:** None, because this is a one-time measurement.
- **Previous examples:** PR #216 measured both tiers before the user chose on
  2026-10-27.
- **Related:** Decision 1 can change when the runs miss its figures.
- **Recommendation:** C, because one 20-minute wait replaces the 4-vCPU model
  with measured times for about $2.50.
- **Action:** ask the user, because the follow-up item needs the user's
  permission to run CI for a measurement.

## Design Calls

Each call is the orchestrator's own, made on 2026-11-01.

1. **Decide from the existing runs.** The follow-up item suggests one manual
   CI run on 2 vCPUs before the comparison. The CI runs between the merges of
   PR #215 and PR #216 already give cached times on both tiers for the same
   code. The memory of each sample VM shows that each job ran on its own
   tier. Decision 1 uses these runs, so the user answers once. Milestone 3
   then measures the chosen tier on the current code. Decision 2 of the user
   then added a fresh measurement of both tiers before the change.
2. **The other CI speed work.** The follow-up item does not name it.
   [PR #211](https://github.com/mokly-ai/mokly/pull/211), which starts every
   CI job at once, and PR #215 merged. PR #170, a Turbo build cache, closed
   without a merge. So this plan treats the condition of the raise as met.
3. **Keep the runner size test.** The `testing` skill says that workflow
   YAML literals never get a test. But `tests/workflow_runner_sizes.test.ts`
   is the only check of the runner rule. On 2026-10-26 the user approved its
   move to Rust in PR #212. So the change updates its table and keeps it.
4. **Coordinate with PR #212.** PR #212 deletes
   `tests/workflow_runner_sizes.test.ts` and ports it to
   `xtask/tests/repository_rules/workflows/runner_sizes_tests.rs`. It is open
   and conflicts with `main`. When it merges first, milestone 2 updates the
   Rust test. When this change merges first, PR #212 carries the new tier
   into its Rust test, as it did for PR #216.
5. **Delete the follow-up item.** The branch that fixes an item deletes its
   file. So milestone 4 deletes it. It also rewrites the line of
   `remote-testbox-timeout.md` that links to the item.
6. **Measure, then stop or go on.** Under decision 2, two scratch runs measure
   2 and 4 vCPUs first. One manual CI run on this branch then measures the
   change itself. The push runs of the Testbox workflow give the Testbox
   preparation time. The three CI runs and the remote gate cost about $5 at
   list price. Raising a job limit needs the user, so a break of the
   three-times rule stops the work.
7. **Smoke-test the Testbox tier before the merge.** The remote gate takes
   the Testbox workflow from `main`, unless `MOKLY_TESTBOX_REF` names another
   ref. So one remote gate with that variable set to the branch tests the new
   tier. It needs a Blacksmith key, such as the `BLACKSMITH_ORG_TOKEN` of a
   cloud workspace. When the session has no key, the user runs it.
8. **Scratch runs before the commit.** The result of the scratch runs can
   still change decision 1. Milestones 1 and 2 touch other files, so the
   implementors do them while the scratch runs go on. Nothing of milestones
   1 and 2 is committed until the scratch runs pass the stop rules.
9. **The orchestrator prepares the scratch branches.** The two scratch
   branches are measurement inputs that never merge. Each changes a few
   labels and test lines. So the orchestrator prepares them in separate Git
   worktrees, and the implementors do milestones 1 and 2.

## Milestone 1: Documentation and protocol

Depends on: none

- [ ] `docs/protocol/ci-workflow.md`, the runner paragraph of Job Execution:
      the Linux CI jobs that compile Rust use 4 vCPUs, because 4 vCPUs give
      most of the speed of 8 vCPUs at half the price per minute. Keep the
      8-vCPU rule of the Windows native job and the reason against 16 vCPUs.
- [ ] `docs/protocol/remote-verification-testbox.md:14`: name
      `blacksmith-4vcpu-ubuntu-2404` as the runner of the CI suite jobs.
- [ ] `docs/protocol/ci-suite-evidence.md:60-62`: the concurrency example
      names the 4-vCPU CI runner, not an 8-vCPU CI runner. A 2-vCPU or 4-vCPU
      runner runs two Node test files and one Playwright worker. An
      eight-CPU workstation runs four.
- [ ] Run the Markdown check named in `AGENTS.md`.

## Milestone 2: Workflows and the runner size test

Depends on: none

- [ ] Change the runner size test first. It is
      `tests/workflow_runner_sizes.test.ts`, or its Rust port when PR #212
      has merged.
  - [ ] Give the five entries of `LARGER_LINUX_RUNNERS` the label
        `blacksmith-4vcpu-ubuntu-2404`.
  - [ ] Run the test, and see it fail on the 8-vCPU labels of the workflows.
- [ ] `.github/workflows/ci.yml`: set `runs-on` of the `repository`,
      `viewer`, `browser`, and `static-delivery` jobs to
      `blacksmith-4vcpu-ubuntu-2404`.
- [ ] `.github/workflows/blacksmith-testbox.yml`: set `runs-on` of the
      `testbox` job to the same label.
- [ ] Add `blacksmith-4vcpu-ubuntu-2404` to `.github/actionlint.yaml` in
      sorted order. Keep `blacksmith-8vcpu-ubuntu-2404`, because the design
      matrix uses it.
- [ ] Run the targeted tests of `tests/workflow_runner_sizes.test.ts`,
      `tests/actionlint_config.test.ts`, `tests/ci_testbox_alignment.test.ts`,
      and `tests/ci_timing_policy.test.ts`, or of their Rust ports.
- [ ] Run `actionlint` from the repository root.
- [ ] Run the early check: `cargo xtask check --suite repository`.

## Milestone 3: Measure the tier

Depends on: 2. The scratch runs of decision 2 depend on nothing, so they
start first.

Its evidence goes to `.context/linux-ci-runner-size/scratch-runs.md` and
`.context/linux-ci-runner-size/branch-run.md`.

- [ ] Decision 2: create `calummoore/runner-size-measure-2vcpu` and
      `calummoore/runner-size-measure-4vcpu` from this branch, each in its own
      Git worktree. Each holds the workflow, `actionlint`, and runner size
      test changes for its tier.
- [ ] Push both branches. Each push starts a push run of the Testbox workflow,
      which gives the Testbox preparation time on its tier.
- [ ] Start one CI run on each branch at the same time with
      `gh workflow run ci.yml --ref {branch}`. Wait until both end.
- [ ] Collect the job and step times with the scripts under
      `.context/linux-ci-runner-size/`. Read the VM memory of each job with
      `check_real_sizes.py`. Blacksmith can move a runner one tier up for
      free, so leave each upgraded job out.
- [ ] Compare the 4-vCPU jobs with their figures in decision 1. Compare the
      2-vCPU jobs with the runs of 2026-10-27.
- [ ] Check the three-times rule of `docs/protocol/ci-workflow.md`. Each CI
      job limit must allow three times the measured 4-vCPU job time.
- [ ] Estimate the 4-vCPU box time of each remote gate command. Add the
      Testbox preparation time, the suite step time of its CI job, and one
      minute for the probe and the report download.
- [ ] Before any commit of milestones 1 and 2, stop and give the user the
      measured times when one of these holds:
  - A 4-vCPU job breaks the three-times rule.
  - The median 4-vCPU browser shard or another 4-vCPU suite job takes more
    than a quarter longer than its figure in decision 1.
  - A 4-vCPU box estimate reaches the 30-minute Testbox guard.
  - A suite fails on 4 vCPUs, and the failure does not occur on 8 vCPUs.
- [ ] Delete both scratch branches and their worktrees.
- [ ] Commit milestones 1 and 2 with Conventional Commits, and push this
      branch. The push starts a push run of the Testbox workflow on 4 vCPUs.
- [ ] Start one CI run on this branch:
      `gh workflow run ci.yml --ref calummoore/linux-ci-runner-size-plan`.
      Wait until it ends. Apply the same checks and stop rules to it.
- [ ] Smoke-test the new Testbox tier with one remote complete gate:
      `MOKLY_TESTBOX_REF=calummoore/linux-ci-runner-size-plan cargo xtask check --executor remote`.
      When the session has no Blacksmith key, ask the user to run it.
- [ ] When the work stops, record the user's answer under decision 1, and add
      a milestone for the work that the answer needs.
- [ ] Add one line under this milestone that names each evidence file.

## Milestone 4: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Rewrite the line of `plans/follow-ups/remote-testbox-timeout.md` that
      links to `linux-ci-runner-size.md`. Without the link, it says which tier
      the Testbox job uses since this change. Its measurement under option C
      runs on that tier.
- [ ] Delete `plans/follow-ups/linux-ci-runner-size.md`, and name it in the
      commit message.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`. The
      remote gate of milestone 3 counts when it ran on the final tree.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives these parts:
  - Decisions 1 and 2 and the design calls of this plan, with their dates.
  - The measured times on 2, 4, and 8 vCPUs.
  - The job times of the pull request's own CI run, as a second sample. Add
    them when that run ends.
  - A permalink to this plan.
  - The follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

None. The follow-up item `remote-testbox-timeout.md` owns the later
measurement of the Testbox suites on the new tier.
