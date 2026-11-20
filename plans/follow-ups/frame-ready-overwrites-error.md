# A frame's ready status can hide an earlier error

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from branch `calummoore/preview-cannot-be-loaded-fov6`, the round 2 review.
- **Location:** `packages/viewer/src/shell/frame_mount_hook.ts` (the `finishMountedUsage` callback that sets `ready`) and `packages/viewer/src/shell/frame_session_usage.ts` (`finishMountedUsage`).
- **Reason:** The defect exists on `origin/main`, and the branch that found it did not change this path.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Frame hook:** `useMountedShellFrame` in `packages/viewer/src/shell/frame_mount_hook.ts`. It mounts a preview frame and holds its status: `loading`, `ready`, or `error`.
- **Background:**
  - After the adapter's mount resolves, the hook subscribes to the frame's events. Then it waits in `finishMountedUsage` until every usage revision adopted during the mount reaches the frame. Then it sets the status to `ready`.
  - An `error` event that marks the preview failed sets the status to `error` at once.
  - When a usage update is pending, `finishMountedUsage` awaits it. A failure event can arrive during that wait.
- **Problem:** The callback that sets `ready` does not check whether the session already failed, so a failure that arrives during the wait is overwritten by `ready`.
- **Impact if no action:** A preview that failed during a usage update can show as ready, with no failed line and no Try again.
- **Root question:** How does a failure during mount completion stay visible?
- **Options:**
  - **A.** In the `ready` callback, keep `error` when the session already failed. Add a hook harness test with a deferred usage update and a failure event during it. Effort: Small.
  - **B.** Keep one status reducer per session that never moves from `error` to `ready` without a new mount. Effort: Medium.
- **Left out:** Fewer than three approaches exist, because the choice is where the guard lives.
- **Wider fix:** B. One reducer removes every status race of the session.
- **Previous examples:** None found.
- **Recommendation:** A. It fixes the race in one place with a direct test.
- **Action:** fix after merge, apply A, because the defect exists on `origin/main` and is outside the change that found it.
