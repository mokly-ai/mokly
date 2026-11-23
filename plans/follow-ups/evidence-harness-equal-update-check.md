# Evidence harness accepts updates that change nothing

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch `calummoore/mokly-viewer-refresh-identity-q13s`, the blocked wider fix of review item 40.
- **Location:** `packages/viewer/tests/evidence_harness.tsx` (`update` and `evidenceUsage`), `tests/browser/viewer_evidence.spec.ts`, `tests/browser/viewer_evidence_cancellation.spec.ts`, `packages/viewer/src/shell/frame_mount_hook.ts` (the value check).
- **Reason:** The fix is a check for a whole class of test input, and the repository rules reserve such a check for the user.

- **Terms:**
  - **Evidence harness:** the test page in `packages/viewer/tests/evidence_harness.tsx`. The evidence browser specs bundle it with esbuild and drive it through `window.evidence`.
  - **Usage:** the component evidence of one view that a mounted preview frame uses for inspection and highlights.
  - **Value check:** the rule in `useMountedShellFrame` that sends a usage update to the frame only when the new usage differs by value. It compares with `sameJsonValue`.
- **Background:**
  - Since 2026-11-22, the frame hook ignores a usage update of equal value. So an equal update restarts no frame probe and clears no highlight. The user approved this behaviour inside the refresh identity change of that day.
  - The evidence browser specs test the changed-usage rules of `docs/protocol/mokly-frame-adapter.md`. Examples are the restoration of an active pick after an evidence update, and the cancellation of a pending activation with `disposed`.
  - Each scenario calls `window.evidence.update(viewport, status)`. Then it waits up to 10 seconds for the update counter or the `disposed` outcome.
  - Before 2026-11-22, the harness's ready update was a copy of the original usage. One spec also sent a pending status to a frame that was already pending. With the value check, 14 of the 28 evidence browser tests timed out.
  - The fix of 2026-11-22 makes each ready update a new revision of the view's usage. It adds a `revision` prop and changes the `propsKey` of the `action` instance. The spec now sends `unavailable` to the pending sibling.
- **Problem:** A status update with `pending`, `unavailable`, or `empty` has no field that can change. A later scenario can again send an update that equals the frame's current usage. That test then times out with an update count of 0, and the failure does not name the cause.
- **Impact if no action:** A later evidence scenario that repeats a status fails after a 10-second wait with an unclear error. Its author must find the value check by reading the code.
- **Root question:** How does the evidence harness make an update that changes nothing fail fast, with a clear cause?
- **Options:**
  - **A.** Change nothing. The doc comment of `evidenceUsage` says that a status update must differ from the frame's current status. Effort: Small.
  - **B.** The harness's `update` throws a named error when the new usage equals the viewport's current usage. It compares with its own code, not with `sameJsonValue`, which is the code under test. It fails at the call, not after a 10-second poll. Effort: Small.
- **Left out:** A structural fix, because a status-only usage has no field that can change without a change to the frame's ranges. A change of the value check, because the user approved it.
- **Wider fix:** B. It is a detection fix for the class.
- **Previous examples:** None found.
- **Recommendation:** B. It turns a slow, unclear timeout into an immediate named error at Small cost.
- **Action:** ask the user, because B adds a check that catches every case of the class, and the rules reserve such a check for the user.
