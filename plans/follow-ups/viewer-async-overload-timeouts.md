# Viewer async tests time out on an overloaded machine

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, during its repeat runs of `tests/browser/viewer_async.spec.ts`.
- **Location:** `tests/browser/viewer_async.spec.ts:88`, "a failed URL index source can retry", and `tests/browser/viewer_async.spec.ts:146`, "another deployment keeps the stage loading until the host replaces the index".
- **Reason:** The branch changed only the waits of the other tests of the spec, and these failures came only at a load that also stopped other suites.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - On 2026-11-26, 40 repeats of the spec with 2 workers in Chromium 149 ran at a load average of 19 to 26 on a 4-CPU machine, with full swap.
  - "a failed URL index source can retry" failed twice with "Test timeout of 60000ms exceeded". "another deployment keeps the stage loading until the host replaces the index" failed twice with "Timeout 10000ms exceeded while waiting on the predicate".
  - A second batch of 40 repeats at a lower load passed 160 of 160. No CI run failed these tests in the scan of 2026-11-25 to 2026-11-26.
- **Problem:** Under heavy overload, two tests of the spec run past a hang guard.
- **Impact if no action:** Local runs on an overloaded agent machine fail now and then without a fault.
- **Root question:** Do these tests wait on a state that depends on machine speed, or only on a machine that cannot run the suite?
- **Options:**
  - **A.** Read the traces of a reproduction, and replace any wait that depends on speed with an explicit readiness signal. Effort: Medium.
  - **B.** Drop the item, because the failures came only with full swap. Effort: Small.
- **Left out:** A longer time limit or a retry, because the testing rules rule them out.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. No failure came at normal load or in CI.
- **Action:** ask the user, because the source is not named and the recommended option drops the record.
