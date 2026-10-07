# Remote Verification Review Follow-Up

Status: Active. No pull request exists yet. Milestones 1 through 5 and the
cleanup review changes are completed. Milestone 6 focused checks and the full
local gate pass. The default remote smoke check is next. Claude owns the final
review. The user approved the local and default remote gates for this work.

Fix the eleven open findings from the post-push review of
[Blacksmith remote verification](./blacksmith-remote-verification.md)
(PR #160). On 2026-10-07 the user approved the recommended option for every
open finding. The findings keep their original numbers 4 to 14. The full
reviewer reports are in `.context/blacksmith-remote-verification/`.

This change covers xtask, the verification scripts, the Testbox workflow,
`.gitignore`, the remote verification contract and the READMEs. It has no
product UI or mockup work.

Contract owners:

- [Remote verification](../docs/protocol/remote-verification.md).
- [Testbox execution](../docs/protocol/remote-verification-testbox.md).
- [CI workflow graph](../docs/protocol/ci-workflow.md).
- [CI dependency cache and security](../docs/protocol/ci-verification-security.md).
- The [xtask README](../xtask/README.md) and the
  [repository README](../README.md).

## Decisions

The user approved these options on 2026-10-07.

| Finding | Severity | Approved option                                                                                       |
| ------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 4       | Medium   | Add adapter tests that use short real shell processes and temporary directories.                      |
| 5       | Low      | Count each box once, after its last cleanup attempt. Document that a cleanup failure fails the check. |
| 6       | Low      | Limit the workflow push trigger to branches.                                                          |
| 7       | Low      | Name the path in the fingerprint error. Ignore `.claude/worktrees/`.                                  |
| 8       | Low      | Remove secret variables from every xtask subprocess through one shared list.                          |
| 9       | Low      | Name every missing program in one diagnostic.                                                         |
| 10      | Low      | Share one fingerprint validator without usage text.                                                   |
| 11      | Low      | Use `chrono` without default features and with the `now` feature only.                                |
| 12      | Low      | Check the GitHub run state before a cancellation warning.                                             |
| 13      | Low      | Format every warning line that embeds an error in one place.                                          |
| 14      | Medium   | Keep run IDs from captured CLI output, retry failed stops and print a manual cleanup command.         |

### Rules For Each Finding

- **4.** Test `SystemProcess` with real `sh` children: stdout and stderr
  streaming to a log, captured output, stdin input with redaction, removal of
  secret variables, `BLACKSMITH_DISABLE_AUTO_UPDATE=1` for Blacksmith
  requests, and process-group termination of a child and its grandchild after
  an interrupt. A non-cancellable request must finish after an interrupt.
  Test `SystemLogs` with a temporary directory: fresh run directories, a
  rejected existing run or log file, and the 60-line tail. Test
  `SystemPrograms` with real executable and non-executable files. Test the
  interrupt state machine as a pure function over its state bits. Tests must
  not assert elapsed time (`docs/protocol/ci-test-timing.md`).
- **5.** A box is a cleanup failure only when it is neither stopped nor proven
  completed after all cleanup attempts. Report that count once per box. The
  check fails when the count is not zero. An interrupted check reports the
  same count. Its message must not say that all boxes stopped when one did
  not.
- **6.** The push trigger of `.github/workflows/blacksmith-testbox.yml` uses
  `branches: ["**"]` and keeps its path filter. Tag pushes no longer start
  the workflow.
- **7.** `scripts/verification/source-tree.mjs` names the unsupported path in
  its error and tells the caller to ignore or remove a nested repository or
  worktree. `.gitignore` adds `.claude/worktrees/`.
- **8.** One shared list names the secret environment variables. Today it
  holds only `BLACKSMITH_ORG_TOKEN`. The local command runner and the remote
  process adapter remove every listed variable from each child. Unit tests
  check the configured command with `Command::get_envs`. The security contract
  states the rule.
- **9.** Availability checks look for `blacksmith`, `rsync` and `ssh`, in that
  order, and report every missing program in one diagnostic. The diagnostic
  gives the install command for `blacksmith` and the package manager hint for
  `rsync` and `ssh`.
- **10.** `source-tree.mjs` exports one fingerprint validator whose error has
  no usage text. `source-tree.mjs` and `testbox-suite.mjs` each add their own
  usage line.
- **11.** Run `cargo add chrono --no-default-features --features now` in
  `xtask`. The `<run>` timestamp format stays `YYYYMMDDTHHMMSSZ`.
- **12.** When `gh run cancel` fails, xtask reads the run state with
  `gh run view <id> --json status --jq .status`. Trim the output. Map
  `completed` to the typed completed state. Map every other nonempty value
  to the other state. Empty output is a typed read error. A `completed` state prints an information
  line that the run already ended. Any other state, or a failed state read,
  prints the cancellation warning. Never decide from error text.
- **13.** One function formats each warning line that embeds an error. Each
  error keeps the `[xtask/<module>]` prefix of the module that defines it, so
  the variants in `xtask/src/remote/error.rs` use `[xtask/remote]`. No output
  line repeats a prefix.
- **14.** Record each box's GitHub run ID from any captured warmup or probe
  output that contains `/actions/runs/<digits>`. Cleanup reads
  `testbox status` first and uses the recorded ID when the status read fails
  or names no run. A failed stop is tried again after 5 seconds and after 10
  more seconds, so each box gets at most three stop attempts. The waits use
  the injected clock. After the final cleanup, print one warning for each box
  that is still not stopped, with `blacksmith testbox stop --id <box-id>` and
  a note that the 30-minute idle timeout ends it.
  Clean up boxes in parallel. Each box keeps its own attempt order.
  A panic in one cleanup worker must not stop cleanup of the other boxes.

## Milestone 1: Contract documentation

Completed. Define every behavior change before any code changes.
Evidence: `.context/remote-verification-review-follow-up/milestone-1.md`.

- [x] Update `docs/protocol/remote-verification.md` for findings 5, 9, 12, 13
      and 14: the success rule, the cleanup count, the interrupt message, the
      missing-program diagnostic, the cancellation state check, warning-line
      formatting, run ID sources, stop retries and the manual cleanup warning.
- [x] Update `docs/protocol/remote-verification-testbox.md` for findings 6, 7
      and 10, and `docs/protocol/ci-workflow.md` for finding 6.
- [x] Update `docs/protocol/ci-verification-security.md` for finding 8.
- [x] Update `xtask/README.md` and `README.md` where they describe the same
      behavior.
- [x] Change the status paragraph of `plans/blacksmith-remote-verification.md`
      to `Status: Completed.` with the PR #160 link and merge date, and point
      its open findings to this plan.
- [x] Keep each protocol page at 250 lines or less, or split it. Run Prettier
      and the protocol doc tests. Review the diff.
- [x] Commit.

## Milestone 2: Cleanup and reporting

Completed. Make cleanup robust and its output accurate. Covers findings 5, 12,
13 and 14.
Evidence: `.context/remote-verification-review-follow-up/milestone-2.md`.

- [x] Write failing unimock tests first for each rule, then implement:
  - [x] Finding 14: run IDs from warmup and probe output, the status-first
        rule, three stop attempts with 5 and 10 second clock waits, and the
        manual cleanup warning.
  - [x] Finding 5: one count per box after its last attempt, a passing check
        after a stop that succeeds on retry, and the interrupt count.
  - [x] Finding 12: a typed GitHub run state read after a failed
        cancellation.
  - [x] Finding 13: one warning-line formatter and `[xtask/remote]` prefixes
        for the variants in `xtask/src/remote/error.rs`.
    - [x] Route failed log reads through the same warning formatter.
- [x] Run Rust formatting, Clippy with `-D warnings`, the xtask tests and the
      Rust length lint.
- [x] Commit.

## Milestone 2 follow-up: Cleanup review changes

Completed. Use the CLI's field selector without JSON packages. Keep each box's cleanup
independent. The user approved these review changes on 2026-10-07.
Evidence: `.context/remote-verification-review-follow-up/milestone-2-follow-up.md`.

- [x] Write failing client tests for the field selector, trimmed run states
      and empty output. Remove `serde` and `serde_json` with `cargo remove`.
- [x] Write failing cleanup tests for independent boxes and worker panics.
      Clean up boxes in scoped threads. Keep panic cleanup safe.
- [x] Update the contract and README. Run the Rust and protocol checks.
- [x] Commit these two review changes together.

## Milestone 3: Availability and subprocess environment

Completed. Covers findings 8, 9 and 11.
Evidence: `.context/remote-verification-review-follow-up/milestone-3.md`.

- [x] Finding 9: write failing tests for two and three missing programs in
      `auto` and `remote` mode, then report all of them in one diagnostic.
- [x] Finding 8: write failing `Command::get_envs` tests for both runners,
      then remove the shared secret list from every xtask subprocess.
- [x] Finding 11: change the `chrono` features with `cargo add`. Confirm the
      `<run>` format test and the smaller lockfile.
- [x] Run the Rust checks again. Commit.

## Milestone 4: Scripts and workflow

Completed. Covers findings 6, 7 and 10.
Evidence: `.context/remote-verification-review-follow-up/milestone-4.md`.

- [x] Finding 6: write the failing workflow test, then add the branch filter.
- [x] Finding 7: write failing tests for a nested worktree error that names
      its path and for an ignored `.claude/worktrees/` path, then implement
      the error text and the `.gitignore` entry.
- [x] Finding 10: write failing tests for each script's usage line, then add
      the shared validator.
- [x] Run ESLint, prepared TypeScript, Prettier and the focused Node tests.
      Commit.
- [x] Push the committed milestones. Confirm that the changed Testbox
      workflow passes in validation mode on this branch.

## Milestone 5: Adapter tests

Completed. Covers finding 4.
Evidence: `.context/remote-verification-review-follow-up/milestone-5.md`.

- [x] Add the adapter tests in the finding 4 rules under the owning
      `_tests_` directories. Keep each file at 300 lines or less.
- [x] Confirm that each new test fails when its adapter behavior is removed.
- [x] Run the Rust checks again. Commit.

## Milestone 6: Verification, close-out and review

Evidence: `.context/remote-verification-review-follow-up/milestone-6.md` and `merge-justifications.md` in the same directory.

- [x] Fetch `origin/main` and merge new commits under the mainline
      preservation rules, if needed.
- [x] Run all tests for this change with a 100% pass rate. Run
      `cargo fmt --all -- --check`, Clippy and the length lints.
- [x] Run `cargo xtask check --executor local`.
- [ ] Push, then run the default `cargo xtask check` with the `main` Testbox
      workflow. Require 11/11 commands, 9/9 reports and no active box. This
      also covers the post-merge smoke check of the earlier plan.
- [ ] Inspect the diff and the deletions against `origin/main`.
- [ ] After the checks pass, run `git add -A`, commit with Conventional
      Commits and push the branch.
- [ ] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and reports the
      findings. Keep the review read-only. The implementer then applies the
      review-fix rule in `AGENTS.md`: fix the `Auto-fix: yes` findings, run
      the checks, commit and push, re-review once, fix any new
      `Auto-fix: yes` findings once more, then stop and report the rest. Add
      each open finding as one line under this TODO.
