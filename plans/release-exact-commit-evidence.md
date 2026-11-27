# Release exact-commit evidence

Status: Active. On branch `calummoore/speed-up-release-process-pkk9`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

A release publishes to npm only with release evidence: a passed CI run with
the Node 24 viewer tests whose tested tree equals the tree of the release
tag. Today only a Release Please pull request run has those tests. That run
tests a temporary merge of the pull request with `main` at the time of the
run. When another pull request merges first, the release commit gets a
different tree, and the release stops after its 31-minute build matrix. The
"Re-run CI" recovery in the error message cannot work, because a re-run tests
the same old tree. This happened in 0.20.0, which never reached npm, in
0.21.0, and in 0.22.0. On 2026-11-27, 0.22.0 published only after a second
pull request with the same head commit gave a run on the exact tree.

The change makes CI test the release commit itself. The push of a release
commit to `main` gets the release profile, and no later push can cancel that
run. CI runs beside the native builds, and preparation waits for the run
when it has not completed yet, so a clean release gets no slower. The existing evidence selection already ranks a
successful push run on the tag commit first, so the selection code keeps its
rules. The change does not cover the other parts of the release-speed
brainstorm: version-free contract fixtures, the Intel macOS build, the npm
registry wait, and the publish order. Those stay open decisions with the user.
The brainstorm notes are in `.context/release-speed/`.

