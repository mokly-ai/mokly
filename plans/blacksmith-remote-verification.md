# Blacksmith Remote Verification

Status: Completed. [PR #160](https://github.com/mokly-ai/mokly/pull/160) merged on 2026-10-07. Open findings 4 to 14 move to the [review follow-up plan](./remote-verification-review-follow-up.md).

Run the complete `cargo xtask check` gate on Blacksmith Testboxes when a
Blacksmith key is available. Run it locally when no key is available. The key
is the `BLACKSMITH_ORG_TOKEN` environment variable. The remote gate runs the
same 11 commands as hosted CI on 11 boxes at the same time. Then it validates
the same shard evidence. The local gate runs the same suites one after another.

This change covers xtask, verification scripts, one GitHub workflow and their
documentation. It has no product UI or mockup work. The Conductor cloud
snapshot script is outside this repository. It installs the Blacksmith CLI.

Contract owners:

- [Remote verification](../docs/protocol/remote-verification.md).
- [Testbox execution](../docs/protocol/remote-verification-testbox.md).
- [CI verification](../docs/protocol/ci-verification.md).
- [CI workflow graph](../docs/protocol/ci-workflow.md).
- [CI dependency cache and security](../docs/protocol/ci-verification-security.md).
- [CI and npm release](../docs/protocol/npm-release.md).
- The [xtask README](../xtask/README.md) and the
  [repository README](../README.md).

## Trial Evidence

Evidence: `.context/blacksmith-remote-verification/trial-evidence.md`.

The design depends on these findings:

1. `blacksmith auth status` exits 0 without a login, and it accepts a fake
   token. `blacksmith auth login --api-token -` rejects a bad key.
   `blacksmith testbox list` exits 1 on HTTP 401. The CLI reads no key
   variable. An org token selects its own organization.
2. GitHub rejects a dispatch with HTTP 404 until a run registers the workflow.
   A `push` run on a branch registers it before merge.
3. `blacksmith testbox run` starts a new SSH session that reads
   `/etc/environment`. Without a workflow step that writes the job `PATH`
   there, commands use the image's Node 20.
4. The sync fetches the local `HEAD` on the box when GitHub has that commit.
   Then it copies the uncommitted changes. It does not copy Git-ignored files.
   When GitHub does not have `HEAD`, the box keeps its old `HEAD` and gets the
   new commits as uncommitted changes.
5. `GITHUB_SHA`, `GITHUB_ACTIONS` and `CI` are not set in `testbox run`
   sessions.
6. `blacksmith testbox stop` does not end the GitHub run at once.
   Cancel the GitHub run when `gh` is available.
7. All 11 boxes became ready together. No box waited in a queue.
8. The CLI sync fetches the local `HEAD` with
   `git fetch --no-tags --depth 50`. A local Git test showed that this fetch
   makes a full clone shallow every time it runs, even when the commit is
   already present. History and release tags older than 50 commits then
   disappear. `git fetch --unshallow --tags origin` restores them.

## Decisions

### Executor Selection

`cargo xtask check` gets `--executor auto|local|remote`. The
`MOKLY_CHECK_EXECUTOR` variable sets the default value, and the flag overrides
it. When neither is set, the value is `auto`. `local` skips the conditions
below.

Remote execution applies only to the complete gate. A `--suite` request always
runs locally. `--executor remote` with `--suite` fails before any work starts.

For `auto` and `remote`, xtask checks these conditions in order. The first
condition that matches decides the result.

| Condition                                  | `auto`                       | `remote`                  |
| ------------------------------------------ | ---------------------------- | ------------------------- |
| `GITHUB_ACTIONS` is `true`                 | Local                        | Error                     |
| `BLACKSMITH_ORG_TOKEN` is empty or not set | Local, one information line  | Use the current CLI login |
| `blacksmith`, `rsync` or `ssh` is missing  | Local, warning with a hint   | Error with a hint         |
| Login with the key fails                   | Local, warning               | Error                     |
| `blacksmith testbox list` fails            | Local, warning               | Error                     |
| No `refs/remotes/origin/*` ref has `HEAD`  | Local, warning to push first | Error                     |
| A warmup, readiness or sync probe fails    | Stop boxes, then local       | Stop boxes, then error    |
| All conditions pass                        | Remote                       | Remote                    |

The hint for a missing CLI is the official install command:
`curl -fsSL https://get.blacksmith.sh | sh`.

xtask falls back to local only before the first suite command starts. After
that point, every failure fails the check. One check never mixes local and
remote suite results. `cargo xtask executor` prints the decision and its
reason. It does not warm up boxes.

### Key And CLI Handling

- xtask reads the key only from `BLACKSMITH_ORG_TOKEN`. It sends the key to
  `blacksmith auth login --api-token -` on stdin. The key never appears in
  command arguments, logs, remote commands or reports.
  Login saves it in `~/.blacksmith/credentials` and replaces the saved login
  for the same organization.
- xtask sets `BLACKSMITH_DISABLE_AUTO_UPDATE=1` for every CLI call. It prints
  the CLI version.
- xtask never installs the CLI. The Conductor cloud snapshot includes the
  CLI, `rsync` and `ssh`. The snapshot must not contain
  `~/.blacksmith/credentials`. Developers install the CLI themselves.

### Testbox Workflow

`.github/workflows/blacksmith-testbox.yml` follows the trial workflow with
these rules:

- The triggers are `workflow_dispatch` with the `testbox_id` input, and `push`
  limited to changes of the workflow file. A push run uses Blacksmith's
  validation mode.
- The permissions are `contents: read`. The workflow uses no secrets.
- One job runs on `blacksmith-2vcpu-ubuntu-2404` with `timeout-minutes: 30`.
- The steps run in this order:
  1. Full-history checkout with `persist-credentials: false`. The repository
     is public, so the box can fetch pushed commits without a token.
  2. `useblacksmith/begin-testbox`.
  3. Node 22.14.0 with the npm download cache, then npm 11.21.0.
  4. Rust 1.95.0 with rustfmt and Clippy.
  5. `npm ci`, then a SHA-256 stamp of `package-lock.json` at
     `$HOME/.mokly-testbox/package-lock.sha256`.
  6. Chromium with its system dependencies.
  7. The job `PATH` and `PLAYWRIGHT_CHANNEL=chromium`, written to
     `/etc/environment`.
  8. `useblacksmith/run-testbox`.
- Each action uses a pinned commit hash with a version comment.
- `Required CI` does not depend on this workflow.

### Remote Run

1. xtask computes the local source-tree fingerprint and reads the local `HEAD`.
2. xtask warms up 11 boxes in parallel with `--ref main` and
   `--idle-timeout 30`. `MOKLY_TESTBOX_REF` overrides the ref for tests before
   merge.
3. xtask probes each box with `blacksmith testbox run` and a 10-minute
   readiness limit. The probe runs `scripts/verification/source-tree.mjs` with
   `--expect` and `--print-head`. Every box must match the fingerprint and
   report the local `HEAD`.
4. xtask starts the 11 commands in parallel: `repository`, `package`, `unit`
   shards 1 to 4 of 4, `browser` shards 1 to 4 of 4, and `hydration`. Each
   command runs `node scripts/verification/testbox-suite.mjs` on its box.
5. As each command ends, xtask downloads its report when it produces one.
   Then it cleans up that box at once. It does not wait for another command.
6. Final cleanup covers only boxes that are not yet stopped.
   Status proves an already-completed box needs no stop or cancellation.
   Other boxes use status, stop and then optional GitHub cancellation.
   A failed cancel prints a warning only.
7. xtask runs `scripts/verification/aggregate.mjs` with the local `HEAD` and
   the `node-22.14.0` runtime profile.
8. xtask computes the local fingerprint again. A changed tree fails the check.

The check passes only when all 11 commands exit 0, all 9 reports download, the
aggregate passes and the local tree did not change. The report schema does not
change. The box `HEAD` equals the local `HEAD`, so the commit check stays
valid. The fingerprint check covers the uncommitted changes.

### Remote Suite Wrapper

`scripts/verification/testbox-suite.mjs` runs on the box. It does these steps:

1. It stops with a failure when the fingerprint differs.
2. When the box repository is shallow, it runs
   `git fetch --unshallow --tags origin`. Each `testbox run` sync makes the
   clone shallow again, so this step runs in every suite command.
3. It compares the `package-lock.json` digest with the workflow stamp. When
   they differ, it runs `npm ci` and `npx playwright install chromium`.
4. It runs `cargo xtask check --executor local --suite <suite>` with the
   optional shard. It sets `MOKLY_VERIFICATION_REPORT` to
   `.context/verification-reports/remote/<command>.json`.
5. It exits with the exit code of the suite.

### Source-Tree Fingerprint

`scripts/verification/source-tree.mjs` runs locally and on each box:

- It lists paths with `git ls-files -z --cached --others --exclude-standard`.
  It removes duplicates and sorts the paths by bytes. It skips listed paths
  that do not exist.
- Each record holds the mode (`100644`, `100755` or `120000`), the path and the
  SHA-256 of the content. For a symbolic link, the content is the link target.
- The output is `sha256:` followed by the SHA-256 of all records.
- A Git submodule entry makes the command fail.

### Cleanup, Interrupts And Output

- xtask stops every warmed box on success, on failure, on Ctrl-C and on
  SIGTERM. The idle timeout and the job timeout limit the cost when xtask is
  killed.
- xtask prints one progress line when each command starts and when it ends. It
  writes the output of each command to
  `.context/verification-logs/remote/<run>/`. For a failed command, it prints
  the last 60 lines and the log path. The summary lists durations and box IDs.

### Out Of Scope

- Remote runs for a selected `--suite`.
- Remote runs when GitHub does not have the local `HEAD`. A later change can
  copy unpushed commits to the boxes.
- Box reuse between checks.
- The native macOS and Windows tests and the Node 24 release profile. They stay
  in hosted CI.

## Prerequisites

The separate advisory fixes are merged from main.
Use that dependency tree for the remaining remote smoke checks.

## Milestone 1: Contract documentation — completed

Define the complete remote verification contract before any code changes.

- [x] Add `docs/protocol/remote-verification.md`. Give it a Delivery Status
      that names this plan. Define every rule in the Decisions section. Split
      it into a second page if it becomes longer than 250 lines.
- [x] Link the new page from `docs/protocol/README.md`.
- [x] Update `docs/protocol/ci-verification.md`. State that the complete gate
      can run on Testboxes, and link the new page. Keep the page at 250 lines
      or less.
- [x] Update `docs/protocol/ci-workflow.md`. Describe the Testbox workflow,
      its triggers, runner tier, timeout and pinned actions. State that
      `Required CI` does not depend on it.
- [x] Update `docs/protocol/ci-verification-security.md`. Define the key
      handling, the box secret boundary and `persist-credentials: false`.
- [x] Read `docs/protocol/npm-release.md`. State that the release workflow
      always runs the local gate, because it runs in GitHub Actions.
- [x] Run Prettier and the protocol size, history and link tests. Review the
      diff.
- [x] Commit.

Evidence: `.context/blacksmith-remote-verification/milestone-1-evidence.md`.

## Milestone 2: Fingerprint and suite wrapper scripts — completed

Add the two scripts that the boxes run. Nothing calls them yet.

- [x] Add failure-first tests for `scripts/verification/source-tree.mjs`:
  - [x] Content, mode, path and deletion changes change the fingerprint.
  - [x] Untracked files change it, and Git-ignored files do not.
  - [x] Symbolic links use their target, and a submodule entry fails.
  - [x] An unpushed commit and the same uncommitted change give the same
        fingerprint.
- [x] Implement `source-tree.mjs` with `--expect` and `--print-head`. Add a
      `.d.mts` declaration if TypeScript tests import it.
- [x] Add failure-first tests for `scripts/verification/testbox-suite.mjs`.
      Inject the process runner. Cover a fingerprint mismatch, a shallow and
      a complete repository, a changed and an unchanged lockfile stamp, the
      exact xtask command, the report path and the exit code.
  - [x] Reject invalid arguments before any work starts.
  - [x] Cover preparation failures, streamed output and signal forwarding.
- [x] Implement `testbox-suite.mjs`. Keep each file at 300 lines or less.
      Until Milestone 4 adds `--executor`, the wrapper runs
      `cargo xtask check --suite <suite>` without that flag.
- [x] Run the focused tests with a 100% pass rate.
- [x] Run ESLint, the test TypeScript check and Prettier. Run the source
      length audit and `cargo xtask check`. Record any existing gate blocker.
- [x] Commit.

Evidence: `.context/blacksmith-remote-verification/milestone-2-evidence.md`.

## Milestone 3: Testbox workflow — completed

Add the dispatch workflow and prove that it prepares a usable box.

- [x] Add a failure-first workflow test. Cover the triggers, permissions,
      runner tier, timeout, pinned actions, step order, toolchain versions
      shared with `ci.yml`, the lockfile stamp and the `/etc/environment` step.
- [x] Add `.github/workflows/blacksmith-testbox.yml`. Confirm that
      `useblacksmith/checkout` accepts `persist-credentials: false`.
- [x] Run the new test, `tests/workflow_runner_sizes.test.ts` and
      `tests/ci_workflow_remote_state.test.ts`. Run actionlint when it is
      available.
  - [x] Run ESLint, TypeScript, Prettier and the protocol tests.
  - [x] Run `cargo xtask check` before the workflow commit and push.
- [x] Commit and push. Confirm that the push run passes in validation mode.
- [x] Smoke test: warm up one box with `--ref <branch>`. Run the repository
      and package suites through `testbox-suite.mjs`. Confirm Node 22.14.0,
      `chromium`, a complete Git history and passing release-tag ratchets.
      Stop the box.
  - [x] Match the box fingerprint and `HEAD` to the local checkout.
  - [x] Confirm Node, npm, Rust and the Chromium channel.
  - [x] Confirm complete history during the suite and passing ratchets.
  - [x] Pass the package suite.
  - [x] Stop the box, cancel the GitHub run and confirm no active box.
  - [x] Pass the repository suite after the separate advisory fixes.
- [x] Record smoke durations, versions and run IDs. Update the delivery
      status. Commit and push the completed documentation.

Evidence: `.context/blacksmith-remote-verification/milestone-3-evidence.md`.

## Milestone 4: Explicit remote executor — completed

Add `--executor remote`. The default `auto` keeps the local behavior in this
milestone.

The user approved a 30-minute idle timeout. Readiness stays at 10 minutes.
Per-box cleanup and diagnostics follow the approved contract.

- [x] Run `cargo add ctrlc --features termination` in `xtask`.
- [x] Add failure-first unimock tests at each new trait boundary:
  - [x] Warmup output parsing, including output without exactly one box ID.
  - [x] A failed warmup, readiness probe or sync probe.
  - [x] A box `HEAD` that differs from the local `HEAD`.
  - [x] A failed suite command, report download or aggregate.
  - [x] A local tree that changes during the run.
  - [x] An interrupt during warmup and during the suites.
  - [x] Each case stops every warmed box. No suite command starts before all
        probes pass.
- [x] Reject repeated box IDs from separate warmup requests.
- [x] Add `--executor` and `MOKLY_CHECK_EXECUTOR`.
- [x] Make `testbox-suite.mjs` pass `--executor local`, and update its tests.
- [x] Implement the remote runner in `xtask/src/remote/`:
  - [x] Put availability checks, the Testbox client, the fingerprint reader,
        the aggregate runner, the log writer and the interrupt guard behind
        traits. Inject the concrete implementations in `cli.rs`.
  - [x] Use typed `thiserror` errors and keep tests under `_tests_`.
  - [x] Keep each Rust file at 300 lines or less.
- [x] Update `xtask/README.md` and the developer section of `README.md`.
- [x] Run Rust formatting, Clippy, xtask tests, the Rust length audit and
      the focused Node tests. Run TypeScript, ESLint, Prettier and protocol checks.
- [x] Commit and push.
- [x] Smoke test: run
      `MOKLY_TESTBOX_REF=<branch> cargo xtask check --executor remote`. Record
      the wall time, runner minutes and result. Require all commands and reports.
- [x] Smoke test: press Ctrl-C during the suites. Confirm that
      `blacksmith testbox list` shows no box and that the GitHub runs end.

- [x] Record both smoke checks. Commit and push the plan update.
- [x] Resolve the idle-timeout contract.
- [x] Add failure-first tests for the approved cleanup and diagnostic changes.
- [x] Download each report and clean up its box as its command ends.
      Track stopped boxes for final cleanup.
- [x] Skip stop and cancellation for a matching completed status table row.
- [x] Print failed script output and use clear error and aggregate wording.
- [x] Document saved CLI credentials and the approved timeout.
- [x] Commit and push these fixes before the full remote smoke check.
- [x] Repeat the full remote smoke check with all commands and reports.
- [x] Close Milestones 3 and 4. Commit and push the smoke record.

Evidence: `.context/blacksmith-remote-verification/milestone-4-evidence.md`.

## Milestone 5: Automatic selection — completed

Make `auto` use the remote gate when a working key is present.

- [x] Add failure-first tests for every row of the decision table, for each
      mode and for `--suite` requests. Include `GITHUB_ACTIONS=true` with the
      key set.
- [x] Make `auto` follow the decision table. Fall back to local only before
      the first suite command starts.
- [x] Add `cargo xtask executor`. It prints `remote` or `local` with the
      reason. It does not warm up boxes.
- [x] Update `xtask/README.md` and `README.md`.
- [x] Commit and push.
- [x] Smoke test `cargo xtask executor` in five states: key and CLI present;
      CLI hidden from `PATH`; key not set; `GITHUB_ACTIONS=true`; `HEAD` not
      pushed.
- [x] Smoke test one complete `cargo xtask check` with `auto`.
- [x] Run formatting, Clippy, Rust tests, length audits and focused Node tests.
- [x] Record all automatic selection smoke states before the final push.

Evidence: `.context/blacksmith-remote-verification/milestone-5-evidence.md`.

## Milestone 6: Verification, close-out and review — completed

Confirm that both executors pass on the current main dependency tree.
Leave the final review to the separate reviewer.

- [x] Fetch `origin/main` and confirm that its live dependency audit passes.
      Merge new main commits into the branch, if needed. Follow the mainline
      preservation rules.
- [x] Run all tests for this change with a 100% pass rate. Run
      `cargo fmt --all -- --check`, Clippy and `cargo xtask check`. Fix every
      failure.
  - [x] Run the complete gate with `--executor local`.
  - [x] Commit and push all work before the automatic remote gate.
  - [x] Run the default automatic gate with the branch workflow ref.
        Confirm that all commands and reports pass, the aggregate passes,
        and the local source tree stays unchanged.
  - [x] Confirm that no Testbox remains and that its GitHub workflows end.
- [x] Inspect the diff and the deletions against `origin/main`.
- [x] After the checks pass, run `git add -A`, commit with Conventional
      Commits and push the branch.
- [x] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. The reviewer
      reports the findings. Keep the review read-only. The implementer then
      applies the review-fix rule in `AGENTS.md`. Fix the `Auto-fix: yes`
      findings. Run the checks. Commit and push. Re-review once. Fix any new
      `Auto-fix: yes` findings once more. Run the checks. Commit and push.
      Then stop and report the rest. Add each open finding as one line under
      this TODO.
  - Re-review of `d05a167d`: no new findings.
  - Open finding 1 (High): Closed output can stop box cleanup; approved, Milestone 7, option C: best-effort output and a panic cleanup guard.
  - Open finding 2 (Medium): Local fallback can ignore stop signals; approved, Milestone 7, option A: release the signal handler before fallback.
  - Open finding 3 (Medium): New verification tests fail on macOS; approved, Milestone 7, option A: guard Linux-only work inside each test without skip.
  - Open finding 4 (Medium): OS adapters need more test coverage.
  - Open finding 5 (Low): Cleanup counts attempts and can hide stop failures.
  - Open finding 6 (Low): Tag pushes start the Testbox workflow.
  - Open finding 7 (Low): Nested Git trees fail without a path in the error.
  - Open finding 8 (Low): Local suites receive the Blacksmith org key.
  - Open finding 9 (Low): Only the first missing tool is named.
  - Open finding 10 (Low): Invalid wrapper input shows the wrong command help.
  - Open finding 11 (Low): The timestamp dependency adds unused packages.
  - Open finding 12 (Low): Cancellation warnings can follow completed runs.
  - Open finding 13 (Low): Warning lines repeat the output prefix.
  - Open finding 14 (Medium): A Blacksmith API outage skips GitHub run
    cancellation, because cleanup reads run IDs only from `testbox status`.

Evidence: `.context/blacksmith-remote-verification/milestone-6-evidence.md`.

## Milestone 7: Approved review fixes — completed

Fix the three findings that the user approved on 2026-10-07. Keep findings 4
through 14 open. Leave the final review and PR to the separate reviewer.

User decisions:

- Finding 1, option C: make terminal output best effort. Add a cleanup guard
  that stops remaining boxes when a panic unwinds the runner.
- Finding 2, option A: release the signal handler before local fallback.
  Read the interrupt flag again after release.
- Finding 3, option A: run Linux-only work only on Linux, inside each test.
  Do not skip these tests. Use the existing Windows skip for POSIX signal tests.

Required work:

- [x] Update the remote contract and matching README text before implementation.
- [x] Finding 1: write failing output and panic cleanup tests. Confirm the
      failures. Make output best effort. Track remaining boxes in one guard.
- [x] Finding 2: write failing signal decision and fallback order tests.
      Confirm the failures. Release the handler before fallback and read the
      flag again. Keep paths that never arm the handler unchanged.
- [x] Finding 3: write failing platform coverage first. Confirm the failures.
      Keep byte and script assertions on every platform. Run Linux-only file
      and script work only on Linux. Guard signal tests on Windows.
- [x] Run Rust formatting, Clippy with `-D warnings`, xtask tests, both length
      lints, Prettier, ESLint, prepared TypeScript, protocol tests and the
      focused verification and CI Node tests with the pinned Node and npm.
- [x] Commit the fixes. Name findings 1 to 3 and their options in the body.
- [x] Fetch and merge `origin/main` with a merge commit. Follow Mainline
      Feature Preservation. Confirm two parents. Review each path in the
      remerge diff. Record all six merge resolutions in
      `.context/blacksmith-remote-verification/merge-justifications.md`.
- [x] Inspect the diff and deletions against `origin/main`. Push the branch.
- [x] Run `cargo xtask check` in default mode with
      `MOKLY_TESTBOX_REF=calummoore/blacksmith-ci-remote-testing`. Require
      11/11 commands, 9/9 reports and no active box. If the API fails before
      suites start, clean up and retry once. Record both attempts.
- [x] Update the plan after all checks pass. Run `git add -A`. Commit with
      Conventional Commits and push the branch.
- [x] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. The reviewer
      reports the findings. Keep the review read-only. The implementer then
      applies the review-fix rule in `AGENTS.md`. Fix the `Auto-fix: yes`
      findings. Run the checks. Commit and push. Re-review once. Fix any new
      `Auto-fix: yes` findings once more. Run the checks. Commit and push.
      Then stop and report the rest. Add each open finding as one line under
      this TODO.
  - Review of `546ee727` and merge `e17f24a0`: no new findings.

Evidence: `.context/blacksmith-remote-verification/milestone-7-evidence.md`.

## Post-merge follow-up (non-blocking)

- Create a cloud workspace from the new snapshot and `main`. Confirm that the
  CLI is present, that `cargo xtask executor` prints `remote` and that a
  complete check passes with `--ref main`. Record the time and cost of three
  runs.
- Test remote mode on a macOS developer machine, including its `rsync`.
- Ask the user before you delete the trial branch `calummoore/testbox-trial`.
- Evaluate two later changes: copy unpushed commits to the boxes, and reuse
  boxes between checks.
