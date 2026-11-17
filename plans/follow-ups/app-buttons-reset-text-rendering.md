# App buttons reset the text rendering

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from task M2f of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `docs/mockups/styles/base.css` (the text-rendering rule) and the app's button elements under `ts/app/`.
- **Reason:** The difference is older than the change that found it, and it touches every app button.
- **Category:** Product bug.

- **Terms:**
  - **Text rendering:** The CSS `text-rendering` property, which the shared stylesheet sets for legible text.
- **Background:** The shared stylesheet sets `text-rendering` for the document, and its comment says that `auto` opens gaps in short bold words on 2x displays. The browser's own style for buttons sets `text-rendering: auto`. The app's buttons therefore compute `auto`, while the catalogue's drawn labels compute the shared value. Measured on 2026-11-06, the app's button labels lay out 2 to 7% wider than the drawings' in Chromium.
- **Problem:** App buttons render their labels with the setting that the shared stylesheet avoids, so they are wider than drawn and can show gaps in short bold words on 2x displays.
- **Impact if no action:** Button labels differ from the spec in width, and bold labels can look spaced on high-density screens.
- **Root question:** How do the app's buttons get the text rendering that the shared stylesheet sets?
- **Options:**
  - **A.** Make buttons inherit `text-rendering` in the shared stylesheet, so the app and the catalogue compute the same value. Effort: Small.
- **Left out:** Change the catalogue to `auto`. It brings back the gaps that the stylesheet avoids. There is one real approach, because the stylesheet already states the intent.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. It applies the stylesheet's own rule to buttons.
- **Action:** fix after merge, apply A, because it touches every button outside this change.
