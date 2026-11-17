# Viewer panels grow when their lists load

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from task M2d of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `docs/protocol/folio-viewer.md` (**Panel**), `docs/mockups/styles/product/viewer.css` (the panel frame), and the panels in `ts/app/src/viewer/panels/`.
- **Reason:** Each option that stops the move changes the **Panel** rule of `docs/protocol/folio-viewer.md`, so the user decides.
- **Category:** Product bug.

- **Terms:**
  - **Viewer panel:** The registered `panel` frame that the branch switcher, the projects list, the history and the share panel open over the viewer. On desktop it is a centered modal at most 480 px wide and 76vh tall. On a phone it is a bottom sheet at most 84vh tall.
  - **Wait:** What a region draws while a read that it needs runs. `docs/protocol/folio-chrome.md` defines it: the layout that it waits for, with one placeholder row for a list.
- **Background:** Each panel reads its list when it opens. While the read runs, the panel draws its own groups with one placeholder row in each list. Both panel forms take their height from their content, up to their cap. The desktop modal is centered, so its top moves by half of any change in height.
- **Problem:** When the list arrives with more than one row, the panel grows and its title moves. The drawings measure 45 to 158 px on desktop and 146 to 361 px on a phone. The earlier three-bar wait moved it too.
- **Impact if no action:** Each panel jumps when its list loads, which is the defect that the change of 2026-11-04 removed from every other wait.
- **Root question:** How does a viewer panel keep its title still while its list loads?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Give a panel that lists a minimum height: the 76vh cap on desktop, as the settings dialog has, and the full 84vh on a phone. Change the **Panel** rule, the drawings and the app. Short lists then leave empty space at the foot of the panel. Effort: Medium.
  - **C.** Keep the desktop panel's top fixed so that it grows down, and open the phone sheet at its full height. Change the **Panel** rule, the drawings and the app. The desktop panel then no longer sits centered. Effort: Medium.
- **Left out:** Draw more placeholder rows, because the count is unknown and a short list would then shrink instead.
- **Wider fix:** B. The settings dialog already holds its height this way.
- **Previous examples:** The settings dialog holds a fixed body height, so its panes do not move it (`docs/mockups/styles/product/settings.css`).
- **Recommendation:** B. It reuses the settings dialog's rule and keeps the centered panel.
- **Action:** ask the user, because each option that stops the move changes the **Panel** rule in `docs/protocol/folio-viewer.md`.
