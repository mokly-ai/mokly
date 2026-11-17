# The desktop settings dialog misses its screen class

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-04, from task M2e of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/settings/surface.tsx` (the desktop dialog frame; only the layer at line 182 sets `fo-settings-screen`) and `docs/mockups/styles/product/settings.css` (the `.fo-settings-screen .fo-state` rule).
- **Reason:** The difference is in the dialog frame, which the loading-states change did not need to touch.
- **Category:** Product bug.

- **Terms:**
  - **State card:** The shared empty, loading and error body: a glyph tile, a title, a line and one action.
- **Background:** The catalogue's stylesheet gives a state card inside a settings screen less padding through the rule `.fo-settings-screen .fo-state`. The drawings of the desktop dialog carry the class `fo-settings-screen`. In the app, only the mobile layer sets it; the desktop dialog does not.
- **Problem:** On desktop, every state card in a settings pane is about 16 px taller in the app than in its drawing.
- **Impact if no action:** Settings empty and error states on desktop do not match their drawings, so a pane's state draws in a different place than the spec shows.
- **Root question:** How does the desktop settings dialog draw its state cards at the size that its drawings show?
- **Options:**
  - **A.** Set `fo-settings-screen` on the desktop dialog frame in the app, as the drawings do, and check that no other rule under that class changes the dialog. Effort: Small.
- **Left out:** Change the drawings to the app's padding. The drawings follow the stylesheet's rule, which the app is meant to share. There is one real approach, because the shared stylesheet settles it.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. The app shares the catalogue's stylesheet, and the class is the only difference.
- **Action:** fix after merge, apply A, because the dialog frame is outside the change that found it.
