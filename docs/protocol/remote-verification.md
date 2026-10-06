# Remote Verification

## Delivery Status

The active [Blacksmith remote verification plan](../../plans/blacksmith-remote-verification.md)
defines this approved target. Explicit remote execution, the scripts and the
Testbox workflow are implemented. Automatic remote selection and
`cargo xtask executor` are implemented. The complete automatic smoke check passes.
The approved idle timeout is 30 minutes. Per-box cleanup and diagnostics are
implemented. The complete explicit remote smoke check passes.
The [Testbox execution contract](./remote-verification-testbox.md) defines the
workflow, commands, probe, suite wrapper and source-tree fingerprint.

## Executor Selection

`cargo xtask check` accepts `--executor auto|local|remote`. The flag overrides
`MOKLY_CHECK_EXECUTOR`. An unset variable and an absent flag select `auto`.
An invalid effective value fails before work starts.

`local` runs the complete gate sequentially in one checkout. It skips all remote
availability checks. A selected `--suite` runs locally in `auto` or `local` mode.
An effective `remote` mode with `--suite` fails before any work starts.
Remote execution applies only to the complete gate.

For `auto` and `remote`, check the following conditions in this order.
The first terminating result decides the executor. The missing-key row lets
`remote` continue with the current CLI login. Skip key login in that case.

| Condition                                            | `auto`                              | `remote`                        |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------- |
| `GITHUB_ACTIONS` is `true`                           | Local                               | Error                           |
| `BLACKSMITH_ORG_TOKEN` is empty or unset             | Local; one information line         | Use current CLI login; continue |
| `blacksmith`, `rsync` or `ssh` is missing            | Local; warning with an install hint | Error with an install hint      |
| Login with the key fails                             | Local; warning                      | Error                           |
| `blacksmith testbox list` fails                      | Local; warning                      | Error                           |
| No `refs/remotes/origin/*` ref contains local `HEAD` | Local; warning to push first        | Error                           |
| Warmup, readiness or sync probe fails                | Stop warmed boxes; then local       | Stop warmed boxes; then error   |
| All checks pass                                      | Remote                              | Remote                          |

Require this command to print at least one origin ref:

```bash
git for-each-ref --contains HEAD --format=%(refname) refs/remotes/origin/
```

Detect `blacksmith`, `rsync` and `ssh` by searching `PATH` for an executable
file. Do not run those programs to detect them. Run `blacksmith --version`
only after finding the CLI. Name each missing program in the diagnostic.
For a missing CLI, print:

```bash
curl -fsSL https://get.blacksmith.sh | sh
```

For missing `rsync` or `ssh`, tell the caller to install those programs with the
operating system's package manager. Xtask never installs these tools.

Local fallback is allowed only before the first remote suite command starts.
After that boundary, every execution or evidence failure fails the check.
One check must never mix local and remote suite results.
Use a typed unavailable result for preparation failures before any suite.
Use a typed failed result after the execution boundary.
An interrupt or failed preparation cleanup must never start local fallback.

`cargo xtask executor` accepts the same `--executor` flag and mode precedence.
It uses the same availability checks.
It prints exactly one line to standard output: `<executor>: <reason>`.
Send the CLI version and other diagnostics to standard error.
The executor is `local` or `remote`. Both decisions exit 0.
An invalid mode value or a rejected mode exits nonzero. This includes an
explicit remote request in GitHub Actions.
It does not warm up boxes, run probes or execute suites. Its remote decision
therefore confirms availability, not box readiness.

`cargo xtask check` writes its decision, information and warning lines to
standard error. Each line starts with `[xtask/executor]` followed by a space.

## Key And CLI Handling

Read the supplied key only from `BLACKSMITH_ORG_TOKEN`.
Send it to `blacksmith auth login --api-token -` on standard input.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
Never put it in arguments, logs, remote commands or reports.
The CLI does not read that variable itself. The org token selects its own
organization. Validate access with `blacksmith testbox list` after login.
Do not use `blacksmith auth status` as proof of working credentials.

