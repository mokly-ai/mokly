# Review Tests Against The Shared Test Skills

Status: Active. On branch `calummoore/test-skills-guidelines-review`, no pull
request yet. The pull request that completes the review deletes this plan,
as the `plans` skill says.

Mokly uses Rust tests, Node tests, and Playwright browser specs. The shared
`testing` and `deterministic-tests` skills define which tests earn their
cost and how tests give reliable results. This review checks the existing
tests against those rules. It measures their cost and reports gaps in
behaviour coverage.

The user requested this plan on 2026-10-30. The requested approach is a
review against the test skills. Use the suite audit procedure in
`testing/references/test-audit.md`. The review changes no product code,
tests, fixtures, runner settings, or requirements. Later branches implement
approved changes. This plan does not authorize test removal or new gates.

Contract owners:

- The installed shared `testing` skill and its audit, removal, browser,
  snapshot, and property-test references.
- The installed shared `deterministic-tests` skill.
- [Developer test commands](../docs/protocol/developer-test-commands.md).
- [CI verification](../docs/protocol/ci-verification.md) and
  [repository checks](../docs/protocol/ci-verification-repository.md).
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md),
  [test timing](../docs/protocol/ci-test-timing.md), and
  [repository inputs](../docs/protocol/ci-test-repository-inputs.md).
- The [task runner README](../xtask/README.md),
  [verification scripts README](../scripts/verification/README.md),
  [browser README](../tests/browser/README.md), and
  [CLI tests README](../crates/mokly-cli/tests/README.md).

## Design calls

- 2026-10-30, agent call: Review all test areas. The user requested a test
  review without an area limit. Sampling cannot establish suite alignment.
- 2026-10-30, agent call: Separate the audit from fixes. The audit procedure
  requires a report before changes. Preserve all existing checks during it.
- 2026-10-30, agent call: Read four complete weeks of successful `main` CI
  runs. Extend the window when a week has no comparable successful run.
- 2026-10-30, agent call: Use measurements to order inspection work. Keep
  findings in severity order and show potential savings in a separate table.
- 2026-10-31, agent call: Read every protocol page for the baseline. Tests
  also depend on requirements that no area README links.

No user decision is needed to write this plan. Future recommendations can
need decisions under the shared decision and review skills.

## Scope and evidence

Review the complete discovered Node inventory under `tests/`,
`packages/viewer/tests/`, and `packages/ui/tests/`. Review browser specs
under `tests/browser/`, including shared journeys and static delivery runs.
Review Rust unit, integration, and documentation tests under `crates/` and
`xtask/`. Include feature-gated and platform-specific targets. Identify the
optional design attribution matrix separately from required gate coverage.

Read fixtures, helpers, scripts, snapshots, and workflow configuration as
context for those tests. Include gate checks when they duplicate tests or
act as tests of source text. Review optional benchmarks only to confirm
their separation from required correctness checks.

Save evidence under `.context/test-skills-guidelines-review/`. Store the
branch review reports under `.context/reviews/` as the review skill says.
Keep inventories, raw output, measurements, and full reports out of this
plan. No review search result is a finding until code inspection confirms
its meaning and its affected requirement.

## Milestone 1: Documentation and requirement baseline

Depends on: none

Completed: 2026-10-31. The baseline records the current requirements,
test inventory, and unresolved policy questions.

Establish the rules used by the review. This milestone reads the current
requirements. It changes no protocol requirement or README behaviour.

- [x] Record the code commit, installed skill revisions, and review date.
      Read `testing`, `deterministic-tests`, `rust`, and `typescript`.
- [x] Read every test reference named above. Read each area's README and
      relevant product protocol before reviewing its tests.
- [x] Map gate suites, discovery rules, exclusions, optional targets, and
      platform coverage from the runner code and verification contracts.
- [x] Read existing test follow-up items and the active shell views plan.
      Preserve recorded decisions and option letters. Link repeated issues
      to their existing items instead of creating duplicates.
- [x] Record requirement gaps and conflicting rules for user decisions.
      Continue independent review work without choosing an unstated rule.

Evidence: `baseline.md`, `inventory.csv`, `milestone-1/protocol-read-notes.md`,
and `milestone-1/handoff.md` under the evidence directory.
Merge preservation: `orchestrator-verification/main-merge.md`.

## Milestone 2: Measure test cost and CI trend

Depends on: 1

Use complete evidence for one tree. Separate test body time, fixture setup,
build time, and whole-job time. Do not infer savings from test counts.

- [ ] Record runtime versions, operating system, CPU count, concurrency,
      commit, command, result counts, and evidence completeness.
- [ ] Use a complete successful CI report set for the reviewed tree when
      available. Otherwise run `cargo xtask check` once and retain its output.
- [ ] Keep the required Node inventory, CI browser shards or local
      unsharded run, static delivery modes, and native systems distinct.
      Do not double-count shared specs or repeated verification jobs.
- [ ] Obtain per-file time and test counts from one complete report set.
      Mark missing Rust, optional-target, or fixture timings explicitly.
      Measure missing groups separately without claiming a single-run total.
- [ ] Rank files by time within comparable groups. Name the files that
      account for 50 percent and 80 percent of each group's measured time.
- [ ] Read successful `main` runs with
      `gh run list --branch main --workflow ci.yml --json databaseId,createdAt,conclusion`.
      Read job details with `gh run view {id} --json jobs`.
- [ ] Report weekly median job times. Keep operating systems, runtimes,
      and workflow configurations separate. Mark expired or missing data.
