# The search shortcut does nothing inside a canvas frame

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m11-canvas-stage-in-knaz`.
- **Location:** `packages/frame/src/canvas_input.ts`,
  `docs/protocol/mokly-frame-canvas-input.md`, the shell's search shortcut in
  `packages/viewer/src/shell`
- **Reason:** The Canvas redesign added the frame's canvas input for the four
  zoom keys only, and the search shortcut came later in the same work.

- **Source:** Implementation.
- **Category:** Product bug.
- **Background:** `⌘K`, Ctrl+K and `/` focus the viewer's search field. The
  frame probe forwards only the canvas zoom keys from a frame's document, and
  `mokly-frame-canvas-input.md` excludes keys with Ctrl or Command.
- **Problem:** When focus is inside a frame's document, the search shortcut
  does nothing.
- **Impact if no action:** A reader who clicked into a frame must click
  outside it before the shortcut works.
- **Root question:** How does the search shortcut reach the shell from inside
  a frame?
- **Options:**
  - **A.** Forward `⌘K`, Ctrl+K and `/` as one more `canvas-key` value,
    `search`, outside editable elements, and let the shell focus the search.
    Change the canvas input page. Effort: Small.
  - **B.** Change nothing, and document the limit. Effort: Small.
- **Left out:** Reading key events of a cross-origin frame from the host,
  because the browser does not allow it.
- **Wider fix:** A.
- **Previous examples:** The canvas zoom keys of the same page.
- **Recommendation:** A. It reuses the forwarding that already exists.
- **Action:** fix after merge, apply A, because the redesign is otherwise
  complete without it.
