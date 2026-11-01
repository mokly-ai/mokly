# Remove Tests That No Longer Fit The Testing Skill

Status: Active. On branch `calummoore/test-skills-guidelines-review`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Mokly uses Rust tests, Node tests, and Playwright browser specs. The shared
`testing` skill says when a test earns its place. Its removal rule removes a
passing test without asking the user when one of these holds:

- A named test covers the same requirement at the same level or lower.
- The test covers only behaviour that no longer exists. The `git-commit`
  skill calls it dead code.
- The test is on the skill's list under "What never gets a test": one-time
  proofs, doc prose, plans, agent rules, skills, protocol docs, workflow
  YAML literals, and test harness internals. A link check and a drift check
  of generated files stay.

This change removes every test that the rule covers. Each removal follows
`testing/references/removing-tests.md`. The last test of a requirement and
the other cases that the reference reserves go to the user. The change adds
a test only where a removal step requires one. It changes no product
behaviour, requirement, gate, timeout, or runner setting.

The user requested a review against the test skills on 2026-10-30.
Milestone 1 recorded that baseline. On 2026-11-01 the user chose to remove
the tests directly, with no time measurement.

Contract owners:

- The installed shared `testing` skill and its removal reference.
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

## Decisions

### 1. Milestone 2 measures more than removals need

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** The former Milestone 2 of this plan.
- **Background:** The former Milestone 2 did the first two steps of the
  audit procedure in `testing/references/test-audit.md`. It took per-file
  times from one complete run and the weekly CI trend of `main`.
- **Problem:** The removal rule does not use time. Only the time of each
  removal candidate fed a removal decision.
- **Impact if no action:** The plan spends a complete run, Rust timing, and
  four weeks of CI queries on data that changes no removal.
- **Root question:** What time data do the removals need, and when?
- **Options:**
  - **A.** Keep only the build and the test lists. Remove covered tests
    directly, each with its cover proof and its time. Ask only in the
    reserved cases. Effort: Small.
  - **B.** Keep only the build and the test lists. Time only the removal
    candidates after the review. Keep one decision for each group. Effort:
    Small.
  - **C.** Keep per-file times from one complete run. Drop the CI trend.
    Effort: Medium.
  - **D.** Keep the milestone as written. Effort: Medium.
- **Left out:** Removals with no time data, because the skill asks each
  removal to state its time.
- **Wider fix:** None. The shared audit procedure asks for the trend in
  every audit, and it lives outside this repository.
- **Previous examples:** None found.
- **Recommendation:** B.
- **Answer, 2026-11-01:** "I don't think we need to time anything, lets
  just remove the tests that no longer fit the criteria." This is option A
  without the time data, the approach that the item left out. No milestone
  measures time or reads the CI trend. Removal commits and the pull request
  give no run time. Covered tests go without a decision for each group.

## Design calls

- 2026-10-30, agent call: Review all test areas. The user requested a test
  review without an area limit. Sampling cannot establish suite alignment.
- 2026-10-30, agent call: Separate the audit from fixes. The audit procedure
  requires a report before changes. Preserve all existing checks during it.
  Superseded on 2026-11-01 by decision 1.
- 2026-10-30, agent call: Read four complete weeks of successful `main` CI
  runs. Extend the window when a week has no comparable successful run.
  Superseded on 2026-11-01 by decision 1.
- 2026-10-30, agent call: Use measurements to order inspection work. Keep
  findings in severity order and show potential savings in a separate table.
  Superseded on 2026-11-01 by decision 1.
- 2026-10-31, agent call: Read every protocol page for the baseline. Tests
  also depend on requirements that no area README links.
- 2026-11-01, agent call: Drop the reliability, coverage-gap, and assertion
  reviews of the former Milestones 3 and 4. Decision 1 limits the change to
  removals. The existing follow-up items keep those issues.
- 2026-11-01, agent call: Port no test. A test that no kept test covers at
  the same level or lower stays, unless the user approves its removal.
- 2026-11-01, agent call: Merge `origin/main` before the review. Main added
  44 test files after the Milestone 1 baseline.