Set `BLACKSMITH_DISABLE_AUTO_UPDATE=1` for every Blacksmith CLI call.
Print the CLI version. Developers install the CLI themselves.
The Conductor cloud snapshot supplies the CLI, `rsync` and `ssh`.
It must not contain `~/.blacksmith/credentials`.
The [security contract](./ci-verification-security.md#testbox-key-and-secret-boundary)
defines the local key and remote secret boundary.

## Environment Variables

| Variable               | Contract                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLACKSMITH_ORG_TOKEN` | Local org key. An empty or unset value disables automatic remote selection. Explicit remote mode may use the current CLI login.                                 |
| `MOKLY_CHECK_EXECUTOR` | Default mode: `auto`, `local` or `remote`. The CLI flag takes precedence. The default is `auto`.                                                                |
| `MOKLY_TESTBOX_REF`    | Workflow ref for warmup. The default is `main`. Use a branch ref to test the target before merge. It does not change the required source fingerprint or `HEAD`. |

## Remote Run Sequence

Run all local and CLI operations from the workspace root.

1. Read local `HEAD`. Compute the local source-tree fingerprint.
2. Warm up 11 boxes in parallel through `blacksmith testbox warmup`.
   Use `.github/workflows/blacksmith-testbox.yml`, `--ref main` and
   `--idle-timeout 30`. Use `MOKLY_TESTBOX_REF` when it is set.
   Record each box ID. Warmup must return exactly one
   box ID per request. Missing, multiple or repeated IDs fail warmup.
3. Probe every box through `blacksmith testbox run`.
   Allow at most 10 minutes for readiness. The probe must confirm both the
   expected fingerprint and local `HEAD` on every box.
4. Start the [11 suite commands](./remote-verification-testbox.md#remote-commands)
   in parallel. Assign one command to each box. No suite may start until
   all probes pass.
5. When a command ends, download its report if it produces one.
   Collect available failure reports as well as success reports.
   Clean up that box at once. Do not wait for another command.
6. After all commands end, clean up boxes that are not yet stopped.
7. Run the local report aggregate with local `HEAD` and `node-22.14.0`.
8. Compute the local fingerprint again. Fail if the source tree changed.

A successful check requires all 11 commands to exit 0. It also requires all
nine downloads, a valid aggregate and an unchanged local source tree.
Preparation, discovery, missing reports and invalid reports cannot produce
success. Never substitute local suite results after remote execution starts.

The default warmup command for each box is:

```bash
blacksmith testbox warmup blacksmith-testbox.yml --ref main --idle-timeout 30
```

## Report Download And Aggregation

The suite wrapper writes each report on its box to
`.context/verification-reports/remote/<command>.json`.
Only unit shards 1 through 4, browser shards 1 through 4 and hydration produce
the nine required reports. Repository and package outcomes use command exits.

Allocate a new local report directory for each run:
`.context/verification-reports/remote/<run>/`.
The `<run>` value is UTC time in `YYYYMMDDTHHMMSSZ` format, a hyphen and the
xtask process ID in decimal. For example, `20261006T134131Z-1234`.
Compute it once at run start. Report and log directories use the same value.
Download each report there under its command name. Do not use reports from
another run. A missing or failed download fails remote verification.
Download each report as its command ends, before stopping that box.

Use the CLI download command for each required report:

```bash
blacksmith testbox download --id <box-id> .context/verification-reports/remote/<command>.json .context/verification-reports/remote/<run>/<command>.json
```

Run the existing aggregate after box cleanup:

```bash
node scripts/verification/aggregate.mjs --reports .context/verification-reports/remote/<run> --commit <local-head> --runtimes node-22.14.0
```

The [existing evidence rules](./ci-verification.md#inventory-and-report-evidence)
still apply. Keep the report schema unchanged. The aggregate must accept
exactly nine reports for the expected commit and runtime profile.
It must prove complete shard coverage and the browser/hydration partition.
The box `HEAD` must equal local `HEAD`, so the commit checks stay valid.
The fingerprint covers uncommitted source changes without changing report
identity. The final local fingerprint check rejects changes made during the run.

## Cleanup And Interrupts

Stop every warmed box on success, failure, Ctrl-C and SIGTERM.
Track boxes as warmup requests complete. Cleanup must also cover boxes created
during an interrupted or failed warmup. Stop launching suite commands after
an interrupt. Attempt cleanup for all boxes even if one cleanup call fails.
Report cleanup failures. An interrupted check cannot pass or start local fallback.
Track successful stops and already-completed boxes. Final cleanup processes
only the remaining boxes. A failed stop stays eligible for final cleanup.

Before stopping each box, run `blacksmith testbox status --id <box-id>`.
Split table lines on ASCII whitespace. Find the header whose first column is
`ID`. Read the column named `STATUS`. Require exactly one row whose first
column is the box ID. If that row's status is exactly `completed`, skip both
stop and cancellation. Count no cleanup failure for that box.
Missing, ambiguous or incomplete table data does not prove completion.
A failed status read still requires a stop attempt.
Read its GitHub run ID from the first `/actions/runs/<digits>` match.
If there is no match, print a warning and skip cancellation for that box.
Then run `blacksmith testbox stop --id <box-id>`.
Use `gh run cancel <github-run-id>` when an ID and `gh` are available.
The 30-minute idle timeout and 30-minute workflow
timeout limit cost if the local process is killed before cleanup.
Do not reuse boxes between checks.

## Output And Logs

Print one progress line when each suite command starts and when it ends.
Write each command's standard output and standard error to
`.context/verification-logs/remote/<run>/<command>.log`.
For each failed command, print the last 60 log lines and the log path.
The summary lists command durations and box IDs. Preserve logs after cleanup.
Print `aggregate=passed` or `aggregate=failed` in the summary.
On aggregate or fingerprint read failure, print a warning first.
Then print that command's captured stdout and stderr with the executor prefix.
Describe command termination as `exit <code>` or `a signal`.
Use `[xtask/check]` for the outer error wrapper.
Apply the key secrecy rule to diagnostics and captured output.

## Out Of Scope

- Remote execution for a selected `--suite`.
- Remote execution when GitHub does not have local `HEAD`.
- Copying unpushed commits to boxes.
- Reusing boxes between checks.
- Native macOS and Windows tests. They remain in hosted CI.
- The Node 24 release profile. It remains in hosted CI.
- Changes to the report schema or release evidence acceptance.

## Related Docs

- [Protocol index](./README.md)
- [Testbox execution](./remote-verification-testbox.md)
- [CI workflow graph](./ci-workflow.md)
- [CI and npm release](./npm-release.md)
