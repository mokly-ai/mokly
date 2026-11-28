# Viewer doc places the frame failure note below the frame

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the review of branch `calummoore/preview-loading-issue-lcbo` (outside the scope).
- **Location:** `docs/protocol/mokly-viewer.md:104` and `packages/ui/src/canvas-frame/canvas-frame.css:295`.
- **Category:** Docs or spec.

- **Background:** When a preview frame fails to load, the viewer shows a status line with Try again.
- **Problem:** The viewer protocol says the line shows below the frame. The canvas stylesheet centres it inside the frame, over the document.
- **Impact if no action:** A reader of the protocol expects a layout that the product does not have.
- **Root question:** Where does the failure line of a frame stand?
- **Options:**
  - **A.** Change the protocol sentence to say the line stands centred over the frame. Effort: Small.
  - **B.** Move the line below the frame in the stylesheet and the mockups. Effort: Medium.
- **Left out:** None.
- **Wider fix:** None: no check can verify the claims of a protocol doc.
- **Previous examples:** None found.
- **Recommendation:** A. The centred line is the shipped and drawn design.
- **Action:** fix after merge, apply A.
