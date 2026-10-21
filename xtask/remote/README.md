# Remote verification

This reference describes xtask executor selection, remote runs, and their code.
See the [xtask guide](../README.md) for suite commands and local development.

### Executors

`--executor auto|local|remote` overrides `MOKLY_CHECK_EXECUTOR`. An absent
flag and variable select `auto`. `local` runs the complete gate in one
checkout and skips every remote check. A selected `--suite` runs locally in
`auto` or `local` mode. `remote` rejects `--suite` and GitHub Actions, where
`auto` selects local mode. `auto` selects remote mode when
`BLACKSMITH_ORG_TOKEN` is set and every availability check passes. It selects
local mode otherwise, with one information line or one warning. Explicit
`remote` can use the current CLI login when the key is absent.

The [remote contract](../../docs/protocol/remote-verification.md#executor-selection)
defines the availability order: the key, then the programs `blacksmith`,
`rsync`, and `ssh` on `PATH`, then login, then `blacksmith testbox list`,
then a pushed base commit, then warmup, readiness, and the sync probe. One
diagnostic names every missing program with its install hint. Key login
sends the key to `blacksmith auth login --api-token -` on standard input. The
CLI never receives the key in arguments or remote commands.

`cargo xtask executor` prints exactly `<executor>: <reason>` on standard
output and exits 0 for either decision. The CLI version and diagnostics go to
standard error. An invalid or rejected mode exits nonzero.

Every xtask child removes `BLACKSMITH_ORG_TOKEN` and the Git repository
variables from its environment, including the settings carried by
`GIT_CONFIG_PARAMETERS` and `GIT_CONFIG_COUNT`. Git in each child then finds
its repository from its own working directory. The
[child environment rule](../../docs/protocol/ci-verification-security.md#child-environment)
names both lists.

### Remote Runs

A remote run follows the
[run sequence](../../docs/protocol/remote-verification.md#remote-run-sequence).
It builds a fresh detached snapshot under
`.context/verification-snapshots/<run>/` with the checkout's working files and
a pushed base as `HEAD`. The
[base rule](../../docs/protocol/remote-verification-base.md#base-commit) selects
that base from the local origin refs without a fetch. The base can equal
checkout `HEAD` or precede unpushed commits, and the main merge-base filter
keeps the checkout and box comparison bases equal. The checkout's `HEAD`,
index, and files do not change. The checkout and snapshot fingerprints must
match before warmup.

Xtask warms up seven boxes in parallel with a 30-minute idle timeout, probes
every box within the 10-minute readiness bound, and reports the successful
probe count from that box list. A failed probe emits no success count.
It then starts the
[seven commands](../../docs/protocol/remote-verification-testbox.md#remote-commands)
in parallel, one per box: `repository`, `viewer`, and `browser-1-of-4` to
`browser-4-of-4`, plus `static-delivery`. The delivery command builds the source
and checks both HTTP and file delivery. The suite wrapper stages the synced tree after its
fingerprint check, so index readers see the same tree as a committed
checkout. When a command ends, its worker downloads its report and cleans up
its box at once. Only the viewer command and the four browser shards produce
suite reports; repository and delivery outcomes use their exit codes. After all commands end,
xtask cleans up the remaining boxes, runs the local aggregate over the five
reports with the base commit and `node-22.15.0`, computes the local
fingerprint again, and removes the snapshot. A successful check needs seven
commands that exit 0, five downloads, a valid aggregate, and the same local
fingerprint as before the run.

Each check creates new report and log directories under `.context/`. Their
shared run name is UTC `YYYYMMDDTHHMMSSZ` followed by `-<process-id>`. Reports
go under `.context/verification-reports/remote/<run>/` and logs under
`.context/verification-logs/remote/<run>/<command>.log`. `identity.json`
beside the logs records checkout `HEAD`, base, ahead count, and fingerprint.
A failed command shows its last 60 log lines and the log path. The summary
names the base, the aggregate outcome as `passed` or `failed`, and the count
of boxes that are neither stopped nor proven completed. Every failed or
interrupted final result carries that actual count, including failed final
fingerprint reads. An unreadable final fingerprint reports an unknown tree
comparison and fails verification. Each failed aggregate or fingerprint read
prints a warning, including reads cancelled by an interrupt.

Local fallback happens only before the first suite command starts. After that
boundary every failure fails the check, and one check never mixes local and
remote results. An interrupt or a failed preparation cleanup never starts
fallback. Before fallback xtask releases its signal handler. SIGINT, SIGTERM,
or SIGHUP after release ends xtask at once with exit status 130.

Cleanup follows the
[per-box order](../../docs/protocol/remote-verification-cleanup.md#per-box-order):
close the shared SSH connection once, cancel the known GitHub run once when
`gh` is available, read status, then stop with at most three attempts per
box. Boxes clean up in parallel. A completed status proves that the box needs
no stop. A guard applies the same rules when a panic unwinds the runner. A
box that cleanup cannot stop gets a warning with its manual stop command; the
30-minute idle timeout ends it.

Set `MOKLY_TESTBOX_REF=<pushed branch>` only to test a changed Testbox
workflow before it merges. It changes neither the fingerprint nor the base.

### Key Code

- [`src/remote/availability.rs`](../src/remote/availability.rs) and
  [`policy.rs`](../src/remote/policy.rs) own the ordered availability checks.
  [`runner.rs`](../src/remote/runner.rs) owns the remote phase order,
  [`verdict.rs`](../src/remote/verdict.rs) attaches the final cleanup count,
  [`plan.rs`](../src/remote/plan.rs) owns the seven-command inventory,
  [`phases.rs`](../src/remote/phases.rs) parallel warmup and the all-probes
  barrier, and [`suites.rs`](../src/remote/suites.rs) concurrent suite
  execution and report downloads.
- [`src/remote/base.rs`](../src/remote/base.rs) selects the typed pushed
  ancestor and preserves the main merge base, and
  [`git_identity.rs`](../src/remote/git_identity.rs) validates Git object
  names. [`preparation.rs`](../src/remote/preparation.rs) builds and compares
  the snapshot before warmup, and [`identity.rs`](../src/remote/identity.rs)
  formats the typed run evidence.
- [`src/remote/snapshot/system.rs`](../src/remote/snapshot/system.rs) creates
  snapshots through injected process and file boundaries. Its
  [runner guard](../src/remote/snapshot/guard.rs) and
  [construction guard](../src/remote/snapshot/construction.rs) own cleanup.
- [`src/remote/contracts.rs`](../src/remote/contracts.rs) defines the injected
  environment, Git, CLI, clock, script, log, signal, and output boundaries.
  [`reporting.rs`](../src/remote/reporting.rs) formats error warnings with one
  copy of each module prefix, [`logs.rs`](../src/remote/logs.rs) owns run
  directories, streamed log files, and failure tails, and
  [`process.rs`](../src/remote/process.rs) streams output and kills child
  process groups on interrupts.
- [`src/remote/cleanup/guard.rs`](../src/remote/cleanup/guard.rs) owns box
  state and final counts, [`steps.rs`](../src/remote/cleanup/steps.rs) owns
  close, status, and stop retries, and
  [`cancellation.rs`](../src/remote/cleanup/cancellation.rs) owns the single
  cancel attempt and run-state diagnostics.
  [`src/remote/clients/outcome.rs`](../src/remote/clients/outcome.rs) owns
  command errors and bounded cleanup details for the Blacksmith, GitHub, and
  SSH adapters, and [`disconnect.rs`](../src/remote/clients/disconnect.rs)
  owns the socket identity and the SSH close.
- [`../scripts/verification/testbox-suite.mjs`](../../scripts/verification/testbox-suite.mjs)
  is the suite wrapper on each box,
  [`source-tree.mjs`](../../scripts/verification/source-tree.mjs) computes the
  fingerprint, and [`aggregate.mjs`](../../scripts/verification/aggregate.mjs)
  validates the report aggregate with
  [`report-validation.mjs`](../../scripts/verification/report-validation.mjs)
  and [`shard-balance.mjs`](../../scripts/verification/shard-balance.mjs).
