# The unreadable-workspace drawing shows the display name

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-04, from task M2d of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** the drawing `product/viewer/standalone/workspace-unreadable` under `docs/mockups/src/entries/product/viewer/standalone/` and its screen in `docs/mockups/src/screens/product/viewer/`.
- **Reason:** The defect is in a drawing that the loading-states change did not touch, so a separate branch fixes it.
- **Category:** Mockup.

- **Terms:**
  - **Project trigger:** The viewer bar's control that names the workspace and the project and opens the projects panel.
- **Background:** `docs/protocol/cloud/viewer-chrome.md` says that the project trigger uses the workspace display name when its authorized read succeeds, and the readable slug while that optional read is pending or unavailable. The drawing `product/viewer/standalone/workspace-unreadable` draws the stage after that workspace read failed.
- **Problem:** The drawing's project trigger shows the workspace display name, which the failed read could not supply. It should show the workspace slug.
- **Impact if no action:** The catalogue draws a label that the app cannot have, so the drawing and the app disagree.
- **Root question:** What does the project trigger say after the workspace read failed?
- **Options:**
  - **A.** Draw the workspace slug in the trigger of `workspace-unreadable`, as `viewer-chrome.md` requires. Effort: Small.
- **Left out:** Change the protocol to allow the display name. The failed read cannot supply it, so the rule would describe a label that does not exist. There is one real approach, because the requirement settles it.
- **Wider fix:** None. The requirement already states the rule.
- **Previous examples:** None found.
- **Recommendation:** A. The requirement settles it.
- **Action:** fix after merge, apply A, because the drawing is outside the change that found it.
