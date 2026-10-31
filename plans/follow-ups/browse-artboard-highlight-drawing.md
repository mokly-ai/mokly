# Browse artboard highlight switches draw nothing

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, review finding 1.
- **Location:** The headers that pass the highlight state `available` over previews without regions: `examples/basic/specs/design/parts/screen_heads.tsx`, `examples/basic/specs/design/browse/variants/screens.tsx`, `examples/basic/specs/design/browse/views/details-screen.tsx`, `examples/basic/specs/design/review_availability_screens.tsx`, `examples/basic/specs/design/review_outcome_screens.tsx`, `examples/basic/specs/design/publication_screens.tsx`, and `examples/basic/specs/design/changes/impact/styles/matched-excluded/screens.tsx`; the previews `MiniWelcome` and `MiniDetails` in `examples/basic/specs/design/parts/mini_screens.tsx`; `examples/basic/mokly.config.json`, which gives these pages no highlight stylesheet.
- **Reason:** Every option that draws the highlights changes approved previews or needs a contract exception, so the user must choose.

- **Terms:**
  - **Artboard:** a static design screen of the design catalogue under
    `examples/basic/specs/design`. It runs no script, also inside the
    sandboxed frames of the Browse shell.
  - **Highlight components switch:** the header control that turns the
    component mask over a preview on and off. On an artboard it is a
    checkbox with `role="switch"`, and design CSS reads its checked state
    with `:has()` rules.
  - **Highlight layer:** the dimmed mask, the outlines, and the labels that
    mark the registered components inside a preview.
  - **Browse and Changes artboards:** the artboards of the catalogue's
    Browse pages and Changes pages, which draw the shell around small
    preview fixtures such as `MiniWelcome`.
- **Background:**
  - On 2026-10-30 the user chose that each artboard draws the Highlight
    components switch in the state that the shell shows for its view.
    Rejected then: a disabled switch where an artboard gives no state, and a
    header without the switch.
  - `docs/protocol/mokly-component-workspace-design.md` says that these
    mockup controls work without scripts, also inside Browse's sandboxed
    frames, and that highlighting uses the fixture's overlay geometry.
  - Before that choice, the Browse and Changes artboards drew no Highlight
    switch. They now draw an enabled switch, because the shell offers
    highlighting on the Welcome and Details screens.
  - A build of the design catalogue on 2026-10-30 found an enabled switch
    without a highlight layer on 22 Browse pages and 8 Changes pages, in 84
    documents. Five view-controls library samples also draw the switch
    alone, and they need no layer, because they show the control only.
  - The fixtures `MiniWelcome` and `MiniDetails` draw no registered
    component. The real Welcome and Details screens in
    `examples/basic/specs/catalogue.tsx` render the Action and Toolbar
    components.
  - `examples/basic/mokly.config.json` gives these pages neither
    `design-component-view.css` nor `design-component-inspection.css`, the
    stylesheets of the explorer's highlight layers.
  - The component explorer's artboards already draw working highlights,
    from `examples/basic/specs/design/components/parts/highlight.tsx`.
  - The Toolbar component page drew the same inert switch. The same branch
    fixed it, because its example already depicts the Action.
  - The Profile and Security artboards pass `empty`, because those screens
    use no registered component, so their switch is disabled with the
    shell's empty reason. The same branch fixed them.
- **Problem:** On these artboards, a reader can check the Highlight
  components switch, and nothing changes.
- **Impact if no action:** The mockups offer a control that does nothing,
  and they do not show what the shell draws when a reader turns on
  highlighting.
- **Root question:** How does an artboard depict Highlight components where
  the shell offers it, so that the switch never does nothing?
- **Options:**
  - **A.** Keep the enabled switches without a drawing. Effort: Small.
  - **B.** Draw the highlights on every Browse and Changes preview. The
    fixtures depict the Action and Toolbar that the real screens render.
    One shared helper draws the regions from a width, a height, boxes, and
    labels. The reveal rule goes in
    `examples/basic/design-library/controls/view-controls.css`, which every
    page with the switch loads, and the pages load the highlight styles.
    Effort: Large.
  - **C.** B, drawn with the package component `@mokly/ui/highlight-mask`
    from fixed boxes, once that component is on `main`, so the artboards and
    the shell share one drawing. Effort: Large.
  - **D.** Where a preview draws no highlight, draw the switch as a picture
    in the shell's state, with no input and no keyboard stop. This needs a
    third static form of `@mokly/ui/view-controls` and an exception in the
    workspace contract. Effort: Large.
  - **E.** One record per depicted view in the artboard scaffolds holds the
    shell's highlight state and the preview's regions, so a header draws an
    operable switch only over a preview that draws regions. Builds on B, C,
    or D. Effort: Large.
  - **F.** A design catalogue check: every artboard with an enabled
    Highlight components switch draws a highlight layer, apart from the
    view-controls library samples, which show the control alone. Effort:
    Small.
- **Left out:** Disabling the switches, because the user chose the shell's
  state. Inspection scripts, because Browse's frames use
  `sandbox="allow-same-origin"` without `allow-scripts`. The package's
  button form of the switch, because a press still does nothing. A link from
  the switch to an explorer artboard, because the reader leaves the view.
- **Wider fix:** E. It removes an operable switch over a preview without
  regions. F is the detection fallback.
- **Previous examples:** None found.
- **Recommendation:** C. The mockups then show what the shell draws, and
  one package drawing serves the shell and every artboard.
- **Answer:** On 2026-10-31 the user chose C and E: the artboards draw the
  highlights with `@mokly/ui/highlight-mask`, and one record per depicted
  view holds the highlight state and the preview's regions.
- **Action:** fix after merge, apply C and E, because the package mask lands
  with the layout slice of the shell views stack, whose milestone 19 applies
  this answer and deletes this item.
