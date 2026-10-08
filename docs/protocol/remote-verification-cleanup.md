# Remote Verification: Cleanup And Interrupts

Continuation of [Remote Verification](./remote-verification.md).

## Delivery Status

Implemented. Cleanup closes the shared SSH connection, cancels a known run
once, then checks status and stops the box. Cleanup command errors retain one
bounded diagnostic line. Stop retries, completion proof, interrupts and the
panic guard use the same rules. The complete default remote smoke check passes.
The cleanup contract is delivered. The
[prompt shutdown plan](../../plans/testbox-prompt-shutdown.md) records verification
and open findings.

## Cleanup And Interrupts

Stop every warmed box on success, failure, Ctrl-C, SIGTERM and SIGHUP.
Track boxes as warmup requests complete. Cleanup must also cover boxes created
during an interrupted or failed warmup. Stop launching suite commands after
an interrupt. Attempt cleanup for all boxes even if one cleanup call fails.
Clean up boxes in parallel. Each box keeps its own attempt order.
A panic in one cleanup worker must not stop cleanup of the other boxes.

Count each box once after its last cleanup attempt. Count only boxes that are
neither stopped nor proven completed. Before the first suite command starts, a
nonzero count fails preparation and prevents local fallback. After that
boundary, a nonzero count does not fail the check. Each remaining box gets the
final cleanup warning. A check that fails for another reason still reports the
count in its error. An interrupted check cannot pass or start fallback.
Its final error is `verification interrupted; cleanup=<count> boxes remain`.

After final cleanup, one step decides the result. It adds the real count to
every failed or interrupted result. It reads the interrupt state when final
cleanup ends. If the state is set, it skips the aggregate, the final
fingerprint read and the summary. Otherwise it reads the state again after
them. An interrupt seen after final cleanup gives the interrupted error. This
includes a cancelled or signal-stopped aggregate or fingerprint read. Every
other failure gives `verification failed: ... cleanup=<count>`. A failed final
fingerprint read gives `changed-tree=unknown`. A step that an interrupt
cancels returns `an interrupt cancelled the operation`, with no box count.
Before warmup, no box exists, so an interrupted check reports `cleanup=0`.
A close warning or cancellation failure alone does not fail the check.
A successful cancellation does not prove that the box is stopped or completed.

Track successful stops and already-completed boxes. Final cleanup processes
only the remaining boxes. One owner holds box IDs, recorded run IDs, close
state, cancellation state and stop attempt counts across workers and final
cleanup. Record each close or cancellation attempt before its boundary call.
Neither stop retries nor final cleanup may repeat those attempts.

One cleanup guard tracks every warmed box that is not yet stopped or proven
completed. When a panic unwinds the runner, the guard cleans up those remaining
boxes with the normal rules, including the close step. Protect each close,
status, stop, cancel, run-state read, wait and diagnostic call during unwinding.
The guard never panics itself. The guard does no cleanup on a normal return.

## Per-Box Order

Start cleanup after the box's last command and any report download.
Use the same order after a suite, preparation failure, interrupt or panic.

1. Attempt to close the shared SSH connection once, before status, stop or
   cancellation. A close failure warns once and does not stop cleanup.
2. If a recorded GitHub run ID is known and `gh` is available, attempt its
   cancellation once, immediately after the close step.
3. Read box status before each stop attempt. A completed status removes the
   box from pending cleanup. It skips stop and any cancellation not yet
   attempted. It does not undo an earlier cancellation.
4. If status first supplies the run ID and `gh` is available, attempt
   cancellation before stop. Do not cancel again if an earlier attempt failed
   or if a later status supplies another ID.
5. Attempt stop. On failure, use the waits and attempt limit below.
6. After all suite workers end, apply final cleanup to the remaining boxes.

Look up `gh` through the existing program boundary. A missing `gh` skips
cancellation and does not skip status or stop. A failed lookup warns.
Use status, not a successful cancel command or a GitHub run state, as the
completion proof for a box. Keep the stop result as the other success proof.

## Close The Shared SSH Connection

Blacksmith CLI 0.4.65 uses this control socket name:

1. Hash the box ID's UTF-8 bytes with SHA-256. Add no newline.
2. Encode the digest as lowercase hexadecimal. Keep its first 16 characters.
3. Add `.sock`. Resolve that name under the local home directory's
   `.blacksmith/c/` directory.

Read the home directory from `HOME` through the environment boundary.
The spike verified the CLI's use of `HOME` on Linux. The close step uses
`HOME` on every platform. Do not guess another directory.
If `HOME` is unset or empty, print the close warning once with a typed error.
Then continue with cancellation, status and stop.

Use only the current box ID and that exact path. Do not scan sockets, match
processes, kill an SSH process or close another box's connection.
The close step does not need `connection.json`, an address or a port.
It must not read the CLI credential file or a private key.

A missing control directory or socket needs no process. Print this line once
for the box, so a changed CLI socket name is visible:

```text
information: no shared SSH connection for <box-id>
```

When the socket exists, run exactly these arguments through the injected
`Process` boundary, from the workspace root:

```bash
ssh -F /dev/null -S <absolute-control-socket-path> -O exit localhost
```

`-F /dev/null` skips SSH configuration. `-S` selects the existing local
control socket. `-O exit` asks that master to exit. `localhost` supplies the
required destination argument. This command opens no new SSH connection and
sends no key. Pass no private-key argument, remote command or standard input.
The process removes the shared secret environment list and uses the existing
redaction. Give SSH failures their own typed operation for diagnostics.

