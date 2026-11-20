# Flaky trusted interpreter probe

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, during the environment-token probe investigation at `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd`.
- **Location:** `crates/mokly-compare/tests/program_tests.rs:68`, with the parent test at line 99 and its status assertion at line 116.
- **Reason:** This is a separate unchanged test from the environment-token test that the branch fixes.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Parent test:** `npm_interpreters_also_ignore_relative_path_entries`, which checks that an npm shebang selects trusted Node from an absolute PATH entry.
  - **Child test:** `interpreter_probe`, selected in a second run of the same test binary.
- **Background:**
  - Mokly excludes relative PATH entries when it selects a package manager and its interpreter.
  - The parent writes temporary `npm` and `node` shell fixtures.
  - It starts the child with `PATH` set to a relative entry followed by the absolute fixture directory.
  - The child writes another `node` in its working directory and uses the real `SystemSpawner`.
  - It checks that stdout is `trusted-node` and that the supplied tools path is absolute.
  - The parent checks child success, but its failure text prints only child stdout.
  - The whole test binary failed once at run 101 of 1,000 untraced attempts under concurrent workspace test execution.
  - The source was unchanged at `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd`.
  - The machine ran Linux 6.8.0-117-generic with four CPUs and Rust 1.95.0.
  - Both development and test profiles had debug information disabled.
  - The failed parent printed this text:

    ```text
    thread 'npm_interpreters_also_ignore_relative_path_entries' (269192) panicked at crates/mokly-compare/tests/program_tests.rs:113:5:

    running 1 test
    test interpreter_probe ... FAILED

    failures:

    failures:
        interpreter_probe

    test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 6 filtered out; finished in 0.00s
    ```

  - The whole binary exited 101 with six tests passed and one failed.
  - The environment-token probe and cancellation test both passed in that run.
  - That 1,000-run batch had 997 whole-binary passes, this interpreter failure, one token-probe failure, and one cancellation hang.
  - An unchanged isolated rerun of this interpreter parent passed once with exit 0.
  - It reported one test passed, zero failed, zero ignored, and six filtered out.
  - The rerun used the archived original binary, so a later source edit did not change its code.
  - No process trace exists for the interpreter failure, and the parent did not print the child's stderr.
  - The source and OS error are unknown.
  - Another test in this binary had a confirmed `ETXTBSY` failure from an inherited writable fixture descriptor.
  - That is a possible source here, but the interpreter failure has no trace that confirms it.
  - A matched after-change workspace-feature batch had a second interpreter failure at run 276 of 1,000 untraced attempts.
  - That batch had 998 whole-binary passes, this interpreter failure, and one cancellation hang.
  - The token probe and cancellation test passed in the interpreter failure run.
  - The interpreter code stayed unchanged when the token fixture setup moved into its isolated child.
  - The second parent failure printed the same child-failure text, with this parent panic line:

    ```text
    thread 'npm_interpreters_also_ignore_relative_path_entries' (397482) panicked at crates/mokly-compare/tests/program_tests.rs:113:5:
    ```

  - It again reported six whole-binary passes and one failure, with exit 101.
  - One isolated rerun of that unchanged after binary passed with exit 0, one passed test, and six filtered out.
  - Thus two untraced interpreter failures each have a passing unchanged isolated rerun.
  - Neither failed interpreter run has a process trace or its child panic text. The source remains unknown.
- **Problem:** The trusted interpreter child failed twice under parallel process activity. Each unchanged binary passed its isolated rerun. Its failure output does not show the child's panic or an OS error.
- **Impact if no action:** The required Rust suite can fail on unchanged code, and the failure does not identify its cause.
- **Root question:** How does the interpreter probe select and run trusted Node reliably on every test run?
- **Options:**
  - **A.** Repeat the whole binary with default parallel threads and compare isolated parent runs. Trace failing runs at process boundaries and record the failing syscall and errno. Make no repository change until the trace names the cause. Effort: Small.
  - **B.** Include both captured stdout and stderr in the parent's failure message. This improves the next failure's evidence, but does not fix its unknown source. Effort: Small.
  - **C.** Change nothing and record each recurrence. The gate stays flaky. Effort: Small.
  - **D.** After a trace names the source, make that source deterministic while keeping every assertion. The exact change and cost depend on the trace. Effort: Medium.
- **Left out:**
  - A retry, sleep, repeat in the test, skip, quarantine, or longer time limit hides the defect.
  - One test thread for the binary changes runner configuration without identifying the source.
  - Applying the environment-token fixture fix to this test now guesses that the two failures have the same cause.
- **Wider fix:** None yet. The source is unknown. B gives better detection output for later failures.
- **Previous examples:** The environment-token probe in this file failed with `CommandUnavailable`. A trace named `ETXTBSY` from a sibling process that inherited its writable fixture.
- **Related:** [flaky-program-cancellation-fixture.md](./flaky-program-cancellation-fixture.md) records a confirmed writer-inheritance race in the same file. This interpreter failure has no trace that proves the same cause.
- **Recommendation:** A. Trace the failure before selecting a fix, as the testing rules require.
- **Action:** fix after merge, apply A, because this separate unchanged test needs its own investigation. If A cannot reproduce the failure or name its source, ask the user before changing code.

Assumptions: Keep both child assertions, the parent status assertion, and real process execution. The current test and testing rules supply these requirements.
