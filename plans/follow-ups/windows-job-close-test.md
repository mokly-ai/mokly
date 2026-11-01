# Make the Windows job-close test effective

- **Severity:** Medium. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 176, delta review 1.
- **Location:** `crates/mokly-platform/tests/process_tests.rs:86` and
  `crates/mokly-platform/tests/process_tests.rs:104`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Job object:** the Windows kernel object that groups a process tree, so
    that closing the job stops every process in it.
- **Background:** `job_close_kills_the_child_and_closes_its_pipes` runs
  `cmd.exe /d /s /c "echo ready&set /p hold="` in a job. It waits for
  `ready`, closes the job, and then calls `child.wait()`. It asserts that no
  more output arrives.
- **Problem:** `Child::wait` closes the child's standard input before it
  waits. `set /p` then reads end of input, so cmd exits by itself. The test
  passes even when closing the job does not stop the child.
- **Impact if no action:** The test can pass while Windows process cleanup
  is broken.
- **Root question:** How should the test prove that closing the job stops
  the child?
- **Options:**
  - **A.** Append `&echo leaked` to the command, and assert that `leaked`
    never prints. Effort: Small (estimate).
  - **B.** Create one shared test helper that proves job termination, and
    use it in every job-close test. Effort: Medium (estimate).
- **Left out:** An elapsed-time assertion makes the test depend on machine
  speed.
- **Wider fix:** B. One proof based on events prevents false passes in
  every job-close test.
- **Previous examples:** None found.
- **Recommendation:** A. It makes the current test fail when the child
  survives. B best protects all job-close cases.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6348).