Exit 0 is success. Discard successful command output, including
`Exit request sent.`. If a failed command's socket has disappeared, treat it
as closed and print nothing. Any other command or file-read failure
prints one warning for the box. Do not retry close. Continue cancellation,
status and stop. Use this warning format with the shared error formatter:

```text
[xtask/executor] warning: could not close SSH connection for <box-id>: <typed-error>
```

The typed error retains its defining module prefix. SSH command errors use
`[xtask/remote]` and the error-text rule below. A close failure may leave the
shared connection open until its existing timeout. It adds no cleanup failure
count by itself. Do not run `ssh -O check` as another cleanup step.

## Status And Stop

Before each stop attempt, run `blacksmith testbox status --id <box-id>`.
Split table lines on ASCII whitespace. Find the header whose first column is
`ID`. Read the column named `STATUS`. Require exactly one row whose first
column is the box ID. If that row's status is exactly `completed`, skip stop
and any cancellation not yet attempted. Count no cleanup failure for that box.
Missing, ambiguous or incomplete table data does not prove completion.
A failed status read still requires a stop attempt.

Use the first numeric `/actions/runs/<digits>` match in status output for the
GitHub run ID when cancellation has not yet been attempted. If status fails
or names no run, use the recorded ID for that box. Record IDs from captured
warmup and probe stdout and stderr, including nonzero exits. A probe ID replaces
an earlier warmup ID. Output with no run ID preserves the earlier ID.
Preserve a status-recovered ID for later cleanup calls.
If no source names a run, print this warning once after the stop attempts,
unless status already proved completion:
`warning: no GitHub run ID for <box-id>; cancellation skipped`.

Run `blacksmith testbox stop --id <box-id>`. Retry a failed stop after 5 seconds,
then after 10 more seconds. Use the injected clock for both waits.
Allow at most three stop attempts per box across all cleanup calls.
Read status again in final cleanup for any box whose attempts are exhausted.
A completed status clears that box's failure without another stop.
A stop that succeeds on a retry does not fail the check.

## GitHub Cancellation

Use `gh run cancel <github-run-id>` at most once per box, at the point defined
in the per-box order. A completed box status skips an unattempted cancellation.
Print this line once, immediately before the cancellation attempt:

```text
information: cleanup box=<box-id> GitHub run=<id>
```

If cancellation fails, read `gh run view <id> --json status --jq .status`.
Trim the output. Map `completed` to the typed completed state. Map every other
nonempty value to the other state. Empty output is a typed read error.
For `completed`, suppress the cancellation warning and print:

```text
information: GitHub run=<id> already ended; cancellation not needed
```

Any other state, empty output or failed state read keeps the cancellation
warning. A failed state read prints its run-state warning before the cancellation
warning. Both warnings retain their typed errors.
Never decide from error text. Cancellation failure alone does not fail the
check or prove that a box completed.

## Command Error Text

For failed status, stop, cancel, run-state and close commands, store the
diagnostic line in the typed command error. Do not format it at the call site.
Trim each line. Select the last standard-error line that is not empty after
trimming. If there is none, select the last such standard-output line.
Use output after process input redaction.
Keep at most 200 characters. Use character boundaries, not byte boundaries.
These five requests have no input and remove the shared secret environment
variables. Never pass a key to them. Errors from other commands stay unchanged.

Append the line to the existing typed error text with `: `.
If neither stream supplies a line, append nothing and add no separator.
Keep the operation and the existing `exit <code>` or `a signal` wording.
Process-start or file-read errors retain their typed source error.
Use the shared warning formatter. Keep each module prefix once.
Error text supplies diagnostics only. It must never decide completion,
whether to retry, cancellation suppression or the cleanup failure count.

## Cleanup Output

Use these exact lines. The reporter adds `[xtask/executor]` once.
Use the shared warning formatter for each line that embeds a typed error.
Keep the error's defining module prefix once. Do not repeat a prefix.

```text
[xtask/executor] information: box=<box-id> already completed; cleanup skipped
[xtask/executor] warning: status for <box-id> failed: <typed-error>
[xtask/executor] warning: could not stop <box-id>: <typed-error>
[xtask/executor] warning: cancellation for <github-run-id> failed: <typed-error>
[xtask/executor] warning: run state for <github-run-id> failed: <typed-error>
[xtask/executor] warning: GitHub lookup failed: <typed-error>
[xtask/executor] warning: cleanup worker for <box-id> failed: <typed-error>
```

After a failed run-state read, print the run-state warning first, then the
cancellation warning.

## Final Cleanup Warning And Limits

After final cleanup, print this warning once for each remaining box:

```text
[xtask/executor] warning: box=<box-id> cleanup failed; run blacksmith testbox stop --id <box-id>; the 30-minute idle timeout ends it
```

The 30-minute idle timeout and 30-minute workflow timeout limit cost if the
local process is killed before cleanup. They also limit the cost of a box that
cleanup cannot stop. Do not change either timeout.
Do not reuse boxes between checks.
Terminal output is best effort. A closed stdout or stderr never stops cleanup.
Ignore terminal write errors.

## Related Docs

- [Protocol index](./README.md)
- [Testbox execution](./remote-verification-testbox.md)
- [Key and secret boundary](./ci-verification-security.md#testbox-key-and-secret-boundary)
- [OpenSSH command reference](https://man.openbsd.org/ssh)
