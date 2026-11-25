# Evidence cancellation spec races a late navigation

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch `calummoore/dropdown-menu-missing-ja6h`, an unrelated flaky test in CI run 45610863381.
- **Location:** `tests/browser/viewer_evidence_cancellation.spec.ts:13-18`, `evidenceFixture` in `tests/browser/viewer_evidence_fixture.ts`.
- **Reason:** The branch that saw the failure changes only the cloud app's account control, and an unrelated flaky test gets its fix in a separate branch.

- **Terms:**
  - **Evidence cancellation spec:** the browser spec that checks that an evidence update with the status `empty`, `pending`, or `unavailable` ends an active pick once and lets a new pick start. It runs each status with the same-origin adapter and with the postMessage adapter.
  - **`start`:** the page setup that `evidenceFixture()` returns. It opens the evidence harness page for one adapter.
- **Background:**
  - The spec calls `await start(page, cross)` and then, at line 14, `page.evaluate(...)`, which starts a pick and sends the evidence update.
  - On 2026-11-25, CI shard 4 of 4 of the Mokly browser suite (Node 22.15.0) failed the case "postMessage unavailable evidence ends invalid pick once and allows restart" with this text: `Error: page.evaluate: Execution context was destroyed, most likely because of a navigation.` at `tests/browser/viewer_evidence_cancellation.spec.ts:14:18`.
  - A rerun of the failed job on the same commit passed. The other five cases of the spec passed in both runs.
- **Problem:** The first `page.evaluate` after `start` sometimes runs while the page still navigates. The suspected source is that `start` resolves before a late navigation of the harness page ends, for example a reload or a second `goto` in the postMessage setup. The cause is not confirmed.
- **Impact if no action:** The browser suite fails now and then on branches that do not touch the viewer, and each failure costs a rerun.
- **Root question:** How does the spec start its first step only after the harness page has finished every navigation?
- **Options:**
  - **A.** Repeat the postMessage cases (for example 50 runs) to reproduce the failure. Find the navigation that comes after `start` resolves. Make `start` wait for an explicit readiness signal of the harness page, set after its last navigation. Effort: Medium.
  - **B.** Make `start` wait for the harness page's `load` event of its final URL. Effort: Small. It assumes the navigation that the failure names is a full load.
  - **C.** A shared fixture rule: each browser fixture ends with an explicit readiness signal that the page sets once it is ready. Effort: Large.
- **Left out:** A retry, a sleep, or a longer timeout, because they hide the cause.
- **Recommendation:** A. It finds the real cause and gives a deterministic readiness signal. C protects the codebase best, but it needs the user.
- **Action:** fix after merge, apply A.
