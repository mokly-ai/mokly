# Flaky environment probe in the program tests

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the complete gate of the branch
  `calummoore/mokly-parallel-view-comparison-n4kr` at commit `953b82cc3`.
- **Location:** `crates/mokly-compare/tests/program_tests.rs:122` to line 175,
  `crates/mokly-compare/src/programs.rs:22` to line 59, and
  `crates/mokly-compare/src/process.rs:56` to line 58.
- **Reason:** The test and its product path are unchanged from `origin/main`,
  so one fix in a separate branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Parent test:** `environment_probe_runs_with_a_token_and_absolute_manager_path`,
    which starts a second run of the same test binary and checks its exit
    status.
  - **Child test:** `install_environment_removes_mokly_token`, which runs only
    when `MOKLY_ENV_PROBE` is set, inside that second run.
  - **`CommandUnavailable`:** the `mokly-compare` error for a package manager
    or command that cannot start.
- **Background:**
  - The parent test, at `program_tests.rs:149` to line 175, writes a shell
    script named `npm` into a new temporary directory. The script is
    `#!/bin/sh` and `printf '%s' "${MOKLY_TOKEN-unset}"`. The test sets its
    mode to `0o755`.
  - The parent test then runs the current test binary with
    `--exact install_environment_removes_mokly_token --nocapture`. It sets
    `MOKLY_ENV_PROBE=1`, `MOKLY_TOKEN=secret`, `PATH` to the temporary
    directory, and `MOKLY_ENV_PROBE_PATH` to the script.
  - Line 170 asserts that the child run exited with success. It prints the
    child's stderr.
  - The child test, at `program_tests.rs:122` to line 145, builds a
    `SystemSpawner` and spawns `npm --version` in the temporary directory.
    Line 143 unwraps the spawn result. Line 144 asserts that stdout is
    `unset`, which proves that `MOKLY_TOKEN` did not reach the manager.
  - The seven tests of `program_tests.rs` run in parallel threads of one
    process by default. Several of them start child processes.
  - Two code paths return `CommandUnavailable` for this spawn:
    - `programs.rs:37` to line 59 looks for an `npm` file with an execute bit
      in each absolute `PATH` entry. It returns `CommandUnavailable` at line
      59 when it finds none. The parent test wrote the script and set its
      mode before it started the child run. So this path is less likely, but
      nobody ruled it out.
    - `process.rs:56` to line 58 maps every OS error of `command.spawn()` to
      `CommandUnavailable`. The error keeps no OS error kind and no errno.
  - So the exact OS error of the failure is not known.
  - The failure:
    - On 2026-11-17 at 04:15 UTC, the complete gate `cargo xtask check` at
      commit `953b82cc3` ran on Linux with 4 CPUs. It failed in
      `cargo test --workspace` with status 101.
    - The failure text is:

      ```text
      thread 'environment_probe_runs_with_a_token_and_absolute_manager_path' (1987070) panicked at crates/mokly-compare/tests/program_tests.rs:170:5:

      thread 'install_environment_removes_mokly_token' (1987079) panicked at crates/mokly-compare/tests/program_tests.rs:143:10:
      called `Result::unwrap()` on an `Err` value: CommandUnavailable
      ```

    - The binary reported
      `test result: FAILED. 6 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s`.
  - The rerun:
    - About one minute later, at the same commit, this command passed with
      exit 0:
      `cargo test -p mokly-compare --test program_tests environment_probe_runs_with_a_token_and_absolute_manager_path -- --exact --nocapture`.
    - It reported `1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out`.
    - The rerun ran the test alone, so the other tests of the binary did not
      run beside it.
  - `program_tests.rs`, `programs.rs`, and `process.rs` are unchanged from
    `origin/main` at `0b82cf6c0`.
  - Suspected source: unknown. One candidate is a start failure of the
    short-lived shebang script that the parent test had just written, while
    other tests of the same binary started processes. Nobody reproduced or
    traced the failure, so this candidate is not a confirmed cause.
- **Problem:** The parent test failed once in the complete gate, because the
  child test's spawn of the fixture `npm` returned `CommandUnavailable`. The
  error keeps no OS error, so the source is unknown.
- **Impact if no action:** The complete gate can fail at random on an
  unchanged test. Each failure costs a gate rerun.
- **Root question:** How does the environment probe start its fixture `npm` on
  every run?
- **Options:**
  - **A.** Reproduce and trace, with no repository change.
    - Run the whole `program_tests` binary many times in a loop, with its
      default parallel threads, and count the failures.
    - Also run the parent test alone in a loop, for comparison.
    - Trace the failing runs at the process boundary, for example with
      `strace -f -e trace=execve` on Linux. Record the failing call and its
      errno.
    - Cost: machine time, and an unknown number of runs. Effort: Medium.
  - **B.** Keep the OS error of a failed start. Give the failure of
    `process.rs:58` an error that carries the `io::ErrorKind` and the raw
    errno. Keep the resolution failure of `programs.rs:59` distinct. A later
    failure then prints its cause. Cost: it changes the error type and an
    install failure message that users see, so the protocol and guide text
    of that message needs a check. Effort: Medium.
  - **C.** After A or B names the cause, make the test deterministic for that
    cause. Examples are isolating the probe from the parallel process starts
    of the other tests, or creating the fixture script in another way. Keep
    every assertion. Cost: unknown until the cause is known. Effort: Medium.
  - **D.** Change nothing, and add each recurrence with its failure text to
    this item. Cost: the gate stays flaky. Effort: Small.
- **Left out:**
  - A retry, a sleep, a repeat, a skip, a quarantine, or a longer time limit.
    The testing rules forbid each of them for a flaky test, because they hide
    the defect.
  - One test thread for the binary. It changes the runner configuration only
    to make the test pass, and it names no cause.
  - A fix for one guessed cause before a trace. It can miss the real cause,
    and the testing rules ask for a named source before a fix.
- **Wider fix:** None yet, because the defect class is unknown until A or B
  names the cause. B is a detection aid that would name the cause of every
  later start failure.
- **Previous examples:** None found. No follow-up item and no commit message
  names this test or `CommandUnavailable` as flaky.
- **Recommendation:** A. It names the source before any fix, as the testing
  rules require, and it changes nothing in the repository. B is the next step
  when A cannot reproduce the failure.
- **Action:** fix after merge, apply A, because the test and its product path
  are unchanged from `origin/main`, and the source must be named before a
  fix. If A cannot reproduce the failure or name its source, the testing rules
  give the fix the outcome `ask the user`.
