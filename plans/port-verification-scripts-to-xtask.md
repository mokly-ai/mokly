# Port the Verification Scripts That xtask Calls

Status: Active. [PR #213](https://github.com/mokly-ai/mokly/pull/213) is
open as a draft, stacked on
[PR #212](https://github.com/mokly-ai/mokly/pull/212). It stays a draft
until the user's decisions for Milestones 5 to 7 are applied. The plan
closes when its PR merges.

`xtask` runs the repository gate in Rust, but it still calls small Node
scripts: the changed-file length audit, the protocol cap ratchet inside the
Node ratchet runner, the Rust advisory audit behind
`npm run dependencies:check:rust`, and the source-tree fingerprint. Each
Testbox also runs a Node modification-time refresh and the Node suite
wrapper, and the pull request workflow runs a Node title check. This plan
ports these scripts and their Node tests to `xtask`, with every assertion
kept, and deletes the Node scripts and tests that the port replaces.

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
- Three parts wait for user decisions. The Testbox commands and the pull
  request title workflow change a protocol requirement. The Rust audit
  downloads its tool over HTTPS, and every HTTPS client for `xtask` either
  adds a TLS build to every fresh `xtask` build or a new external tool.
  Milestones 5, 6, and 7 hold them.

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

Blocked: waits for the user's decision on the tool download. The wrapper
downloads the pinned `cargo-audit` source over HTTPS. `xtask` has no HTTP
client, and `reqwest` with `rustls` adds the `aws-lc` build to every fresh
`xtask` build.

- [ ] Port `rust-audit.mjs` and `rust-audit-tool.mjs` to an `xtask`
      command with injected time, process, download, and file boundaries.
      `npm run dependencies:check:rust` keeps its name and runs it.
- [ ] Check that the new `xtask` dependencies add no package to
      `Cargo.lock`.
- [ ] Port `tests/rust_audit.test.ts` and `tests/rust_audit_tool.test.ts`.
- [ ] Delete `audit-rust.mjs`, `rust-audit.mjs`, `rust-audit-tool.mjs`,
      their declarations, and the two tests.
- [ ] Move the description of the Rust audit from the verification scripts
      README to the xtask README.

## Milestone 6: Testbox commands

Blocked: waits for the user's decision on the Testbox commands. Each box
runs the Node fingerprint probe, then the Node modification-time refresh and
the Node suite wrapper. The refresh must run before any build, and a
`cargo xtask` command builds first.

- [ ] Apply the user's decision on the fingerprint, the suite wrapper, and
      the refresh, with their ten test files.

## Milestone 7: Pull request title

Blocked: waits for the user's decision on the title workflow. The workflow
runs the title check with Node only and has a five-minute limit.

- [ ] Apply the user's decision on `pull-request-title.mjs` and its two test
      files.

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
  - Decision for the user: run every suite step through one injected step
    boundary, the wider fix of review 1 finding 2. Effort Medium.
  - Outside the review scope: `docs/protocol/verification-ratchets.md:53`:
    the page says that a comparison commit without the JSON cap table takes
    its caps from line counts, but the ratchet first reads the legacy table,
    as the Node code on `origin/main` does. Separate branch.
  - Outside the review scope: `xtask/src/check/runner.rs`: no ordered test
    pins the Rust file-length audit after `cargo test --workspace`, as on
    `origin/main`. Separate branch.
- [x] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph. It opened as a draft before
      Milestones 5 to 7, because the user asked for the pull request.

## Milestone 9: Verification of the decided parts

Blocked: waits for the user's decisions.

- [ ] Add the map from each Node case of Milestones 5 to 7 to its Rust
      test, or the reason that it stays in Node, under
      `.context/port-verification-scripts-to-xtask/`.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Update the pull request description with the applied decisions, and
      mark the pull request ready for review.
