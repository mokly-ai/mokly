# StageOverlay has no static mode

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `packages/ui/src/embedded-layout/host-slot.tsx:51-100`, and the cloud drawing of the overlay in `docs/mockups/src/screens/product/viewer/published-slots.tsx`.
- **Reason:** A fix adds a public prop to a `@mokly/ui` component, which the user decides.

- **Source:** Design.
- **Category:** Mockup.
- **Background:**
  - `StageOverlay` of `@mokly/ui` is the slot that covers the shown preview surface of its stage host. It renders `hidden`, and it shows only after a layout effect measures the preview, in `packages/ui/src/embedded-layout/host-slot.tsx:51-100`.
  - A static mockup runs no layout effect, so it cannot show the slot.
  - `HighlightMask` of `@mokly/ui` has a static depiction: a drawing that cannot measure gives SVG lengths, as `packages/ui/src/highlight-mask/highlight-mask.tsx:1-16` states.
  - So the cloud mockups draw the stage overlay content without the package slot, in `docs/mockups/src/screens/product/viewer/published-slots.tsx`. The Mokly 0.18.0 upgrade of the cloud found this.
- **Problem:** A static mockup cannot show `StageOverlay`, so mockups draw the overlay in another way.
- **Impact if no action:** A mockup of the overlay can drift from the placement that the package gives.
- **Root question:** How does a static mockup show the stage overlay slot?
- **Options:**
  - **A.** Keep the drawing in the mockups. Effort: Small.
  - **B.** Give `StageOverlay` a static placement, like the static depiction of `HighlightMask`: a prop that sets the box in lengths of the drawing and shows the slot without a measurement. Move the cloud drawing to it. Effort: Medium.
- **Left out:** Show the overlay before the first measurement. A live host then shows a misplaced overlay for one frame.
- **Wider fix:** B. Each static drawing then uses the package slot.
- **Previous examples:** `HighlightMask` has a static depiction for the same reason.
- **Recommendation:** B. Mockups then draw the package component, as the repository rules for design mockups ask.
- **Action:** ask the user, because B adds a public prop to `@mokly/ui`, which no requirement covers.
