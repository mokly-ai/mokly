# No test of the standalone catalogue retry's main focus

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from branch `calummoore/preview-cannot-be-loaded-v2-oe8e`, review finding 15.
- **Location:** `packages/viewer/src/standalone/shell.tsx` (the `RetryContent` around `ReadyShell`), `tests/browser/shell_mount_states.spec.ts` (the catalogue retry test).
- **Reason:** The review that found it ran after the two fix rounds of the branch, so the fix rule gives it a follow-up item.

- **Source:** Review.
- **Category:** Test.
- **Background:**
  - After Try again on "The catalogue could not be loaded", focus moves to "Loading catalogue…" and then to the main region of the shell, under the recovery focus rule of `docs/protocol/mokly-viewer.md`.
  - The standalone shell, which Serve and the static build use, gets the second step from the `RetryContent` wrapper in `packages/viewer/src/standalone/shell.tsx`.
  - `tests/browser/shell_mount_states.spec.ts` checks the first step only. `tests/browser/viewer_async.spec.ts` checks the second step for the embedded viewer only.
- **Problem:** A change that deletes the standalone `RetryContent` wrapper passes every test.
- **Impact if no action:** A regression of the standalone catalogue recovery reaches Serve readers unseen.
- **Root question:** Which test proves that the standalone catalogue recovery ends on the main region?
- **Options:**
  - **A.** In `tests/browser/shell_mount_states.spec.ts`, after the heading shows, assert that `#mb-main` is focused. Effort: Small.
- **Left out:** A Node unit test. The viewer's Node tests render static markup and have no DOM focus. Only a browser test can see focus, so fewer than three approaches are real.
- **Wider fix:** None. The regression test is the fix.
- **Previous examples:** The embedded check in `tests/browser/viewer_async.spec.ts`.
- **Recommendation:** A.
- **Action:** fix after merge.
