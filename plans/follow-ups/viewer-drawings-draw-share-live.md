# Viewer drawings draw Share live with nothing to share

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from task M2f of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `docs/mockups/src/screens/product/viewer/bar.tsx:96` (the fallback bar's Share), against `apps/app/src/screens/viewer/slots.tsx:255` and `docs/protocol/cloud/viewer-build-navigation.md:21`.
- **Reason:** It changes every viewer drawing that has nothing to share, and the difference is older than the change that found it.
- **Category:** Mockup.

- **Terms:**
  - **Share trigger:** The viewer bar control that opens the share panel for the publication on screen.
- **Background:** `docs/protocol/cloud/viewer-build-navigation.md` says that the Share trigger is disabled until a publication exists. The app disables Share until a ready publication or a published build exists. The catalogue's fallback bar draws Share live in every viewer drawing, except during the project read.
- **Problem:** Each drawing whose address has nothing to share, such as a branch with no publication or a publication that still loads, draws a Share control that the reader cannot press in the app.
- **Impact if no action:** The spec shows a live control that the product disables.
- **Root question:** How does the catalogue draw Share on an address with nothing to share?
- **Options:**
  - **A.** Draw Share disabled in the drawings that have nothing to share, one at a time. Effort: Small.
  - **B.** Let the bar take Share's state from each drawing's own state, mark those situations for the disk test, and update the tests that read the bar. Effort: Medium.
- **Left out:** Keep Share live and let its panel say that nothing is published. It breaks the requirement, which stays.
- **Wider fix:** B. One rule in the bar makes every drawing follow the requirement.
- **Previous examples:** None found.
- **Recommendation:** B. One rule covers every drawing.
- **Action:** fix after merge, apply B, because it changes every viewer drawing with nothing to share and is older than this branch.
