# Testbox Prompt Shutdown

Status: Active. No pull request exists yet. The plan closes when its PR merges.

Stop paying for idle Testbox time after each remote suite command. Today every
box keeps running about 300 seconds after its last command. The Blacksmith CLI
keeps a shared SSH connection open for that time. Blacksmith's job-completed
hook waits for open SSH sessions before it shuts the box down, and Blacksmith
bills that wait.

On 2026-10-07 the user chose option D: keep both the pre-push Testbox check
and CI, and make each Testbox check cheaper. This plan closes each box's SSH
connection during cleanup, cancels the GitHub run sooner and keeps the CLI
error text in cleanup warnings. It also drafts a report for Blacksmith.

This change covers xtask cleanup, the remote verification contract and the
xtask README. It has no product UI or mockup work. It does not change the
Testbox workflow, the suite commands, the reports or the evidence rules.

Baseline evidence: `.context/testbox-prompt-shutdown/baseline.md`.

Contract owners:

- [Remote verification](../docs/protocol/remote-verification.md).
- [Cleanup and interrupts](../docs/protocol/remote-verification-cleanup.md).
- [Testbox execution](../docs/protocol/remote-verification-testbox.md).
- [CI dependency cache and security](../docs/protocol/ci-verification-security.md).
- The [xtask README](../xtask/README.md).

## Findings

The design depends on these measurements from 2026-10-07:

1. In the normal check `20261007T142203Z-391901`, all 11 jobs ended 301 to
   303 seconds after their last command. xtask cancelled the runs 19 to 71
   seconds after the command. The cancel time did not change the end time.
2. Blacksmith's last job step, "Complete runner", runs `/job_completed.sh`.
   While an SSH session is open, it waits and logs
   `Active SSH sessions detected. Will wait upto 290 seconds before force shutdown.`
3. Blacksmith CLI 0.4.65 runs `ssh` with `ControlMaster=auto`, a
   `ControlPath` and `ControlPersist=<seconds>`. It never closes the shared
   connection. The control sockets are probably in `~/.blacksmith/c`. The CLI
   stores each box's address and SSH port in
   `~/.blacksmith/testboxes/<id>/connection.json`.
4. Blacksmith bills the wait. Run 37636091796 lasted 432 seconds, with 240
   seconds in "Complete runner". Blacksmith billed 16 vCPU-minutes for it.
5. In a normal check, 55 of 141 box-minutes come after the last command: 45 in
   the SSH wait and 10 before the cancel.
6. CI jobs, and boxes that reach the 30-minute job limit, have no open SSH
   connection when they end. Their "Complete runner" step takes 0 to 1
   seconds.
7. In 3 checks (13:19, 14:58 and 14:59), 17 boxes ran until the 30-minute job
   limit. In the 14:59 check, `blacksmith testbox stop` returned
   `shutdown failed (502): cancel_failed`, and `gh run cancel` also failed.
   The warnings did not show the `gh` error text, so the cause is unknown.
