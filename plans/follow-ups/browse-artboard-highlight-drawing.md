# Browse artboard highlight switches draw nothing

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, review finding 1.
- **Location:** `examples/basic/specs/design/parts/screen_heads.tsx` and `examples/basic/specs/design/browse/index-entries/screens.tsx`, which pass the highlight state `available`; the previews `MiniWelcome` and `MiniDetails` in `examples/basic/specs/design/parts/mini_screens.tsx` and `MiniProfile` and `MiniSecurity` in `examples/basic/specs/design/parts/mini_account.tsx`; `examples/basic/mokly.config.json`, which gives these pages no highlight stylesheet.
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
    without a highlight layer on 26 Browse pages and 8 Changes pages.
  - The fixtures `MiniWelcome`, `MiniDetails`, `MiniProfile`, and
    `MiniSecurity` draw no registered component. The real Welcome and
    Details screens in `examples/basic/specs/catalogue.tsx` render the
    Action and Toolbar components.
  - `examples/basic/mokly.config.json` gives these pages neither
    `design-component-view.css` nor `design-component-inspection.css`, the
    stylesheets of the explorer's highlight layers.
  - The component explorer's artboards already draw working highlights,
    from `examples/basic/specs/design/components/parts/highlight.tsx`.
  - The Toolbar component page drew the same inert switch. The same branch
    fixed it, because its example already depicts the Action.
  - The Profile and Security artboards pass `available`, but no contract or
    design panel names a registered component for those screens. Check
    whether the shell shows "No registered components in this view" for
    them. Then they need the state `empty` and no drawing.
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
- **Action:** ask the user, because B and C change approved previews and D
  changes a contract.
