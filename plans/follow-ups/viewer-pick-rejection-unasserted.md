# Failed-mount pick test ignores the rejection

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, a review finding that its check placed outside the scope.
- **Location:** `tests/browser/viewer_async.spec.ts`, the test "frame failures end picking once and reject one handle with one safe error", its second page function, which wraps `startPick` in a `try` with an empty `catch`.
- **Reason:** The empty `catch` came with the test in commit `d7b0ac356`, pull request #76, and the branch that found it changed only how the test waits.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **`startPick`:** the public viewer method that starts instance selection and returns a promise for its activation.
- **Background:**
  - `docs/protocol/mokly-viewer-selection.md:137` says that a failed asynchronous viewer operation rejects the promise of the public method and emits one safe error.
  - The test makes the frame adapter's `mount` throw, calls `startPick`, and drops the outcome in an empty `catch`. It then asserts only the error event: `{ code: "frame", message: "This instance is unavailable in the current view." }`.
  - `packages/viewer/src/viewer/picking.ts:41` rejects with the failure that `viewerFailures` in `packages/viewer/src/host/failures.ts:41` reports. `packages/viewer/tests/picking.test.ts:23` and `packages/viewer/tests/frame_inspection_controller.test.ts:174` check the internal controllers only.
- **Problem:** No test checks that the public `startPick` rejects when the mount fails, although the test title says so.
- **Impact if no action:** A change that fulfils the public promise on a failed mount passes every test, and an embedding app then reads a failed pick as a success.
- **Root question:** How does the test check both failure signals that the embedding app receives?
- **Options:**
  - **A.** Return the settled outcome of `startPick` from the page function, and assert that it rejected. Keep the event assertion. Effort: Small.
  - **B.** Do A, and also return the rejection message, and assert it with the literal "This instance is unavailable in the current view.". Then make the public `startPick` fulfil on this failure once, see the test fail, and restore the code. Effort: Small.
  - **C.** Add a mounted-viewer Node test of the public handle rejection. It must fake layout, because the selection needs real layout. Effort: Medium.
- **Left out:** Assert only that no pick started, because a fulfilled promise also starts none. Rename the test, because the requirement stays.
- **Wider fix:** None. The class has one instance: the other `catch` blocks around public viewer calls under `tests/browser/` return a value that the test asserts.
- **Previous examples:** Commit `d7b0ac356` added this test and the controller test at `packages/viewer/tests/picking.test.ts:23`.
- **Recommendation:** B. It checks the exact rejection that the embedding app receives, in one page call.
- **Action:** fix after merge, apply B, because the problem came before the branch that found it.
