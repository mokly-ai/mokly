# Remote Verification

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

| Condition                                      | `auto`                              | `remote`                        |
| ---------------------------------------------- | ----------------------------------- | ------------------------------- |
| `GITHUB_ACTIONS` is `true`                     | Local                               | Error                           |
| `BLACKSMITH_ORG_TOKEN` is empty or unset       | Local; one information line         | Use current CLI login; continue |
| `blacksmith`, `rsync` or `ssh` is missing      | Local; warning with an install hint | Error with an install hint      |
| Login with the key fails                       | Local; warning                      | Error                           |
| `blacksmith testbox list` fails                | Local; warning                      | Error                           |
| Base: no origin ref shares history with `HEAD` | Local; warning to fetch or push     | Error                           |
| Warmup, readiness or sync probe fails          | Stop warmed boxes; then local       | Stop warmed boxes; then error   |
| All checks pass                                | Remote                              | Remote                          |

The [base rule](./remote-verification-base.md#base-commit) selects the base
from the local origin refs. It defines symbolic-ref exclusion, common-history
handling, the main merge-base filter and the tie-break. It also defines the
no-base warning. This lookup does not fetch.

A program is missing when `PATH` holds no executable file of that name. One
diagnostic names every missing program, in the order `blacksmith`, `rsync`,
`ssh`, each with its install hint. For a missing CLI, print:

```bash
curl -fsSL https://get.blacksmith.sh | sh
```

For missing `rsync` or `ssh`, tell the caller to install those programs with the
operating system's package manager. Xtask never installs these tools.

Local fallback is allowed only before the first remote suite command starts.
After that boundary, every execution or evidence failure fails the check.
One check must never mix local and remote suite results.
An interrupt or failed preparation cleanup must never start local fallback.
A signal that arrives before local fallback starts prevents the fallback.
During local fallback, SIGINT, SIGTERM or SIGHUP ends xtask at once with exit
status 130.

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

The [security contract](./ci-verification-security.md#testbox-key-and-secret-boundary)
defines how xtask reads `BLACKSMITH_ORG_TOKEN`, logs in with it, and keeps it
secret. The CLI does not read that variable itself. The org token selects its
own organization. Validate access with `blacksmith testbox list` after login.
Do not use `blacksmith auth status` as proof of working credentials.

Set `BLACKSMITH_DISABLE_AUTO_UPDATE=1` for every Blacksmith CLI call.
Print the CLI version. Developers install the CLI themselves.
The Conductor cloud snapshot supplies the CLI, `rsync` and `ssh`.

## Environment Variables

| Variable               | Contract                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLACKSMITH_ORG_TOKEN` | Local org key. An empty or unset value disables automatic remote selection. Explicit remote mode may use the current CLI login.                                  |
| `MOKLY_CHECK_EXECUTOR` | Default mode: `auto`, `local` or `remote`. The CLI flag takes precedence. The default is `auto`.                                                                 |
| `MOKLY_TESTBOX_REF`    | Workflow ref for warmup. The default is `main`. Use a branch ref to test the target before merge. It changes neither the source fingerprint nor the base commit. |

## Remote Run Sequence

Run local scripts and management commands from the workspace root.
Run probes and suite commands from the snapshot under the
[sync-source contract](./remote-verification-base.md#sync-source-and-probe).

1. Read local `HEAD` and the base commit. Build the snapshot. Then read the
   checkout and snapshot fingerprints and require equal values before warmup.
   Record the [run identity](./remote-verification-base.md#identity-output-and-file).
2. Warm up seven boxes in parallel through `blacksmith testbox warmup`.
   Use `.github/workflows/blacksmith-testbox.yml`, `--ref main` and
   `--idle-timeout 30`. Use `MOKLY_TESTBOX_REF` when it is set.
   Record each box ID. Warmup must return exactly one
   box ID per request. Missing, multiple or repeated IDs fail warmup.
3. Probe every box through `blacksmith testbox run`.
   Allow at most 10 minutes for readiness. The probe must confirm both the
   checkout fingerprint and selected base commit on every box.
4. Start the [seven commands](./remote-verification-testbox.md#remote-commands)
   in parallel. Assign one command to each box. No suite may start until
   all probes pass. Each command refreshes every regular copied path that
   differs from the warmup `HEAD` before its first build.
5. When a command ends, download its report if it produces one.
   Collect available failure reports as well as success reports.
   Clean up that box at once under the
   [per-box order](./remote-verification-cleanup.md#per-box-order): close the
   shared SSH connection, cancel the known GitHub run, then apply status and
   stop rules. Do not wait for another command.
6. After all commands end, clean up boxes that are not yet stopped.
7. Run the local report aggregate with the base commit and `node-22.15.0`.
8. Compute the local fingerprint again. Fail if the source tree changed.
9. Remove the snapshot and temporary index under the
   [snapshot cleanup contract](./remote-verification-base.md#snapshot-cleanup).

A successful check requires all seven commands to exit 0. It also requires all
five downloads, a valid aggregate and an unchanged local source tree.
After the first suite command starts, a box that is neither stopped nor proven
completed after all cleanup attempts does not fail the check. The
[cleanup contract](./remote-verification-cleanup.md#cleanup-and-interrupts)
defines its warning. A stop that succeeds on a retry does not fail the check.
Preparation, discovery, missing reports and invalid reports cannot produce
success. Never substitute local suite results after remote execution starts.
Remote runs cover the Linux Node 22.15.0 profile only. Native macOS and Windows
tests and the Node 24 release profile run in hosted CI.

The default warmup command for each box is:

```bash
blacksmith testbox warmup blacksmith-testbox.yml --ref main --idle-timeout 30
```

## Report Download And Aggregation

Use the [Testbox report contract](./remote-verification-testbox.md#report-download-and-aggregation)
for the five downloads, fresh run directories and local aggregate.

## Output And Logs

Terminal output is best effort. A closed stdout or stderr never stops cleanup.
Ignore terminal write errors. Keep each line's format unchanged.

Print one progress line when each suite command starts and when it ends.
Write each command's standard output and standard error to
`.context/verification-logs/remote/<run>/<command>.log`.
For each failed command, print the last 60 log lines and the log path.
The summary lists command durations and box IDs. Preserve logs after cleanup.
The [identity contract](./remote-verification-base.md#identity-output-and-file)
defines the summary's base field and the identity file. Suite reports keep the
CI report schema.
Print `aggregate=passed` or `aggregate=failed` in the summary.
On aggregate or fingerprint read failure, print a warning first.
Then print that command's captured stdout and stderr with the executor prefix.
Describe command termination as `exit <code>` or `a signal`.
Use `[xtask/check]` for the outer error wrapper.
An embedded error keeps its own `[xtask/<area>]` prefix. Remote execution
errors use `[xtask/remote]`.
Reporter lines keep `[xtask/executor]`. No output line repeats a prefix.
Apply the key secrecy rule to diagnostics and captured output.
Cleanup warnings follow the
[command error-text rule](./remote-verification-cleanup.md#command-error-text).
Each keeps one redacted diagnostic line of at most 200 characters.
A failed close warns once and does not fail the check by itself.
A missing control directory or socket prints
`information: no shared SSH connection for <box-id>` once.
A socket that disappears during a failed close prints no close output.

## Related Docs

- [Protocol index](./README.md)
- [Base commit sync](./remote-verification-base.md)
- [Testbox execution](./remote-verification-testbox.md)
- [Cleanup and interrupts](./remote-verification-cleanup.md)
- [CI workflow graph](./ci-workflow.md)
- [CI and npm release](./npm-release.md)
