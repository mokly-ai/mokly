# Comparison chrome ignores the screen address

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the viewer investigation and the options check of its plan.
- **Location:** `packages/viewer/src/shell/comparison_views.tsx:118` and `packages/viewer/src/shell/stage_frame.tsx:156-157`.
- **Reason:** One browser bar serves both panes, and no requirement says which address the Before pane shows.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Address:** a screen's authored address-bar label, the `address` field
    of `docs/protocol/mokly-html-screens.md:37`.
- **Background:** The live stage shows a desktop screen in a browser frame
  whose bar reads `entry.address`, or the entry route when the screen has no
  address, in `packages/viewer/src/shell/stage_frame.tsx:156-157`. The
  comparison builds one chrome for both panes with `entryRoute(entryId)`, in
  `packages/viewer/src/shell/comparison_views.tsx:118`. The detail's `before`
  side carries the base path, title, and props, but no address.
- **Problem:** A comparison shows the route in the address bar, while the live
  stage shows the authored address of the same screen.
- **Impact if no action:** The address bar of a comparison differs from the
  live stage for each screen that declares an address.
- **Root question:** What does the address bar of each comparison pane show?
- **Options:**
  - **A.** Show the current `address` in both panes. The Before pane then shows
    the current label, which can differ from the base. Effort: Small.
  - **B.** Give each pane its own chrome, with the current address in Current
    and the route of the base path in Before. Effort: Small.
  - **C.** Add the base address to the detail's `before` side, and show each
    side's own address. This needs a new detail version. Effort: Large.
- **Left out:** Changing nothing fails the goal, because the two stages
  disagree.
- **Wider fix:** C, because each side then reads its own authored label.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** B. Each pane shows a true label without a format change.
- **Action:** ask the user, because no requirement says what the Before pane's
  address bar shows.