- 2026-11-01, agent call: Reconcile the candidates of all areas before any
  removal. A covering test stays, so two candidates never cover each other.
- 2026-11-01, agent call: Decision 1 answers an open follow-up item whose
  recommended option removes a test under the removal rule. Apply that
  option and delete the item. Other items stay open.

## Scope and evidence

Review every test that the runners discover: the Node files under `tests/`,
`packages/viewer/tests/`, and `packages/ui/tests/`, the browser specs and
case modules under `tests/browser/`, and the Rust unit, integration, and
documentation tests under `crates/` and `xtask/`. Include feature-gated and
platform-specific targets and the optional design attribution matrix. Lints,
gates, and benchmarks are not tests, so they stay.

Keep the user decisions in force that `milestone-1/decisions-xref.md`
records. Examples are the combined React large-watch journey, the Yarn
Classic configuration assertion, and the guide table tests. A removal that
an open follow-up item covers follows the last design call above.

Save evidence under `.context/test-skills-guidelines-review/`. Store the
branch review reports under `.context/reviews/` as the review skill says.
Keep candidate lists, proofs, and command output out of this plan. No search
result is a candidate until code inspection confirms it.

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

## Milestone 2: Update the baseline to current main

Depends on: 1

Bring the reviewed tree up to date before the review starts.

- [ ] Merge `origin/main` with the `git-merge` skill, and audit the merge.
- [ ] Rerun `milestone-1/scripts/run-all.sh` on the merged tree. Record the
      test files that main added, deleted, or changed.

Evidence: `milestone-2/` under the evidence directory.

## Milestone 3: Find the tests that the removal rule covers

Depends on: 2

Read-only reviewers check each area: the Node tooling tests, the viewer and
UI package tests, the browser specs, and the Rust tests. Large areas split
by file group.

- [ ] Review each test against the three removal reasons. Give each
      candidate its reason, its requirement, and its evidence.
- [ ] For a duplicate, name the covering test, its level, and one product
      break that makes both tests fail.
- [ ] For a "never" test, name its class and each product assertion that
      must move to a test of its requirement first.
- [ ] For a test of removed behaviour, give the searches that show the
      code dead under the `git-commit` skill.
- [ ] List the cases for the user apart: the last test of a requirement, a
      cover only at a higher level, and a low-value test that no removal
      reason covers.
- [ ] Reconcile all areas. Drop a candidate whose covering test is also a
      candidate, unless a kept test covers both.
- [ ] Check each candidate group in a fresh context with the
      `second-pass review agent` action. Keep only confirmed candidates.

Evidence: `milestone-3/` under the evidence directory.

## Milestone 4: Remove the confirmed tests

Depends on: 3

One work item for each area. Items that change different files can run in
parallel workspaces. No step measures test time.

- [ ] Prove the cover of each duplicate. Break the product code once, see
      the covering test fail on an assertion, and restore the code.
- [ ] Move each product assertion of a "never" test to a test of its
      requirement first. When no test runs a CI script that a removed test
      read, add a test that runs it.
- [ ] Delete dead code with its tests, as the `git-commit` skill says. Move
      a test that reaches live behaviour through dead code to the live path.
- [ ] Delete each removed test, and each helper and fixture that only it
      used.
- [ ] Update the stale references in `docs/`, `plans/`, and every
      `README.md`.
- [ ] Run the tests of each changed file and the deletion audit. Record
      each removal: the test, the reason, the covering test, and the proof.

Evidence: `milestone-4/` under the evidence directory.

## Milestone 5: Decide the reserved cases

Depends on: 3

- [ ] Give the user every reserved case in one message, in the
      `decisions-and-findings` layout.
- [ ] Remove each approved case with the steps of Milestone 4.
- [ ] Record each case without an answer as a follow-up item.

## Milestone 6: Verification, commit, review, and pull request

Depends on: 2, 3, 4, 5

- [ ] Run the complete gate named in `AGENTS.md` on the merged tree.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls with their dates, a permalink to this plan, each removal
      with its reason, covering test, and proof file, and the follow-up
      items that the change adds or deletes.
