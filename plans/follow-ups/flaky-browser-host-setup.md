# Browser host setup failed once and passed on rerun

- **Severity:** Low. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, during the second review fix round of the shell views plan.
- **Location:** `tests/browser/setup.ts:106`, the global setup of the browser suite, which throws `AggregateError(errors, "Browser host setup failed")` when more than one host fails to start.
- **Reason:** The failure did not repeat, and nobody kept its inner errors, so its cause is unknown.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Browser hosts:** the servers that the browser suite's global setup
    starts before any spec runs: the Serve hosts, a static copy of the
    example catalogue, and a comparison host. `tests/browser/setup.ts`
    starts them side by side.
- **Background:**
  - On 2026-10-30, a run of the design browser specs in the checkout of
    `calummoore/mokly-ui-controls` stopped in the global setup with
    "Browser host setup failed", 4.8 seconds into the static catalogue build.
  - The same build passed when run by hand, and the setup passed in every
    later run of that session, about ten runs.
  - Another agent ran builds and a computed-style capture in a second
    checkout on the same machine at the same time. A shared port or a shared
    cache is a possible cause, but nobody checked it.
  - The setup throws an `AggregateError` only when two or more hosts fail.
    The run's log kept only the outer message, not the inner errors.
- **Problem:** The suite can fail before any test runs, and the outer
  message does not say which host failed or why.
- **Impact if no action:** A rare run fails without a cause, and the next
  person repeats the run without learning more.
- **Root question:** Why can two browser hosts fail to start together, and
  how does a failure show its cause?
- **Options:**
  - **A.** Print each inner error of the `AggregateError` with its host name
    before the setup throws, and wait for the next failure. Effort: Small.
  - **B.** A, and run the setup in a loop while another checkout builds, to
    reproduce the failure and find the shared resource. Effort: Medium.
- **Left out:** A retry of the setup, because the `testing` skill
  rules out retries that hide a cause.
- **Wider fix:** None found.
- **Previous examples:** None found under `plans/follow-ups/`.
- **Recommendation:** A. The next failure then names its host and its error.
- **Action:** fix after merge, apply A, because the failure did not repeat and
  its cause is outside this branch.
