# Two Serve fixtures copy one readiness wait

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, the wider fix of its review finding about the readiness failure report.
- **Location:** `tests/browser/serve_comparison_fixture.ts`, the `ready` wait, `tests/browser/serve_ready_log.ts`, its report, and `tests/browser/serve_changes_fixture.ts:129-149`, the second copy of the wait.
- **Reason:** The direct fix changed only the comparison fixture of the diff. The Changes fixture and its four specs were outside it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Readiness wait:** the `expect.poll` loop that reads the catalogue index of a Serve host until it reports a newer revision with `changesStatus` `ready`.
- **Background:**
  - Since 2026-11-26, the wait of the comparison fixture records each step through `readyLog` in `tests/browser/serve_ready_log.ts`. Its error first names a failed step with its error and the error's cause, or a time limit with the step that was in progress.
  - `tests/browser/serve_changes_fixture.ts:144` still throws "did not become ready" with the whole Serve output first. The cause that names the limit or the error comes last.
  - `expect.poll` rethrows a failed read at once, and it stops 250 ms before the test deadline, with the same outer error as its own timeout.
- **Problem:** The two Serve fixtures keep two copies of the readiness wait, and only one gives the cause first.
- **Impact if no action:** A Changes fixture failure still sends the reader to the timeout or to the Serve output before the real cause.
- **Root question:** How do both Serve fixtures share one readiness wait whose failure names what ended it?
- **Options:**
  - **A.** Use `readyLog` in `serve_changes_fixture.ts` too, and keep two loops. Effort: Small.
  - **B.** Move the readiness wait into one module that both fixtures call. Each fixture keeps its own index reader. Run the four Changes specs and the comparison specs 10 times each. Effort: Medium.
- **Left out:** A custom reporter that prints the cause first changes the output of every test. A retry past a failed read hides the defect.
- **Wider fix:** B. One wait gives every new Serve fixture the same report.
- **Previous examples:** Commit `ae79b95cd` kept the inner cause of a browser host cleanup error.
- **Recommendation:** B. It removes the second copy.
- **Action:** fix after merge, apply B, because it changes a fixture and four specs outside the diff that found it.
