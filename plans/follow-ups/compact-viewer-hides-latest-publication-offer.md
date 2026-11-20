# Compact viewer hides the latest publication offer

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from review finding 5 on `conductor/follow-ups-hosted-viewer-layout`.
- **Location:** `packages/app/src/screens/viewer/slots.tsx`, `PublicationMeta` in `packages/app/src/viewer/chrome.tsx`, and the compact metadata rule in `docs/mockups/styles/product/viewer-bar.css`.
- **Reason:** The existing compact composition conflicts with the requirement for a visible latest offer, and no recorded choice settles its placement.
- **Category:** Product bug.
- **Terms:**
  - **Publication:** One published version of a project's mockup catalogue.
  - **More:** The compact viewer menu that groups cloud actions.
  - **Metadata:** Publication state, time, and short commit identifier beside the publication trigger.
- **Background:** `docs/protocol/cloud/viewer-address-state.md` requires a visible View latest offer after a newer publication appears. `docs/protocol/cloud/product-mockups-viewer.md` puts that offer beside the publication. The compact rules in `folio-viewer.md` and `viewer-chrome.md` keep only the publication trigger and list five More actions. On 2026-11-03 the user chose the existing phone composition whenever the bar is too narrow, based on its own width. That choice did not settle the latest offer's compact placement.
- **Problem:** View latest is a child of `PublicationMeta`, whose compact styling sets `display: none`. More has no replacement. A successful poll therefore gives no visible offer below the current `87rem` full-bar width, including a normal 1280 px desktop window. The phone already hid the offer before the bar-width change.
- **Impact if no action:** Readers can keep reviewing an old publication without seeing that a new one exists. History and the switcher provide a manual workaround.
- **Root question:** How does a narrow bar tell the reader that a newer publication exists and offer View latest?
- **Options:**
  - **A.** Add a conditional View latest entry to More. Keep the wide-bar button. The closed menu still hides the offer until opened. Effort: Medium.
  - **B.** Keep a separate View latest button beside the compact publication trigger. Its space shortens the publication label sooner. Update the compact composition and its drawing. Effort: Medium.
  - **C.** Separate actions from metadata and place each in the wide bar or More. Remove the metadata component's arbitrary children slot. The compact offer still sits in a closed menu. Effort: Medium.
  - **D.** Separate actions from metadata and keep View latest visible beside the publication in both compositions. Remove the metadata children slot. Update the compact requirement and drawing, then add a second-publication browser regression with a controlled poll. Effort: Medium.
  - **E.** Add View latest to More and mark its trigger when a newer publication waits. This needs indicator copy, a requirement, and a drawing. The action remains one menu step away. Effort: Medium.
- **Left out:** Changing nothing fails the notification requirement. A stage banner or toast moves the offer away from its required place in the viewer chrome. A package change cannot decide cloud action placement.
- **Wider fix:** D. Metadata cannot hide controls, and the required offer remains visible in either composition.
- **Previous examples:** The same CSS hid View latest below 768 px before the own-width switch. PR #115 fixed a separate polling cause in `packages/app/src/viewer/latest.ts`.
- **Related:** The one switch width in `docs/mockups/styles/product/viewer.css` coordinates the protected drawing sources, because "Mockup Representation" in `docs/protocol/cloud/viewer-chrome.md` requires the App and the drawings to share it. `viewer-more-menu-targets-below-required-size.md` holds More-surface choices that affect A, C, and E. A pull request's GitHub link also lives inside the hidden metadata and needs the same placement audit.
- **Recommendation:** D. It preserves a visible offer beside the publication. The first pass recommended C, which leaves the offer inside a closed menu.
- **Action:** ask the user, because the compact composition and latest-offer requirements conflict, and the recorded bar decision does not choose a placement.

Reproduce with a published branch at 1280 px. Publish a second ready version of that branch, then trigger the viewer's existing poll with a controlled browser clock or visibility event. The current page must stay on its publication. The present implementation creates no visible View latest offer. Do not change the reference poll in `packages/app/src/viewer/latest.ts` or the shared-control menu design while choosing this placement. A compact drawing must come before its implementation.