- [ ] Record failures, skips, unmatched filters, and incomplete evidence.
      Never treat a partial run or a rerun pass as a complete baseline.

Evidence: `measurements/` and `ci-trend.md` under the evidence directory.

## Milestone 3: Review test value and coverage

Depends on: 1, 2

Inspect expensive groups first, then cover the remaining inventory. Give
each test a requirement, a realistic defect it catches, and a review result.

- [ ] Map each test to observable behaviour or a past defect. Name the
      public entry point and the lowest effective test level.
- [ ] Find duplicate requirements, repeated input cases, repeated host
      runs, and tests above the required level. Preserve distinct contracts.
- [ ] Identify tests of doc prose, workflow literals, harness internals,
      trivial accessors, and copied constants. Keep valid link and
      generated-file drift checks distinct from prose checks.
- [ ] Identify one-time equivalence, migration, stress, performance, and
      third-party-tool proofs that became permanent tests.
- [ ] Inspect assertions for exact results and typed errors. Find expected
      values computed by the tested code and values that only test a double.
- [ ] Check conditional assertions, empty loops, missing-resource paths,
      and filters that match zero tests. Confirm each path checks behaviour
      or reports an explicit failure or skip.
- [ ] Check whether unit tests cross real disk, process, database, clock,
      or network boundaries. Distinguish valid integration coverage.
- [ ] Review snapshot scope, stable data, and meaningful expected values.
      Review property tests for useful generators and independent results.
- [ ] For each removal candidate, name the surviving requirement coverage,
      its level, the proposed defect proof, measured cost, and risk.
      Identify candidates that remove the last test of a requirement.
- [ ] Record missing coverage with a concrete defect that current tests
      would miss. Do not request one test for each mode or input kind.

Evidence: `coverage-map.csv` and `value-review.md` under the evidence directory.

## Milestone 4: Review deterministic and browser behaviour

Depends on: 1, 2

Review test reliability across the full inventory. Milestones 3 and 4 can
use separate read-only reviewers when the delegation independence test holds.
Keep measurement commands and the complete gate separate from other runs.

- [ ] Find elapsed-time assertions, fixed sleeps, retries, and speed
      assumptions. Distinguish allowed timestamps, timeout outcomes,
      polling deadlines, duration diagnostics, and runner hang guards.
- [ ] Check documented timeout allowances and the accepted large React
      watch exception. Do not propose longer limits as race fixes.
- [ ] Check timer installation, readiness signals, event order, captured
      inputs, and operation counts where the requirement needs them.
- [ ] Check temporary paths, ports, Git history, random seeds, locale,
      time zone, shared mutable state, and cleanup after setup failure.
- [ ] Check browser locators, user-visible assertions, awaited calls,
      state-based waits, context isolation, console errors, and routing.
      Check screenshot use only where layout is the requirement.
- [ ] Check each second host, static delivery mode, and native platform
      against the distinct requirement it protects.
- [ ] Link recorded flakes to existing follow-up items. When investigation
      needs repetition, record pass and fail counts with the source evidence.
      Do not add retries, sleeps, quarantine, or runner configuration changes.
- [ ] Recommend fake clocks, explicit readiness, isolated state, captured
      inputs, event order, or operation counts for confirmed timing risks.
      Keep every required correctness assertion in each proposed fix.

Evidence: `reliability-review.md` and `reproductions/` under the evidence directory.

## Milestone 5: Report findings and prepare later work

Depends on: 3, 4

Finish the review with a complete disposition of the inventory. Report
recommendations for decisions. Do not apply code or test changes here.

- [ ] Reconcile every discovered test with the coverage and reliability
      maps. List reviewed, compliant, actionable, and blocked areas.
- [ ] Group related findings by requirement or shared cause. Use the
      `decisions-and-findings` layout and the `implementation-review` checks.
      Run a fresh finding check for each new finding before reporting it.
- [ ] Give each group its protected requirement, affected tests, retained
      tests, measured cost, risk, options, and recommended action.
      Prefer structural fixes over new detection rules.
- [ ] Order findings by severity. Add a savings table in descending measured
      cost order. Mark estimates and overlapping savings explicitly.
- [ ] Present all user decisions together. Preserve unanswered decisions
      as open. They block dependent changes, not the audit report.
- [ ] Create or update follow-up items for unresolved findings and later
      changes. Include the complete context and evidence references.
- [ ] Require approved removal branches to prove duplicate coverage with
      an assertion failure before deletion. Restore deliberately broken code.
      Follow `testing/references/removing-tests.md` for every removal.
- [ ] Require later fixes to follow failing-first proof, targeted checks,
      test cost reporting, and the complete gate. Run each new asynchronous
      or browser test 10 times and retain the pass counts.

Evidence: `audit-report.md` under the evidence directory. Persistent open
work lives under `plans/follow-ups/`. The final pull request keeps the summary.

## Milestone 6: Verification, commit, review, and pull request

Depends on: 1, 2, 3, 4, 5

Close the audit after the report and handoff are complete. The initial
plan-only commit runs Markdown checks and leaves these milestones open.

- [ ] Validate Markdown with `npm run format:check` and the Markdown link
      test. Review the diff. No new product feature needs a smoke test.
      Use the plan-only gate exception for Markdown changes. Report the
      measurement baseline separately from change verification.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` after the push
      with the `implementation-review` skill. Check new findings. Apply its
      review-fix rule, record follow-up items, and re-review once after fixes.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Include the audit summary, dated design calls,
      decisions, evidence limits, follow-up items, and a permalink to this plan.
