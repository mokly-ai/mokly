# Compact viewer hides pull request context

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from the new-problem check of review finding 5 on `conductor/follow-ups-hosted-viewer-layout`.
- **Location:** `ts/app/src/screens/viewer/slots.tsx`, `PublicationMeta` in `ts/app/src/viewer/chrome.tsx`, and the compact metadata rule in `docs/mockups/styles/product/viewer-bar.css`.
- **Reason:** The compact composition hides context required by the publication identity contract, and the recorded own-width choice does not settle its placement.
- **Category:** Product bug.
- **Terms:**
  - **More:** The compact viewer menu that groups cloud actions.
  - **Metadata:** The publication detail text, author, commit identifier, and GitHub link beside the publication trigger.
- **Background:** `docs/protocol/viewer-chrome.md` requires a pull request to show its number, title, author, and GitHub link. Its compact composition instead keeps the publication trigger and the five existing More actions. The author and GitHub link live in metadata that the compact CSS hides. On 2026-11-03 the user selected that existing phone bar whenever the bar is too narrow for full controls.
- **Problem:** The own-width switch extends the hidden author and GitHub link to normal desktop bars below `87rem`. More carries neither the author nor a GitHub action. Phones already had the same mismatch. A shortened publication trigger retains its complete accessible name, but that name contains no author or GitHub destination.
- **Impact if no action:** Readers lose direct pull-request attribution and navigation at narrow desktop widths. The current compact and publication identity requirements disagree.
- **Root question:** How should a compact viewer expose pull request context?
- **Options:**
  - **A.** Keep attribution and a GitHub link beside the compact publication trigger. Define the compact layout and its truncation priorities, then update the drawing. This uses scarce phone bar space. Effort: Medium.
  - **B.** Put the author and GitHub action in More or the publication switcher. Update the context requirement to define that placement and draw it. Readers need an extra step to see the context. Effort: Medium.
  - **C.** Keep the current compact bar and limit the author and GitHub requirement to the wide composition. This removes compact attribution and direct GitHub navigation from the contract. Effort: Small.
- **Left out:** Widening the bar on narrow screens recreates the overlap that the user chose to fix. A package change cannot choose cloud publication context. Changing nothing leaves the two requirements inconsistent.
- **Wider fix:** A. Separating context and actions from hideable metadata makes their placement explicit.
- **Previous examples:** The same metadata rule hid the author and GitHub link below the old 768 px breakpoint. The latest offer also lives in that hidden block.
- **Related:** `plans/follow-ups/compact-viewer-hides-latest-publication-offer.md` has the same concealment mechanism but a separate notification requirement. The one switch width in `docs/mockups/styles/product/viewer.css` coordinates the protected compact drawing sources, because "Mockup Representation" in `docs/protocol/viewer-chrome.md` requires the App and the drawings to share it. `viewer-more-menu-targets-below-required-size.md` has More-surface options that affect B.
- **Recommendation:** A. It preserves the existing context requirement and keeps the GitHub action available without opening another surface.
- **Action:** ask the user, because the current compact and publication identity requirements conflict, and each option changes one side.

Check a ready pull-request publication at 1280 px and on a phone. Inspect the visible author and the GitHub destination. The review confirmed their hidden wrapper by code inspection. Create the selected compact drawing before implementation. Do not change the original private-comparison overlay follow-up.
