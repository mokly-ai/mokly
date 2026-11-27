# Frame hook harness settles deferred work before it exists

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the review of branch `calummoore/preview-loading-issue-lcbo` (finding 2, wider fix).
- **Location:** `packages/viewer/tests/frame_hook_harness.tsx:120` and `tests/browser/frame_hook_lifecycle.spec.ts`.
- **Category:** Test.

- **Background:** The browser frame hook harness gives specs `rejectMount`, `resolveMount`, `rejectUpdate`, and `resolveUpdate`. Each settles the oldest deferred adapter operation of one test frame. React creates that operation after its render, so a spec must first wait for `pendingMounts` or `pendingUpdates`.
- **Problem:** Each helper drops its call silently when no operation is pending. A spec that forgets the wait then times out on a later poll instead of failing at the step that lost the call. The branch fixed its own spec with the existing wait.
- **Impact if no action:** A new lifecycle spec can be flaky or slow to fail in the same way.
- **Root question:** How can every harness step settle exactly the operation that the hook started?
- **Options:**
  - **A.** Make each helper throw when its queue is empty. Fix the specs that this exposes. Effort: Small.
  - **B.** Give the harness a readiness signal for deferred operations, and make each helper wait for it before it settles the operation. Effort: Medium.
- **Left out:** A fixed delay or a longer timeout. The deterministic test rules forbid both.
- **Wider fix:** B.
- **Previous examples:** `2e48d7dbe` replaced timing-dependent frame checks with explicit waits.
- **Recommendation:** B. It removes the race for every spec, not only for the ones that remember the wait.
- **Action:** fix after merge, apply B, because it changes the controls that every lifecycle spec uses.
