# Narrow desktop dock links open hidden sheets

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 2.
  The finding check of finding 8 found it outside the review scope.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/shell.tsx:151` and `:179-197`,
    where only a mobile render draws a sheet, and `:199-208`, the dock. Its
    Catalogue links to `design/canvas/stage/catalogue` at `:202`, and its
    current tab links to the state's `panelSheet` at `:204`.
  - `examples/basic/specs/design/canvas/parts/selection.tsx:93-94`, the
    selection pill, which links to `panelSheet` too.
  - `examples/basic/design-canvas-compact.css:7-37`, the compact form below
    900 px.
  - The sixteen links of the dock's current tab to its own artboard:
    `examples/basic/specs/design/canvas/parts/navigation_states.ts:106`,
    `examples/basic/specs/design/canvas/components/parts/navigation.ts:58`
    and `:77`, `examples/basic/specs/design/canvas/evidence/parts/navigation.ts:20`
    for nine states, and
    `examples/basic/specs/design/canvas/outcomes/parts/navigation.ts:43`,
    `:50`, `:64`, and `:68`.
  - The two other links of the dock's current tab:
    `examples/basic/specs/design/canvas/parts/navigation_states.ts:109` and
    `examples/basic/specs/design/canvas/flows/parts/navigation.ts:24`.
  - `tests/fixtures/design/expectations.json:326-330`, the `links` entry of
    the Catalogue of `design/canvas/overview`, which names no viewport.
  - `docs/protocol/mokly-design-links.md:43-50`, the link behaviour, and
    `docs/protocol/mokly-design-links-navigation.md:26` and `:30`, the rows
    of the dock and the selection pill.
- **Reason:** The links lie in the shared Canvas shell and in sixteen states
  outside the Storybook mockups that the branch draws.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Compact form:** the Canvas layout of every mobile render, and of a
    desktop render below the 900 px breakpoint. The floating panels close,
    an open panel is a bottom sheet, and the dock shows while no sheet is
    open.
  - **Dock:** the floating controls of the compact form: Catalogue, the
    right panel's current tab, Inspect or Changes, and Fit.
  - **Selection pill:** the pill above the dock that names a selected
    instance and opens the panel sheet.
  - **Picture:** a drawn control without an address. A Canvas mockup draws a
    control as a picture when no artboard shows its outcome.
- **Background:**
  - Each Canvas entry renders a desktop document and a mobile document.
    `docs/protocol/mokly-design-links.md:43-50` says that a design link opens
    a design entry in the same viewport. A depicted control without a
    destination adds no misleading keyboard stop.
  - A Canvas control opens the artboard that shows its outcome, and a
    control without one is a picture, as
    `docs/protocol/mokly-design-links-navigation.md:11-12` says.
  - The navigation table there sends the dock's Catalogue to
    `design/canvas/stage/catalogue`. It sends the dock's current tab and the
    selection pill to the artboard with the panel sheet open, such as
    `design/canvas/inspect/sections` from `design/canvas/inspect/selection`.
  - `CanvasShell` draws a sheet only in a mobile render, as `shell.tsx:151`
    and `:179-197` show. A desktop render draws both panels as floating
    panels.
  - The Canvas inventory says that a desktop render turns compact below the
    breakpoint, at `docs/protocol/mokly-shell-canvas-inventory.md:102-103`.
    There, `design-canvas-compact.css:7-10` hides each floating panel that is
    not a sheet, and `:26-37` shows the dock while no sheet is open.
  - So a desktop document never shows a sheet. In its compact form it shows
    the stage and the dock alone.
  - The dock's Catalogue links to `design/canvas/stage/catalogue` in every
    Canvas document. The dock's current tab and the selection pill link to
    the `panelSheet` destination of the state.
  - Sixteen states link the dock's current tab to their own artboard:
    - `design/canvas/inspect/unchanged`
    - `design/canvas/components/affected/direct` and
      `design/canvas/components/removed/consumer-changes`
    - the nine evidence states: `design/canvas/evidence/styles` with its
      `unresolved`, `unnamed`, and `excluded` variants,
      `design/canvas/evidence/unchanged` with its `action` variant,
      `design/canvas/evidence/page` with its `inspect` variant, and
      `design/canvas/evidence/ignored`
    - `design/canvas/outcomes/moved/inspect`,
      `design/canvas/outcomes/removed/inspect`,
      `design/canvas/outcomes/removed-variant`, and
      `design/canvas/outcomes/removed-variant/inspect`
  - The mobile render of each of these states opens its sheet, so the dock
    hides there, and the link shows only in a narrow desktop document.
  - Two other tab links open another artboard. The dock's Inspect and the
    selection pill of `design/canvas/inspect/selection` open
    `design/canvas/inspect/sections`. The dock's Inspect of
    `design/canvas/flows/tour` opens `design/canvas/flows/tour/mobile`.
  - The viewer draws each desktop document in a 1280 × 800 frame. So the
    compact form of a desktop document shows only when a reader opens the
    document in a window narrower than 900 px.
  - On 2026-11-25, a run of the build of 2026-11-24 in an 800 px window
    confirmed it. On the desktop `design/canvas/inspect/unchanged`, both
    panels were hidden, the dock showed, and its Inspect linked to the same
    document with `aria-current="page"`. The desktop
    `design/canvas/inspect/sections`, `design/canvas/stage/catalogue`, and
    `design/canvas/flows/tour/mobile` hid both panels at that width.
- **Problem:** In a desktop document narrower than 900 px, the dock's
  Catalogue, the dock's current tab, and the selection pill open desktop
  documents that hide the sheet that the control promises. A link to the
  shown artboard reopens it with its panel hidden.
- **Screenshot:** In an 800 px window, the desktop
  `design/canvas/inspect/unchanged` shows Profile's frame and the dock, with
  no panel. Inspect in the dock reopens the same view. No picture was saved.
- **Impact if no action:** A reader of a narrow desktop document follows
  Catalogue, Inspect, or Changes and gets a stage with no catalogue and no
  panel. A link to the shown artboard gives the same stage again. Each
  control is a keyboard stop that promises an outcome that no desktop
  document shows.
- **Root question:** How does a narrow desktop document offer the dock's
  controls and the selection pill only where an artboard shows their
  outcome?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. For the three story Inspect
  states, the branch applied A on 2026-11-25.
  - **A.** Remove the sixteen links to the shown artboard, as the branch did
    for the three story Inspect states. The dock's tab is then a picture in
    those states. The dock's Catalogue and the two other tab links stay
    wrong. Effort: Small.
  - **B.** Let the shared shell open, in a narrow desktop document, the sheet
    that the state names. Each dock link then opens a desktop artboard that
    shows its sheet at that width.
    [canvas-phone-sheet-explicit.md](canvas-phone-sheet-explicit.md) holds
    this work as its option F. B adds a requirement for what a desktop render
    shows below the breakpoint, so it needs the user's decision. Effort:
    Medium.
  - **C.** Give the compact form a native disclosure that opens the panel in
    the same document. It keeps the closed start and adds a new presentation
    for the dock. It replaces the dock rows of the navigation table, so it
    needs the user's decision. Effort: Medium.
  - **D.** Draw the dock's Catalogue, its current tab, and the selection pill
    as pictures in a desktop render, because no desktop document shows a
    sheet. Effort: Small.
    - In `CanvasShell`, pass the destinations of Catalogue and of the tab to
      the dock only in a mobile render. Give `SelectionPill` the viewport,
      and let it link only in a mobile render.
    - The mobile renders keep every link. The dock's Fit keeps its link,
      because its own artboard shows the fitted stage.
    - The sixteen links to the shown artboard then have no effect. Remove
      them, as in A.
    - Limit the `links` entry of the Catalogue of `design/canvas/overview` to
      the mobile viewport. Add a desktop entry with the target `null`, so
      that the check stays as strict.
    - Say in the two dock rows of
      `docs/protocol/mokly-design-links-navigation.md` that a desktop render
      draws these controls as pictures. The link rules of
      `docs/protocol/mokly-design-links.md` already require it, so no
      requirement changes.
  - **E.** Let a desktop document keep the wide layout at every width, so
    that only a mobile render draws the compact form. The panels then cover
    most of a narrow stage. E changes the family rule at
    `docs/protocol/mokly-shell-canvas-inventory.md:102-103`, so it needs the
    user's decision. Effort: Medium.
  - **F.** Add a design catalogue check. In a desktop view, a dock control or
    a selection pill has no address, or it opens an artboard whose desktop
    view shows the sheet. It is a new check, so the user must approve it. It
    fixes nothing alone. Effort: Small.
- **Left out:** A link to the mobile document: it switches the viewport, and
  a design link opens its target in the same viewport.
- **Wider fix:** D, a default of the shared shell that every Canvas artboard
  uses. B also prevents the class, because each link then shows its outcome,
  but it needs the user's decision. F only detects the class.
- **Previous examples:**
  - Commit `6d4f4f6cf`, the Canvas redesign of 2026-11-24, added the dock and
    the sixteen links to the shown artboard.
  - Commit `54e0a948e` linked the dock's Inspect of the three story Inspect
    states to their own artboards. The branch removed those links on
    2026-11-25.
- **Related:** [canvas-phone-sheet-explicit.md](canvas-phone-sheet-explicit.md)
  holds B as its option F, in the same shell code. B and D conflict. D draws
  the dock's links of a desktop render as pictures, and B makes them open
  documents that show the sheet. If B lands first, its branch also closes
  this item. If D lands first, the branch of B restores the desktop links
  that D removes.
- **Recommendation:** D. One default of the shell removes every misleading
  dock link, and it changes no requirement. B best serves a reader of a
  narrow desktop document, but it needs the user's decision.
- **Action:** fix after merge, apply D, because the links lie in the shared
  shell and in sixteen states outside the Storybook mockups of the branch.