8. A stop does not end the GitHub run at once. See finding 6 of the
   [Blacksmith remote verification trial](./blacksmith-remote-verification.md#trial-evidence).

## Decisions

1. **Close the connection first.** The first cleanup action for a box closes
   the CLI's shared SSH connection to that box. Cleanup starts after the
   box's last command and report download, so no later command needs the
   connection. Every cleanup path does this: cleanup after a suite,
   preparation failure, final cleanup, interrupts and the panic guard. Each
   box gets one close attempt.
2. **A failed close only warns.** A missing control directory or socket
   starts no process and prints
   `information: no shared SSH connection for <box-id>` once. This makes a
   changed CLI socket name visible. A socket that disappears during a failed
   close counts as closed and prints nothing. Read `HOME` through the
   environment boundary. An unset or empty `HOME` prints the close warning
   once with a typed error. A failed close prints one warning, and cleanup
   continues. The job then ends when the connection times out, as it does
   today. A close failure never fails the check.
3. **Cancel before stop.** When the run ID is known and `gh` is available,
   cleanup cancels the GitHub run once, right after the close. Then the
   existing status and stop rules apply: a completed status needs no stop.
   Milestone 1 must show that a stop after a successful cancel does not fail.
   If it fails, keep today's order (stop, then cancel) and record that in the
   contract.
4. **Keep the error text.** When a status, stop, cancel, run state or close
   command fails, its warning adds the last nonempty line of the command's
   standard error. It uses standard output when standard error is empty. The
   line uses the existing redaction and has at most 200 characters. It is a
   field of the typed error, not text formatted at the call site.
5. **Keep the failure rule.** A box that is neither stopped nor proven
   completed still fails the check. See the open decision below.
6. **Report the problem to Blacksmith.** The agent drafts the report, and the
   user sends it. If Blacksmith fixes the CLI or the hook, a later plan
   removes the workaround.

### Open Decision

- The user decides whether a box that cannot be stopped should only print a
  warning. Today it fails the check even when every test passed. The
  30-minute job limit caps the cost of such a box. This plan keeps the
  current rule until the user decides.

### Out Of Scope

- Removing the pre-push check or CI (options A, B and C).
- The six open Low findings of the
  [review follow-up plan](./remote-verification-review-follow-up.md).
- Changes to the Testbox workflow, the idle timeout, the job timeout, the
  suite commands, the reports or the aggregate.

## Milestone 1: Spike, report and contract

Completed. The spike confirms the close method and cancel-before-stop order.
The protocol defines the full cleanup contract.

Evidence: `.context/testbox-prompt-shutdown/spike.md`.

- [x] Warm up one box from `main` with
      `blacksmith testbox warmup blacksmith-testbox.yml --ref main --idle-timeout 30`.
      Run `true` on it with `blacksmith testbox run`.
- [x] Find the shared connection: the `ssh` master process, its control
      socket and how the socket name maps to the box ID or to
      `connection.json`.
- [x] Close the connection with `ssh -O exit` and that socket. Check that
      `ssh -O check` then fails and that a new `blacksmith testbox run` still
      works. Close the connection again after that run.
- [x] Cancel the box's GitHub run with `gh run cancel`. Record the time until
      the job ends, the "Complete runner" log, the box status and the result
      of a `blacksmith testbox stop` after the cancel.
- [x] Warm up a second box. Run `true`, close the connection and stop the box
      with `blacksmith testbox stop` only. Record how long the stop command
      takes and the time until the job ends.
- [x] Record the billed minutes of both jobs with `blacksmith jobs list`.
      Save the spike evidence in `.context/testbox-prompt-shutdown/spike.md`.
- [x] Choose the close method that needs only the box ID and files that the
      CLI already writes. If no method closes the connection reliably, stop
      and ask the user before Milestone 2.
- [x] Apply the rule of Decision 3 to choose the cleanup order.
- [x] Draft the Blacksmith report in
      `.context/testbox-prompt-shutdown/blacksmith-report.md`. Include the
      SSH wait, its cost, the run links and two requests: close the shared
      connection in `blacksmith testbox stop`, or skip the wait for a stopped
      box. Give the draft to the user.
- [x] Move `## Cleanup And Interrupts` from `remote-verification.md` to the
      new `docs/protocol/remote-verification-cleanup.md`, so both pages stay
      at or below 250 lines. Add the page to the protocol index. Update the
      link in `remote-verification-testbox.md` and every other link to the
      moved section.
- [x] Define the close step, the cleanup order, the no-connection case, the
      close warning and the error-text rule in the cleanup page. Keep the
      attempt limit, the waits, the failure count and the guard rules.
- [x] Update step 5 of the remote run sequence and the output rules in
      `remote-verification.md`.
- [x] Add findings 2, 3 and 6 to the workflow section of
      `remote-verification-testbox.md`.
- [x] Confirm that the close step reads no credential and sends no key.
      Update `ci-verification-security.md` only if the chosen method changes
      the key boundary.
- [x] Run the Markdown link test, the protocol size test and the format
      check. Commit and push.

## Milestone 2: Close the connection during cleanup

Completed. Xtask closes each box's shared SSH connection once before status,
stop and cancellation. The current stop-before-cancel order remains.

Evidence: `.context/testbox-prompt-shutdown/milestone-2.md`.

- [x] Add a close method to the `Blacksmith` trait, for example
      `disconnect(id)`. Implement it in `SystemBlacksmith` with the method
      from Milestone 1. Run `ssh` through the `Process` boundary, so the
      secret variable list and redaction still apply. Add a typed operation
      for SSH diagnostics.
- [x] Call the close method once per box in `CleanupGuard`, before status,
      stop and cancellation, inside the existing unwind protection. Store the
      close state with the box, so retries and final cleanup do not repeat
      it.
- [x] Add unit tests with unimock. Use event order and captured inputs, not
      elapsed time. Cover: close before status, stop and cancellation; one
      close per box across suite, final and panic cleanup; one information
      line for an absent connection and no output for a closed connection;
      one warning for a failed close, then normal cleanup; and
      the interrupt and preparation-failure paths.
- [x] Add adapter tests in the existing adapter test style. Cover the exact
      `ssh` arguments, the removed secret variables and no process for a
      missing socket.
- [x] Update the existing cleanup tests for the new call.
- [x] Make the SSH adapter fixture accept a child that finishes before a poll
      wait. Keep all assertions and record repeat results under `.context/`.
- [x] Update the cleanup text in the xtask README.
- [x] Run the xtask tests, `cargo fmt --all -- --check`, Clippy and the
      length lints, local repository gate and Markdown checks. Commit and push.

## Milestone 3: Cancel order and error text

Completed. Cleanup closes each connection and attempts one cancellation
before stop. Cleanup warnings keep one bounded command detail.

Evidence: `.context/testbox-prompt-shutdown/milestone-3.md`; repeat results: `.context/testbox-prompt-shutdown/milestone-3-repeats.md`.

- [x] Apply the cleanup order from the Milestone 1 contract.
- [x] Keep the error line of a failed status, stop, cancel, run state or close
      command in the typed error. Show it in the warning, at most 200
      characters, after redaction.
- [x] Add unit tests for the call order, the warning text, a long line, an
      empty error stream and redaction of the key.
- [x] Split cleanup and client modules by responsibility before they exceed
      300 lines. Keep module roots thin and update imports and live links.
- [x] Repeat each test that uses real processes or threads ten times. Save
      the results under `.context/testbox-prompt-shutdown/`.
- [x] Update the xtask README.
- [x] Run the xtask tests, `cargo fmt --all -- --check`, Clippy and the
      length lints, local repository gate and Markdown checks. Commit and push.

## Milestone 4: Verification, close-out and review

Verification and close-out are complete. The user runs the final review after
the push. The review TODO remains open.

Evidence: `.context/testbox-prompt-shutdown/smoke.md` and `.context/testbox-prompt-shutdown/gate.log`.

- [x] Run all tests for this change with a 100% pass rate. Run
      `cargo fmt --all -- --check`, Clippy and the length lints.
- [x] Push the branch. Run the complete `cargo xtask check` on Testboxes.
      Require 11/11 commands, 9/9 reports, a passed aggregate and
      `cleanup=0`.
- [x] For each job of that check, record the time from its last command to
      the job end and its "Complete runner" log. Require no
      `Active SSH sessions detected` line. Compare the billed box-minutes
      with the 141-minute baseline. Save the result in
      `.context/testbox-prompt-shutdown/smoke.md`.
- [x] Inspect the diff and the deletions against `origin/main`.
- [x] After the checks pass, run `git add -A`, commit with Conventional
      Commits and push the branch.
- [ ] After the push, a reviewer uses
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main` and reports the
      findings. Keep the review read-only. The implementer then applies the
      review-fix rule in `AGENTS.md`: fix the `Auto-fix: yes` findings, run
      the checks, commit and push, re-review once, fix any new
      `Auto-fix: yes` findings once more, then stop and report the rest. Add
      each open finding as one line under this TODO.

## Post-merge follow-up (non-blocking)

- [ ] One week after the merge, compare the Testbox spend per check in
      `blacksmith usage --breakdown-by workflow` with the 2026-10-06 and
      2026-10-07 baseline. Save the result under
      `.context/testbox-prompt-shutdown/`.
- [ ] When Blacksmith answers the report, decide whether a later plan can
      remove the workaround.