User decision, 2026-11-27: build the exact-commit proof ("i'd still like the
fix", after the 0.22.0 workaround). This is the part that options A and C of
the brainstorm's root question share. Alternatives: publish after the
release pull request's `Required CI` alone, rejected because it publishes a
tree that no release-profile run tested; require an up-to-date release pull
request at merge, which option D holds and which the user did not choose.

Design calls (my calls, 2026-11-27). A fresh options check reviewed them on
the same day. Its report is in
`.context/release-exact-commit-evidence/options-check.md`.

- CI marks a push to `main` as a release commit when its head commit changes
  `.release-please-manifest.json`, or when the first line of its message
  starts with `chore(main): release `. Every release commit since
  2026-09-11 changed the manifest. The title test alone misses six release
  commits from 2026-09-17 to 2026-10-20, whose title was
  `chore: release main`. Both tests also match desktop release commits,
  which then run three more viewer jobs. A false match, such as a component
  bootstrap, only adds tests and never removes one. So a crafted commit
  gives an attacker no advantage. Pushes to `main` need merge rights in any
  case. My first call was the title test alone. The options check added the
  manifest test.
  Rejected:
  - An API lookup of the merged pull request's head ref, because the
    concurrency group must be known before any job runs.
  - The release profile for every push to `main`, because it adds three jobs
    to each push and still needs a cancellation exception.
  - A CI run on the push of each `v*` tag. It runs CI twice on each release,
    and it stops when Release Please falls back to the default token, because
    that token starts no workflows.
  - A CI dispatch from the release workflow. It runs CI twice on each
    release, and it gives the publishing workflow `actions: write`.
- A release commit run gets its own concurrency group, keyed by its commit,
  so a later push to `main` cannot cancel it. Other runs keep the current
  group and still cancel superseded runs. Rejected: no cancellation for any
  push to `main`. From 2026-11-13 to 2026-11-27, later pushes cancelled 88
  of 236 push runs, and those runs would all run to the end. Rejected: one
  shared group without cancellation, because GitHub keeps only the newest
  pending run of a group, so a third push still cancels a pending release
  run.
- Preparation waits for the CI push run on the tag commit, inside its
  evidence step and before the selection. It finds the run by the tag
  commit, not by the commit that started the release run, because a later
  push can create the release. The wait ends when the run completes, or
  after 45 minutes. That bound is three times the 13-minute median of a
  passed push run. The selection stays the only judge, so a pull request run
  can still apply when the push run fails. My first call was a separate
  wait job beside the builds. The options check showed that preparation
  starts after the builds, so a separate job never ends sooner, and it adds
  a job and a retry exception.
- Every doc and message that says "re-run CI on the release commit" names
  the recovery that decision 1 below chooses.

## Decisions

### 1. How a release with absent evidence still reaches npm

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Process.
- **Location:** `.github/workflows/release-prepare.yml:79`,
  `docs/protocol/npm-release-evidence.md:79`,
  `docs/protocol/npm-release-management.md:140`.
- **Background:** After this change, the CI push run on the release commit
  is the usual evidence. That run can still fail on a flaky test, lack the
  release profile on an old tag, or lose its reports after 14 days. Today
  the message says "re-run CI on the release commit", which cannot work.
- **Problem:** One step cannot fix every cause, and no current step gives a
  fresh run on the exact tag commit.
- **Impact if no action:** A release with absent evidence needs a workaround,
  such as the second pull request of 0.22.0, or a new version.
- **Root question:** How does a release with absent exact-commit evidence
  still reach npm without a new version?
- **Options:**
  - **A.** The message says: re-run the failed jobs of the CI push run on
    the release commit, then re-run the failed jobs of the release. It does
    not help a run without the release profile or with expired reports.
    Effort: Small.
  - **B.** The evidence record names the state of the push run: missing,
    in progress, failed, without the release profile, or with expired
    reports. The message gives the step for that state. For a run without
    the profile, it names a second pull request from the release head, as
    for 0.22.0. Effort: Medium.
  - **C.** Accept a CI run that a maintainer dispatches on the release tag,
    with the release profile, as evidence. The recovery for every cause is
    then one step: run CI on the tag, then re-run the failed jobs of the
    release. A dispatched run on the tag runs that commit's own workflow
    file, so it is as trusted as the push run. It changes the accepted
    events of the evidence doc and the dispatch profile of the CI workflow
    doc. Effort: Medium.
  - **D.** A new workflow re-runs the failed release jobs when the CI run on
    a release commit succeeds. It removes the second manual step, but it
    adds a workflow with `actions: write` beside the publishing workflow.
    Effort: Medium.
- **Left out:** An automatic re-run of failed CI jobs, because it hides
  flaky tests and cannot help a run without the release profile.
- **Wider fix:** C, because one step works for every cause.
- **Previous examples:** 0.20.0 never reached npm. 0.22.0 needed the second
  pull request #599.
- **Recommendation:** C. It is the only option with one working step for
  every cause, and it needs no new permission. The plan's first call was A.
- **Action:** ask the user, because C changes which CI events count as
  release evidence in `docs/protocol/npm-release-evidence.md`.

Contract owners:

- [CI workflow graph](../docs/protocol/ci-workflow.md).
- [Npm release verification evidence](../docs/protocol/npm-release-evidence.md).
- [Npm release management](../docs/protocol/npm-release-management.md).
- The [release scripts README](../scripts/release/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

State the release commit profile, its cancellation rule, the evidence wait,
and the recovery in the protocol docs. The recovery text waits for
decision 1.

- [ ] Update the workflow boundary and the runtime profiles of
      `docs/protocol/ci-workflow.md`: a release commit push runs the release
      profile, and a later push never cancels it.
- [ ] Replace the Node 24 paragraph of `docs/protocol/ci-workflow.md`, which
      says that the Release Please gate catches a Node 24-only regression.
      The release commit run now catches it, also after the tags exist.
- [ ] Update the candidate runs of `docs/protocol/npm-release-evidence.md`:
      the release commit push run is the usual applicable candidate, and
      release pull request runs stay the fallback.
- [ ] Update the workflow steps of `docs/protocol/npm-release-management.md`
      for the bounded evidence wait inside preparation.
- [ ] Update the recovery of `docs/protocol/npm-release-evidence.md` and
      `docs/protocol/npm-release-management.md` with the option that
      decision 1 chooses.
- [ ] Update `scripts/release/README.md` for the evidence wait.

## Milestone 2: Release profile for release commits

Depends on: 1

- [ ] In `.github/workflows/ci.yml`, select the release profile for a
      release commit push, and key its concurrency group by its commit.
- [ ] Rename the profile input `RELEASE_PULL_REQUEST` to a name that covers
      both the release pull request and the release commit.
- [ ] Update the workflow tests that check the profile and the concurrency
      group, in `tests/` and `xtask/tests/cli/`. Check the literal group
      string test in `xtask/tests/cli/workflow_contract.rs` against the
      `testing` skill, and keep, change, or remove it as that skill says.

## Milestone 3: Preparation waits for the exact-commit run

Depends on: 2

- [ ] Add the wait to the evidence selection under `scripts/release/`. It
      finds the CI push run on the tag commit and waits until that run
      completes, or for at most 45 minutes. It reports the run and its
      conclusion. It never fails the release on the run's conclusion, and
      the selection stays the judge.
- [ ] Test the wait with an injected GitHub client and an injected clock,
      without real sleeps: run completed, run not yet created, run in
      progress, run failed, and the bound reached.
- [ ] Replace the absent-evidence message in
      `.github/workflows/release-prepare.yml` with the recovery of
      decision 1.
- [ ] When decision 1 chooses C, accept a dispatched CI run on the tag commit
      in the evidence selection, give a dispatched run on a release tag the
      release profile, and test both.
- [ ] Update the release workflow tests for the changed steps.

## Milestone 4: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] On the next CLI release, check that the CI push run on the release
      commit has the Node 24 viewer reports, and that preparation selects
      it.
