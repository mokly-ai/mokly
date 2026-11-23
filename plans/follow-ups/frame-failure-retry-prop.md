# Tie the failed frame line to Try again

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from branch `calummoore/preview-cannot-be-loaded-fov6`, the blocked wider fix of review finding 4.
- **Location:** `packages/ui/src/preview-frame/preview-frame.tsx`, `packages/viewer/src/shell/stage_frame.tsx`, and `packages/viewer/src/shell/document_stage_frame.tsx`.
- **Reason:** The fix replaces the `error` prop, which is on `origin/main`, so it changes existing functionality and needs the user's approval.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Failed frame line:** "This preview could not be loaded.", which `CanvasFrame` in `@mokly/ui` shows in a frame whose document failed to load.
- **Background:**
  - `CanvasFrame` takes `error`, a flag, and `retry`, an optional callback or address. With both, the line ends with Try again, which mounts the frame again.
  - `docs/protocol/mokly-viewer.md` requires Try again on every failed preview frame.
  - Browser specs `tests/browser/preview_retry.spec.ts` and `tests/browser/viewer_frame_retry.spec.ts` check that the shell's screen and document frames show Try again and recover.
- **Problem:** A host can pass `error` without `retry`. The line then has no way to recover, and only the tests notice.
- **Impact if no action:** A new frame container can show a failed line without Try again, against the requirement.
- **Root question:** How does every failed frame line offer Try again?
- **Options:**
  - **A.** Change nothing. The browser specs cover the two containers. Effort: Small.
  - **B.** Replace `error` and `retry` with one `failure` prop that holds the retry, so a failed line always has Try again. Effort: Medium.
- **Left out:** A lint for the pair. B removes the wrong case, so a detection fix is worse.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Recommendation:** B. A type that cannot hold a failed line without Try again removes the class.
- **Action:** ask the user, because B removes the `error` prop that is on `origin/main`.
