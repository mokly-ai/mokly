# Blacksmith Remote Verification

Status: Active. No pull request exists yet. Work starts at Milestone 1.

Run the complete `cargo xtask check` gate on Blacksmith Testboxes when a
Blacksmith key is available. Run it locally when no key is available. The key
is the `BLACKSMITH_ORG_TOKEN` environment variable. The remote gate runs the
same 11 commands as hosted CI on 11 boxes at the same time. Then it validates
the same shard evidence. In the trial, it finished in about 10 minutes. The
local gate runs the same suites one after another.

This change covers xtask, verification scripts, one GitHub workflow, the
Conductor setup script and their documentation. It has no product UI or mockup
work.

Contract owners:

- `docs/protocol/remote-verification.md`, which Milestone 1 adds.
- [CI verification](../docs/protocol/ci-verification.md).
- [CI workflow graph](../docs/protocol/ci-workflow.md).
- [CI dependency cache and security](../docs/protocol/ci-verification-security.md).
- The [xtask README](../xtask/README.md) and the
  [repository README](../README.md).

## Trial Evidence

The trial ran on 2026-10-06 with Blacksmith CLI 0.4.65. It used a
dispatch-only workflow on the branch `calummoore/testbox-trial`, Node 22.14.0
and the 2-vCPU runner tier. The CI times come from the green run
[37390227144](https://github.com/mokly-ai/mokly/actions/runs/37390227144).

| Measure                      | CI               | Testbox       |
| ---------------------------- | ---------------- | ------------- |
| Start to finish              | 13m33s           | 10m02s        |
| Hydration suite (longest)    | 9m36s            | 8m36s         |
| Slowest unit / browser shard | 7m14s / 8m26s    | 7m27s / 6m44s |
| Box ready after warmup       | Not applicable   | 60–70 s       |
| First sync of local changes  | Not applicable   | About 2 s     |
| Runner minutes / cost        | About 75 / $0.30 | 129.9 / $0.52 |

The local aggregate accepted all 9 reports with 5,444 test results. The
repository suite failed for the same dependency advisory as `main`.

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
6. `blacksmith testbox stop` ends the GitHub run 15 seconds to 5 minutes
   later. That delay was about 17% of the trial cost.
7. All 11 boxes became ready together. No box waited in a queue.

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
- xtask sets `BLACKSMITH_DISABLE_AUTO_UPDATE=1` for every CLI call. It prints
  the CLI version.
- xtask never installs the CLI. The Conductor setup script installs it in cloud
  workspaces when the key is set. Developers install it themselves.

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
  3. Node 22.14.0 with the npm download cache, then npm 11.7.0.
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
   `--idle-timeout 10`. `MOKLY_TESTBOX_REF` overrides the ref for tests before
   merge.
3. xtask probes each box with `blacksmith testbox run` and a 10-minute
   readiness limit. The probe runs `scripts/verification/source-tree.mjs` with
   `--expect` and `--print-head`. Every box must match the fingerprint and
   report the local `HEAD`.
4. xtask starts the 11 commands in parallel: `repository`, `package`, `unit`
   shards 1 to 4 of 4, `browser` shards 1 to 4 of 4, and `hydration`. Each
   command runs `node scripts/verification/testbox-suite.mjs` on its box.
5. xtask downloads the 9 unit, browser and hydration reports.
6. xtask stops every box. When `gh` is available, it cancels the GitHub run of
   each box. A failed cancel prints a warning only.
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
2. It compares the `package-lock.json` digest with the workflow stamp. When
   they differ, it runs `npm ci` and `npx playwright install chromium`.
3. It runs `cargo xtask check --executor local --suite <suite>` with the
   optional shard. It sets `MOKLY_VERIFICATION_REPORT` to
   `.context/verification-reports/remote/<command>.json`.
4. It exits with the exit code of the suite.

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

## Prerequisite

Since 2026-10-06, `main` fails the dependency audit for advisory
`GHSA-68fv-2mgg-jv7q` in `source-map-js`. Fix it in a separate change before
Milestone 7. Until then, every complete check fails in the repository suite.

## Milestone 1: Contract documentation

Define the complete remote verification contract before any code changes.

- [ ] Add `docs/protocol/remote-verification.md`. Give it a Delivery Status
      that names this plan. Define every rule in the Decisions section. Split
      it into a second page if it becomes longer than 250 lines.
- [ ] Link the new page from `docs/protocol/README.md`.
- [ ] Update `docs/protocol/ci-verification.md`. State that the complete gate
      can run on Testboxes, and link the new page. Keep the page at 250 lines
      or less.
- [ ] Update `docs/protocol/ci-workflow.md`. Describe the Testbox workflow,
      its triggers, runner tier, timeout and pinned actions. State that
      `Required CI` does not depend on it.
- [ ] Update `docs/protocol/ci-verification-security.md`. Define the key
      handling, the box secret boundary and `persist-credentials: false`.
- [ ] Read `docs/protocol/npm-release.md`. State that the release workflow
      always runs the local gate, because it runs in GitHub Actions.
- [ ] Run Prettier and the protocol size, history and link tests. Review the
      diff.
- [ ] Commit.

## Milestone 2: Fingerprint and suite wrapper scripts

Add the two scripts that the boxes run. Nothing calls them yet.

- [ ] Add failure-first tests for `scripts/verification/source-tree.mjs`:
  - [ ] Content, mode, path and deletion changes change the fingerprint.
  - [ ] Untracked files change it, and Git-ignored files do not.
  - [ ] Symbolic links use their target, and a submodule entry fails.
  - [ ] An unpushed commit and the same uncommitted change give the same
        fingerprint.
- [ ] Implement `source-tree.mjs` with `--expect` and `--print-head`. Add a
      `.d.mts` declaration if TypeScript tests import it.
- [ ] Add failure-first tests for `scripts/verification/testbox-suite.mjs`.
      Inject the process runner. Cover a fingerprint mismatch, a changed and
      an unchanged lockfile stamp, the exact xtask command, the report path
      and the exit code.
- [ ] Implement `testbox-suite.mjs`. Keep each file at 300 lines or less.
- [ ] Run the focused tests with a 100% pass rate.
- [ ] Commit.

## Milestone 3: Testbox workflow

Add the dispatch workflow and prove that it prepares a usable box.

- [ ] Add a failure-first workflow test. Cover the triggers, permissions,
      runner tier, timeout, pinned actions, step order, toolchain versions
      shared with `ci.yml`, the lockfile stamp and the `/etc/environment` step.
- [ ] Add `.github/workflows/blacksmith-testbox.yml`. Confirm that
      `useblacksmith/checkout` accepts `persist-credentials: false`.
- [ ] Run the new test, `tests/workflow_runner_sizes.test.ts` and
      `tests/ci_workflow_remote_state.test.ts`. Run actionlint when it is
      available.
- [ ] Commit and push. Confirm that the push run passes in validation mode.
- [ ] Smoke test: warm up one box with `--ref <branch>`. Run the package suite
      through `testbox-suite.mjs`. Confirm Node 22.14.0 and `chromium`. Stop
      the box.

## Milestone 4: Explicit remote executor

Add `--executor remote`. The default `auto` keeps the local behavior in this
milestone.

- [ ] Run `cargo add ctrlc --features termination` in `xtask`.
- [ ] Add failure-first unimock tests at each new trait boundary:
  - [ ] Warmup output parsing, including output without exactly one box ID.
  - [ ] A failed warmup, readiness probe or sync probe.
  - [ ] A box `HEAD` that differs from the local `HEAD`.
  - [ ] A failed suite command, report download or aggregate.
  - [ ] A local tree that changes during the run.
  - [ ] An interrupt during warmup and during the suites.
  - [ ] Each case stops every warmed box. No suite command starts before all
        probes pass.
- [ ] Add `--executor` and `MOKLY_CHECK_EXECUTOR`.
- [ ] Implement the remote runner in `xtask/src/remote/`:
  - [ ] Put availability checks, the Testbox client, the fingerprint reader,
        the aggregate runner, the log writer and the interrupt guard behind
        traits. Inject the concrete implementations in `cli.rs`.
  - [ ] Use typed `thiserror` errors and keep tests under `_tests_`.
  - [ ] Keep each Rust file at 300 lines or less.
- [ ] Update `xtask/README.md` and the developer section of `README.md`.
- [ ] Commit and push.
- [ ] Smoke test: run
      `MOKLY_TESTBOX_REF=<branch> cargo xtask check --executor remote`. Record
      the wall time, runner minutes and result.
- [ ] Smoke test: press Ctrl-C during the suites. Confirm that
      `blacksmith testbox list` shows no box and that the GitHub runs end.

## Milestone 5: Automatic selection

Make `auto` use the remote gate when a working key is present.

- [ ] Add failure-first tests for every row of the decision table, for each
      mode and for `--suite` requests. Include `GITHUB_ACTIONS=true` with the
      key set.
- [ ] Make `auto` follow the decision table. Fall back to local only before
      the first suite command starts.
- [ ] Add `cargo xtask executor`. It prints `remote` or `local` with the
      reason. It does not warm up boxes.
- [ ] Update `xtask/README.md` and `README.md`.
- [ ] Commit and push.
- [ ] Smoke test `cargo xtask executor` in five states: key and CLI present;
      CLI hidden from `PATH`; key not set; `GITHUB_ACTIONS=true`; `HEAD` not
      pushed.
- [ ] Smoke test one complete `cargo xtask check` with `auto`.

## Milestone 6: Conductor cloud setup

Install the CLI in new cloud workspaces when the key is set.

- [ ] Add failure-first tests for `scripts/conductor/setup.sh` with stubbed
      commands. Cover a local workspace, no key, a CLI that is present, an
      install, and a failed install that prints a warning and exits 0. The
      script must never print the key.
- [ ] Add `.conductor/settings.toml` with a `scripts.setup` entry that runs
      the script.
- [ ] Implement the script. It runs the official installer only when
      `CONDUCTOR_IS_LOCAL` is `0`, the key is set and the CLI is missing.
- [ ] Document the setup in `README.md`.
- [ ] Smoke test the script in a cloud workspace with an empty install
      directory.
- [ ] Commit.

## Milestone 7: Verification, close-out and review

- [ ] Confirm that the prerequisite advisory fix is on `main`. Merge `main`
      into the branch and follow the mainline preservation rules.
- [ ] Run all tests for this change with a 100% pass rate. Run
      `cargo fmt --all -- --check`, Clippy and `cargo xtask check`. Fix every
      failure.
- [ ] Inspect the diff and the deletions against `origin/main`.
- [ ] After the checks pass, run `git add -A`, commit with Conventional
      Commits and push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Report each
      finding with a number, a severity, a plain explanation, the impact of
      doing nothing, lettered options and a recommendation. Do not change the
      implementation.

## Post-merge follow-up (non-blocking)

- Create a cloud workspace from `main`. Confirm that setup installs the CLI,
  that `cargo xtask executor` prints `remote` and that a complete check passes
  with `--ref main`. Record the time and cost of three runs.
- Test remote mode on a macOS developer machine, including its `rsync`.
- Ask the user before you delete the trial branch `calummoore/testbox-trial`.
- Evaluate two later changes: copy unpushed commits to the boxes, and reuse
  boxes between checks.
