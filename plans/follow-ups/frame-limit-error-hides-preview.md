# An inspection limit marks a working preview failed

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-04, from the finding check of review finding 2 on the branch `calummoore/viewer-inspector-purpose`.
- **Location:** `packages/viewer/src/shell/frame_mount_hook.ts:102` and `packages/ui/src/preview-frame/preview-frame.tsx:63`.
- **Reason:** The defect exists on `origin/main` too, and the branch that found it does not change this code.

- **Terms:**
  - **Frame event:** an event that a frame adapter sends to the viewer
    shell, such as `hover`, `click`, `geometry`, or `error`.
  - **Inspection limit:** the bound of the frame probe wire protocol on the
    boxes of one range or one pointer event, 64 boxes. Over the bound, the
    adapter reports the error code `limit` and inspection stops, but the
    page stays usable.
- **Background:**
  - The viewer mounts each preview frame through
    `packages/viewer/src/shell/frame_mount_hook.ts`. Its `receive` function
    gets every frame event.
  - For each event of type `error`, `receive` sets the session status to
    `error` and calls `setStatus("error")`, whatever the error code.
  - The preview frame component in
    `packages/ui/src/preview-frame/preview-frame.tsx` then shows the status
    text "This preview could not be loaded."
  - A `limit` error can come from a hover or a click over a range with more
    than 64 boxes, after the page loaded and while it still works.
  - `docs/protocol/mokly-frame-probe-wire.md` says that a limit overflow
    reports unavailable inspection and leaves the content usable.
- **Problem:** A `limit` error from inspection makes the stage say that the
  preview could not be loaded, although the preview loaded and works.
- **Impact if no action:** A reader of a page with a very large component
  sees a false load failure after a hover, and can think that the page is
  broken.
- **Root question:** Which frame errors mean that the preview failed, and
  which mean only that inspection is unavailable?
- **Options:**
  - **A.** Mark the session failed only for the error codes that mean a
    failed load or mount, such as `origin`, `timeout`, `unavailable` before
    ready, and `disposed`. Keep `limit`, `invalid-boundary`, and
    `missing-instance` from inspection as inspection state. Add a test with
    a `limit` error after the frame is ready. Effort: Small.
  - **B.** Give the adapter contract two event kinds: a frame failure and an
    inspection failure, and let the shell show only frame failures. This
    changes the public `FrameEvent` type and the frame adapter contract.
    Effort: Medium.
  - **C.** Keep the status, and change the status text so that it covers
    both cases. The reader still sees a failure for a working preview.
    Effort: Small.
- **Left out:** Ignore all error events in the shell. It fails the goal,
  because a real load failure must still show.
- **Wider fix:** B. One event kind per meaning stops each consumer from
  sorting error codes again.
- **Previous examples:** None found.
- **Recommendation:** A. It fixes the false failure in one place and keeps
  the public types.
- **Action:** fix after merge, apply A, because the defect is Rare, exists on
  `origin/main`, and is outside the scope of the branch that found it.
