# Highlight reason stays generic for an outdated frame

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the review of branch `calummoore/preview-loading-issue-lcbo` (finding 11).
- **Location:** `packages/viewer/src/shell/frame_mount_hook.ts`, `packages/viewer/src/shell/workspace_inspection_runtime.ts:74`, `packages/ui/src/frames-filter/frames-filter.tsx:150`.
- **Category:** UX wording.

- **Background:** When a mount rejects with `version`, the canvas frame shows "This preview was built with an older version of Mokly. Update Mokly in the project, then publish it again." The frame session in the registry records only `error`. Inspect reads the session to explain why Highlight components is off.
- **Problem:** Inspect then says "This preview could not be loaded." for a failure that the canvas names exactly.
- **Impact if no action:** A reader who checks the disabled switch gets a vaguer reason than the canvas gives.
- **Root question:** How can the canvas and Inspect explain one frame failure the same way?
- **Options:**
  - **A.** Keep the failure code on the session and map it to the highlight reason. Effort: Small.
  - **B.** Give the registry session one typed lifecycle state that carries the failure reason, and make the hook and Inspect read it. Effort: Medium.
- **Left out:** Reading the canvas line through the DOM couples Inspect to the canvas layout.
- **Wider fix:** B.
- **Previous examples:** `plans/follow-ups/highlight-reason-after-failed-details.md`.
- **Recommendation:** B. Both consumers then read one source of the reason.
- **Action:** fix after merge, apply B, because it changes the frame registry and its inspection consumers for a secondary message.
