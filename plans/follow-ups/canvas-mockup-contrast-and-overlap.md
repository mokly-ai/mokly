# Canvas mockups: three small drawing issues

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from `calummoore/canvas-redesign-m15-mockup-fixes-phap`.
- **Location:** `examples/basic/design-library/panels/floating-panel.css:41`, `examples/basic/design-canvas-inspect.css:131`, `docs/mockups/src/screens/design/site/home/viewer-compare.tsx`
- **Reason:** The Canvas mockup fix milestone found them, but its scope named other fixes.

- **Terms:**
  - **`--cv-line-strong`:** the Canvas mockup line colour for control edges, about 1.6:1 against the panel.
- **Background:** The Canvas Browse mockups draw floating panels, phone
  sheets and variant marks. The site mockup's home page draws the viewer's
  compare toolbar.
- **Problem:**
  - The sheet's scrollbar and the resting variant mark use `--cv-line-strong`,
    about 1.6:1, where meaningful control boundaries need 3:1.
  - The floating panel's `sheet` sample draws its close button over the word
    "Inspect".
  - On mobile, the home compare toolbar wraps "Side by side" onto two lines.
- **Impact if no action:** Milestones 11 and 12 can copy weak edges, and two
  drawings look broken.
- **Root question:** How do these three drawings meet the Canvas rules?
- **Options:**
  - **A.** Use `borderStrong` for both edges, give the close button its own
    column in the sheet head, and let the compare toolbar scroll or shorten
    the label on phones. Effort: Small.
  - **B.** Fix them in the mockup milestone that decision 11 of the Canvas plan
    adds. Effort: Small.
- **Left out:** Treating the edges as decorative, because both mark a control.
- **Wider fix:** Decision 12 of the Canvas plan holds the class-wide checks.
- **Previous examples:** The grabber fix in Milestone 15 of the Canvas plan.
- **Recommendation:** B, because that milestone already redraws these parts.
- **Action:** fix after merge, apply B, because the fix milestone did not own
  these files.
