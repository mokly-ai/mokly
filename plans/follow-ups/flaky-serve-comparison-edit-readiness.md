# Serve comparison edit readiness timed out once in 20 runs

- **Severity:** Low. **Effort:** Medium. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the branch `calummoore/removed-entries-all-section-n5a3`, during the repeat runs of a changed browser spec.
- **Location:** `tests/browser/serve_comparison_fixture.ts:124-149`, the `ready` wait that `edit` uses, called from `tests/browser/serve_removed_evidence.spec.ts:146`.
- **Reason:** The failing wait is shared fixture code that the branch does not touch, and the source of the delay is unknown.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Serve comparison fixture:** the Playwright fixture that starts a
    watching Serve host over a Git fixture repository. Its `edit` writes one
    source file and waits for the next ready Changes publication.
- **Background:**
  - `npx playwright test tests/browser/serve_removed_evidence.spec.ts --repeat-each=10`
    gave 19 passes and 1 failure on 2026-11-20.
  - The failing test was "background baselines reconcile removed rows and
    invalidate changed historical views". It failed at `changes.edit(...)`
    with "Serve comparison did not become ready", after the 30-second poll
    of the index for a newer revision with `changesStatus` `ready`.
  - The branch changed assertions in this spec but not the `edit` call or
    the fixture.
  - The cloud computer was under load. Its disk was close to full, and
    Rust and Node builds had run on it during the same session.
- **Problem:** A watched source edit can take more than 30 seconds to reach
  a ready Changes publication, so the spec fails without a product fault.
- **Impact if no action:** A rare browser run fails, and the next person
  reruns it without learning the cause.
- **Root question:** What delays the ready publication after one watched
  source edit, and how does the wait report that cause?
- **Options:**
  - **A.** Print the last index revision and `changesStatus` that the poll
    saw in the error, beside the host diagnostics, and wait for the next
    failure. Effort: Small.
  - **B.** A, and repeat the spec under build load to reproduce the delay and
    find the slow phase from the `mokly:timing` events. Effort: Medium.
- **Left out:** A longer time limit or a retry, because the `testing` skill
  rules out both.
- **Wider fix:** None found.
- **Previous examples:** `plans/follow-ups/flaky-browser-host-setup.md`.
- **Recommendation:** B. A alone may never see a second failure.
- **Action:** fix after merge, apply B, because the wait is shared fixture
  code outside this branch and its cause is unknown.
