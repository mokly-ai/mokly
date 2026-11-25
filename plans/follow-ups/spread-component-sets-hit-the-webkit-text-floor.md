# Spread component sets hit the WebKit text floor

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the branch `calummoore/homepage-functionality-vjxs`, review round 2, a new problem that the check of finding 8 found.
- **Location:** `apps/site/src/styles/home-spread.css:173`, `docs/mockups/styles/site/home-spread.css:120`
- **Reason:** The rule is on `origin/main`, outside the diff of the home zoom change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Spread:** the depicted screens and component sets of the fictional demo app below the home's hero.
  - **Component set:** a box of the spread that draws a set of the demo app's components at half size, `.site-home-set-inner`.
  - **WebKit:** the browser engine of Safari. Under CSS `zoom` it draws no text smaller than 9px.
- **Background:** Both the site and its mockup draw each component set at half size with `zoom: 0.5` on `.site-home-set-inner`.
- **Problem:** WebKit draws the sets' text at its 9px floor, at 100% on the live site and in the drawing. "Most popular" is 56px wide in WebKit and 40px in Chromium.
- **Impact if no action:** Safari readers see larger text in the component sets than the design draws, and the sets' parts can crowd.
- **Root question:** How does a component set draw its parts at half size in every engine?
- **Options:**
  - **A.** Scale each set's inner box with a transform of 0.5 from its top start, and give the box the half height that it takes. Keep the same rule in the mockup sheet. Effort: Small.
  - **B.** Draw the sets' parts at half size in their own lengths, with no scale. Effort: Medium.
- **Left out:** Leaving WebKit as it is keeps the larger text.
- **Wider fix:** A. The home's zoom already scales parts with a transform for the same floor.
- **Previous examples:** The home's zoom pill first zoomed the site with CSS `zoom`. WebKit drew the zoomed-out text at 9px, and the text overlapped, so on 2026-11-24 the site moved to a transform.
- **Recommendation:** A. A transform scales the text in every engine, as the home's zoom does.
- **Action:** fix after merge, apply A, in its own change, because the rule is on `origin/main`.
