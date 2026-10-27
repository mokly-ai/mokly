# Port the Verification Scripts That xtask Calls

Status: Active. [PR #213](https://github.com/mokly-ai/mokly/pull/213) is
open as a draft, stacked on
[PR #212](https://github.com/mokly-ai/mokly/pull/212). It stays a draft
until the two open decisions are settled: the suite wrapper's process
ownership in Milestone 6 and the step boundary of review 1 finding 2. The
plan closes when its PR merges.

`xtask` runs the repository gate in Rust, but it still calls small Node
scripts: the changed-file length audit, the protocol cap ratchet inside the
Node ratchet runner, the Rust advisory audit behind
`npm run dependencies:check:rust`, and the source-tree fingerprint. Each
Testbox also runs a Node modification-time refresh and the Node suite
wrapper, and the pull request workflow runs a Node title check. This plan
ports the length audit, the cap ratchet, the remote-state guard, the
fingerprint, and the suite wrapper, with every assertion kept, and deletes
the Node scripts and tests that the port replaces. The Rust audit, the
modification-time refresh, and the title check stay in Node, as the user
decided on 2026-10-27.

User decision 3 B, 2026-10-26, in the workspace "mokly/tests Rust
migration": port the small scripts and their 18 test files, that is, the
fingerprint, the Testbox suite, the Rust audit, the file-length audit, the
protocol caps, the pull request title check, and the remote-state guard.
Rejected: A, keep the tooling in Node; C, also port the export ratchets, the
npm audit, and the release scripts. Reason: B removes the simplest
Rust-to-Node calls, and C rewrites tools that mostly drive npm, for less
gain.

Findings of the scope check on 2026-10-26:

- The remote-state guard has no script.
  `scripts/verification/remove-remote-state.mjs` is only a command that the
  guard rejects. The guard's test and helper read workflow files, so they
  join the repository rules of `move-repository-rules-to-xtask.md`.
- The protocol cap ratchet also has four cases in
  `tests/repository_ratchets.test.ts` and two in
  `tests/repository_ratchets_git.test.ts`. They move with it. The other
  ratchets stay in Node, so the ratchet runner keeps its Git workspace.
- The cap ratchet still reads the legacy TypeScript cap table of a
  comparison commit from before 2026-10-08, and a Node test covers that
  path. The port keeps it with a strict parser of that object-literal form.
- The child environment parity test stays in Node, because `process.mjs`
  and `serve-process.mjs` keep using `child-environment.mjs`.
- Three parts waited for user decisions. The Testbox commands and the pull
  request title workflow change a protocol requirement. The Rust audit
  downloads its tool over HTTPS, and every HTTPS client for `xtask` either
  adds a TLS build to every fresh `xtask` build or a new external tool.
  Milestones 5, 6, and 7 hold them.

User decisions of 2026-10-27, in the same workspace:

- 2 A: the Rust audit stays in Node. Rejected: B, `reqwest` with `rustls`,
  which makes each cold `xtask` build about 31 seconds slower; C, the system
  `curl`, which adds an external tool to the gate.
- 3 B: port the fingerprint and the suite wrapper to `cargo xtask` commands.
  The Node modification-time refresh stays and runs first in the probe and
  in each suite command. Rejected: A, keep all three in Node; C, a shell
  refresh, which is harder to test.
- 4 A: the pull request title check stays in Node. Rejected: B, a Rust check
  that needs the toolchain and an `xtask` build for each title edit.
- 5 B: remove the legacy cap table path. A comparison commit without the JSON
  table takes its caps from line counts, as the ratchet page says. Rejected:
  A, keep the parser and change the page. Reason: line counts give the same
  caps for every page at a comparison commit that passed its own size test.
- The step boundary of review 1 finding 2 stays open: the user asked for an
  explanation.
- New open decision, found while porting 3 B: the Node suite wrapper runs
  each child under a Node verification process owner, which
  `docs/protocol/ci-suite-evidence.md` requires of report-producing
  wrappers. The wrapper port waits for the user's choice of how the Rust
  wrapper owns its child processes.

Contract owners:

- [Repository gate and length audits](../docs/protocol/ci-verification-repository.md).
- [Repository verification ratchets](../docs/protocol/verification-ratchets.md).
- [Dependency security](../docs/protocol/dependency-security.md#rust-advisory-audit).
- [Testbox execution](../docs/protocol/remote-verification-testbox.md) and
  [base sync](../docs/protocol/remote-verification-base.md), for Milestone 6.
- [CI verification](../docs/protocol/ci-verification.md#pull-request-title-contract),
  for Milestone 7.
- The [xtask README](../xtask/README.md) and the
  [verification scripts README](../scripts/verification/README.md).

## Milestone 1: Documentation and protocol

No requirement changes for Milestones 2 to 4. The length audit page named
its implementation language, which is a mechanic, not a requirement.

- [x] State the source and protocol length audit of
      `docs/protocol/ci-verification-repository.md` without naming Node.

## Milestone 2: Remote-state guard

- [x] Port `tests/ci_workflow_remote_state.test.ts` and its command scanner
      `tests/helpers/remote_state_commands.ts` to the repository rules.
- [x] Delete them, and state the remote-state paragraph of
      `docs/protocol/ci-test-repository-inputs.md` without file names.

## Milestone 3: Changed-file length audit

The audit and the cap ratchet share one length policy and one Git
comparison. Both move to one `xtask` module behind traits, with real Git
repositories in the adapter tests.

- [x] Port the length policy: physical line counts, the limits, and the
      cap table with its source-order key check.
- [x] Port the Git comparison: the merge base or the merged `origin/main`
      during a merge, the changed and untracked files with renames, and the
      files and blobs of the comparison commit.
- [x] Run the audit in-process for `cargo xtask source-file-length-lint`
      and the repository suite. Port `tests/source_file_length.test.ts`.
- [x] Port the length checks of `tests/repository_ratchets_merge.test.ts`.
      Its Git workspace checks stay, because the Node ratchets use that
      workspace.
- [x] Delete `scripts/verification/source-file-length.mjs` and its test.

## Milestone 4: Protocol cap ratchet

- [x] Port `protocol-caps.mjs` with the legacy cap table parser, and run it
      in-process in the repository suite with the same pass and fail lines.
      It runs in the ratchet step before the Node ratchets, and the step
      fails only after both ran, as the Node runner reports every ratchet.
- [x] Port `tests/protocol_caps_table.test.ts`, the four cap cases of
      `tests/repository_ratchets.test.ts`, and the subfolder case of
      `tests/repository_ratchets_git.test.ts`. A Rust case covers the cap
      part of its anchoring case, which keeps covering the Node ratchets.
- [x] Remove the protocol cap audit and its exports from
      `scripts/verification/repository-ratchets.mjs` and its declarations.
      Delete `protocol-caps.mjs`, `length-policy.mjs`, and the
      `baseFiles` method of the Node Git workspace, which only they used.

## Milestone 5: Rust advisory audit

Settled by user decision 2 A of 2026-10-27: the Rust audit stays in Node.

- [x] Keep `rust-audit.mjs`, `rust-audit-tool.mjs`, and their two tests in
      Node. No change.

## Milestone 6: Testbox commands

User decision 3 B of 2026-10-27: port the fingerprint and the suite wrapper.
The Node refresh runs first, because a `cargo xtask` command builds before
it runs.

- [x] Port the fingerprint to `cargo xtask source-tree` and the
      `source_tree` module, with every case of
      `tests/verification_source_tree.test.ts`,
      `tests/verification_source_tree_types.test.ts`,
      `tests/verification_source_tree_cli.test.ts`, and the source-tree cases
      of `tests/verification_fingerprint_arguments.test.ts`.
- [x] Compute the checkout and snapshot fingerprints in-process, and run
      the probe as the Node refresh followed by `cargo xtask source-tree`.
      State both in the two Testbox protocol pages.
- [ ] Apply the user's decision on the wrapper's process ownership. Then
      port `testbox-suite.mjs` to a `cargo xtask` command that runs after
      the Node refresh, with every case of
      `tests/verification_testbox_suite.test.ts`,
      `tests/verification_testbox_failures.test.ts`,
      `tests/verification_testbox_staging.test.ts`,
      `tests/verification_testbox_staging_git.test.ts`,
      `tests/verification_testbox_process.test.ts`, and the wrapper cases of
      `tests/verification_fingerprint_arguments.test.ts`.
- [ ] Delete `source-tree.mjs`, `testbox-suite.mjs`, their declarations,
      their Node tests, and `typeRepository` of
      `tests/helpers/source_tree_types.ts`, once no Node wrapper uses the
      Node fingerprint. Keep `isolatedGitEnvironment` for the bootstrap
      tests.

Evidence: `fingerprint-parity.log` in
`.context/port-verification-scripts-to-xtask/decisions-2026-10-27/`.

## Milestone 7: Pull request title

Settled by user decision 4 A of 2026-10-27: the title check stays in Node.

- [x] Keep `pull-request-title.mjs` and its two test files in Node. No
      change.

## Milestone 8: Verification, commit, review, and pull request

This milestone verifies Milestones 1 to 4. Milestone 9 verifies the parts
that wait for the user's decisions.

- [x] Save the map from each Node case to its Rust test under
      `.context/port-verification-scripts-to-xtask/`.

Evidence: `case-map.md`, `fault-injection.md`, and `dead-code-searches.md`
in `.context/port-verification-scripts-to-xtask/`. Gate evidence:
`complete-gate.log` and `complete-gate-2.log` there, remote runs
`20261026T193526Z-450461` and `20261026T204234Z-739530`.

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 1 of 2026-10-26 fixed findings 3, 4, and 5. It also fixed
    findings 1 and 2, which restore assertions that the port had dropped
    and that decision 3 B requires. Report:
    `.context/port-verification-scripts-to-xtask/review-1.md`.
  - Review 2 of the fix fixed its findings 1 and 2: a line that continues
    the expression no longer ends the legacy table, and the cap ratchet
    helpers are private. Report:
    `.context/port-verification-scripts-to-xtask/review-2.md`.
  - Decision for the user: remove the legacy cap table path, the wider fix
    of review 1 finding 5 and review 2 finding 1. Effort Large.
    - [x] Settled by user decision 5 B of 2026-10-27. Milestone 9 removes it.
  - Decision for the user: run every suite step through one injected step
    boundary, the wider fix of review 1 finding 2. Effort Medium.
    - Open: on 2026-10-27 the user asked for an explanation.
  - Outside the review scope: `docs/protocol/verification-ratchets.md:53`:
    the page says that a comparison commit without the JSON cap table takes
    its caps from line counts, but the ratchet first reads the legacy table,
    as the Node code on `origin/main` does. Separate branch.
    - [x] Resolved by user decision 5 B: the ratchet now takes line counts,
          as the page says.
  - Outside the review scope: `xtask/src/check/runner.rs`: no ordered test
    pins the Rust file-length audit after `cargo test --workspace`, as on
    `origin/main`. Separate branch.
- [x] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph. It opened as a draft before
      Milestones 5 to 7, because the user asked for the pull request.

## Milestone 9: Decided changes and their verification

- [x] Remove the legacy cap table path, its parser, and its tests, as user
      decision 5 B chose. The repository test of the legacy table now shows
      that a comparison commit without the JSON table takes its caps from
      line counts, also when it still holds the old size test.
- [ ] Add the map from each Node case of Milestones 5 to 7 to its Rust
      test, or the reason that it stays in Node, under
      `.context/port-verification-scripts-to-xtask/`.
  - [x] Round 1, the fingerprint: `decisions-2026-10-27/case-map.md`.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Round 1, review 3 of 2026-10-27, of commit `2e9da5a2`: fixed findings
    2, 4, 5, and 6. It also fixed finding 1 with option C, because decision
    3 B keeps every assertion of the Node tests. Report:
    `.context/port-verification-scripts-to-xtask/review-3.md`.
  - 3. The fingerprint's Git variable removal has no test. Severity Low,
       effort Medium. Recommended: B, build every `xtask` Git command with
       the one tested command builder.
  - 7. The fingerprint format check has three copies. Severity Low, effort
       Small. Recommended: A, let the remote parser use the fingerprint
       format of the `source_tree` module.
  - Decision for the user: enable the `unused_crate_dependencies` lint for
    the `xtask` binary, the blocked wider fix of review 3 finding 4. Effort
    Small. Previous example: review 1 finding 4, option B.
  - Outside the review scope: `xtask/src/length/git.rs:199`: the length
    audit's Git helper removes the Git repository variables without a test.
    Separate branch.
  - Outside the review scope: `docs/protocol/remote-verification.md:181`:
    the page names the source file `xtask/src/remote/error.rs`. Separate
    branch.
  - Outside the review scope: `xtask/README.md:50`: the README says that
    every subprocess starts at the workspace root, but the probes, the suite
    commands, and the snapshot fingerprint start in the snapshot directory.
    Separate branch.
  - Outside the review scope: `tests/browser/viewer_inspection_ownership.spec.ts`,
    "postMessage obsolete labels success preserves frame replacement pick",
    failed with `Timeout 10000ms exceeded while waiting on the predicate` in
    remote gate `20261027T105758Z-135390` and passed in the hosted CI run of
    the same commit. Suspected source: a race between the label reply and
    the disposal of the replaced frame. Separate branch.
  - Outside the review scope: `tests/browser/large_watch.spec.ts`, "large
    watch delivers browser evidence for react", failed with `Test timeout of
300000ms exceeded` in the same gate and in three hosted CI runs of
    2026-10-26, and passed on each rerun. User decision 105 accepts rare
    timeouts. Separate branch.
- [ ] Update the pull request description with the applied decisions, and
      mark the pull request ready for review.
