# Bar resize drops focus from removed controls

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from the wider-fix check of review finding 6 on `conductor/follow-ups-hosted-viewer-layout`.
- **Location:** `packages/app/src/viewer/bar.tsx`, the More state in `packages/app/src/screens/viewer/viewer-screen.tsx`, the slot references in `packages/app/src/screens/viewer/carriers.ts`, and the focus return in `packages/app/src/viewer/focus.ts`.
- **Reason:** No requirement states where focus moves when a responsive bar removes its focused control, so the wider fix needs a user choice.
- **Category:** Product bug.
- **Terms:**
  - **Carrier:** The visible bar control for a logical action, either its direct trigger or More.
  - **More:** The compact menu that carries the viewer's grouped cloud actions.
- **Background:** The bar swaps its direct controls and More when its width crosses the one switch width in `docs/mockups/styles/product/viewer-bar.css`. React unmounts the controls that the new composition does not draw: History, Share, Settings and the account, or More. The publication trigger stays mounted: both compositions draw the pill in the package's `topBarCenter` slot, so it keeps any focus it holds, and History and Settings change between their labelled and glyph drawings in place, so they keep theirs. Current focus-return requirements cover overlay dismissal and fallback-to-package handoff. They do not state a focus destination during a resize without dismissal.
- **Problem:** A focused direct control disappears when the bar narrows, so focus can fall to the document body. Widening with More open also removes the menu and trigger. The review identified these paths by code inspection and did not reproduce them in a browser.
- **Impact if no action:** A keyboard reader can lose their place after resizing, zooming, or changing text size across the bar threshold.
- **Root question:** Where should focus go when the bar removes its focused control?
- **Options:**
  - **A.** Keep the browser's current fallback to the document body. Add no focus move. The reader must resume with Tab. Effort: Small.
  - **B.** Move focus to the publication trigger whenever the focused bar control disappears. The trigger stays mounted in the centre slot across the switch width, so it is a stable destination. This is simple, but the destination can differ from the action the reader used. Effort: Small.
  - **C.** Resolve the logical action to its current carrier through the bar's placement model. Move focus there only when the removed control or menu held it. Preserve focus elsewhere. Define the behavior in the viewer contract and cover both directions in the layout browser journey. Effort: Medium.
- **Left out:** Keeping hidden controls mounted provides no usable focus destination. Freezing the wide composition can reintroduce overlap. Closing unrelated overlays adds a dismissal behavior that the user did not choose.
- **Wider fix:** C. The same placement model can govern rendering, held focus, and overlay focus return.
- **Previous examples:** The old 768 px window switch had the same removal paths. A layout journey in `packages/app/src/_tests_/viewer/bar-focus.spec.ts` checks that the pill and History keep the focus they hold as the bar changes its drawings. `packages/app/src/viewer/focus.ts` already resolves logical opener slots across package handoff, but only after overlay dismissal.
- **Related:** Overlay dismissal already returns focus to the action's current carrier through the placement model in `packages/app/src/viewer/bar.tsx` and `packages/app/src/viewer/focus.ts`, without this held-focus choice. Option C adds the held-focus move to that same placement model. `compact-viewer-hides-latest-publication-offer.md` also changes action placement.
- **Recommendation:** C. It keeps the reader on the same logical action and preserves unrelated focus.
- **Action:** ask the user, because C adds a focus move during resize that no current requirement defines.

Reproduce first. Focus History in a wide bar and narrow the App-owned viewer container. Then open More in a narrow bar and widen the container while a row has focus. Record the destination after each change. Do not add a retry, sleep, or longer restoration window. Keep the overlay-dismissal restoration of `packages/app/src/viewer/focus.ts` working. The journey "the top bar keeps controls readable and follows its own width" in `packages/app/src/_tests_/viewer/layout.spec.ts` covers it.
