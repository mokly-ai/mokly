# Port the Verification Scripts That xtask Calls

Status: Active. On branch `conductor/port-verification-scripts-to-xtask`,
stacked on `conductor/move-tooling-tests-to-xtask`, no pull request yet. The
plan closes when its PR merges.

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
- Two parts change a protocol requirement, so they wait for user decisions:
  the Testbox commands and the pull request title workflow. Milestones 6 and
  7 hold them.

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

No requirement changes for Milestones 2 to 5. The length audit page names
its implementation language, which is a mechanic, not a requirement.

- [ ] State the source and protocol length audit of
      `docs/protocol/ci-verification-repository.md` without naming Node.
- [ ] Move the description of the Rust audit from the verification scripts
      README to the xtask README.

## Milestone 2: Remote-state guard

- [ ] Port `tests/ci_workflow_remote_state.test.ts` and its command scanner
      `tests/helpers/remote_state_commands.ts` to the repository rules.
- [ ] Delete them, and state the remote-state paragraph of
      `docs/protocol/ci-test-repository-inputs.md` without file names.

## Milestone 3: Changed-file length audit

The audit and the cap ratchet share one length policy and one Git
comparison. Both move to one `xtask` module behind traits, with real Git
repositories in the adapter tests.

- [ ] Port the length policy: physical line counts, the limits, and the
      cap table with its source-order key check.
- [ ] Port the Git comparison: the merge base or the merged `origin/main`
      during a merge, the changed and untracked files with renames, and the
      files and blobs of the comparison commit.
- [ ] Run the audit in-process for `cargo xtask source-file-length-lint`
      and the repository suite. Port `tests/source_file_length.test.ts`.
- [ ] Delete `scripts/verification/source-file-length.mjs` and its test.

## Milestone 4: Protocol cap ratchet

- [ ] Port `protocol-caps.mjs` with the legacy cap table parser, and run it
      in-process in the repository suite with the same pass and fail lines.
- [ ] Port `tests/protocol_caps_table.test.ts` and the six protocol cap
      cases of the two ratchet tests.
- [ ] Remove the protocol cap audit and its exports from
      `scripts/verification/repository-ratchets.mjs` and its declarations.
      Delete `protocol-caps.mjs` and each policy export that the port
      leaves unused.

## Milestone 5: Rust advisory audit

- [ ] Port `rust-audit.mjs` and `rust-audit-tool.mjs` to an `xtask`
      command with injected time, process, download, and file boundaries.
      `npm run dependencies:check:rust` keeps its name and runs it.
- [ ] Check that the new `xtask` dependencies add no package to
      `Cargo.lock`.
- [ ] Port `tests/rust_audit.test.ts` and `tests/rust_audit_tool.test.ts`.
- [ ] Delete `audit-rust.mjs`, `rust-audit.mjs`, `rust-audit-tool.mjs`,
      their declarations, and the two tests.

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

- [ ] Save the map from each Node case to its Rust test under
      `.context/port-verification-scripts-to-xtask/`.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
