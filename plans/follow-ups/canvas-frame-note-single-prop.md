# Canvas frame note takes one prop per state

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the review of branch `calummoore/preview-loading-issue-lcbo` (finding 4, wider fix).
- **Location:** `packages/ui/src/canvas-frame/canvas-frame.tsx`, `packages/viewer/src/shell/canvas_live_frame.tsx:110`, `canvas_use_case_frame.tsx:78`, `canvas_reading.tsx:53`.
- **Category:** Code structure.

- **Background:** `CanvasFrame` of `@mokly/ui` shows the note of a frame whose document did not load. It takes two optional booleans, `error` and `outdated`. Three viewer frames map the frame status to these booleans by hand.
- **Problem:** A new frame status, or a new live frame, can omit a flag and still type-check. The branch added a Node test for the three current frames, but the type system does not protect the mapping.
- **Impact if no action:** A later status can silently show no note, or the wrong one.
- **Root question:** How can every live frame show the note of its status without a hand-made mapping at each call site?
- **Options:**
  - **A.** Replace `error` and `outdated` with one `note` prop, such as `"error" | "outdated" | null`. Map `ShellFrameStatus` to it in one helper with an exhaustive switch. Effort: Medium.
  - **B.** Make one viewer frame component own the mount status and the note for all three frame kinds. Effort: Medium.
- **Left out:** More tests per call site. The Node test exists, and it does not stop a new call site from forgetting the flag.
- **Wider fix:** A.
- **Previous examples:** `3e09c6150` tested preview recovery through the rendered viewer.
- **Recommendation:** A. The type check then rejects an unhandled status at every caller.
- **Action:** fix after merge, apply A, because it changes the `@mokly/ui` API and every `CanvasFrame` caller, mockups included.
