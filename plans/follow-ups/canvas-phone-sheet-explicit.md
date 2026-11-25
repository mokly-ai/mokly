# Compact artboards drop a panel without notice

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 2. It is the wider fix E of the finding check, which the branch
  split off its direct fix. Review round 2, finding 8, added the narrow
  desktop window and its wider fix B, which this item names F.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/shell.tsx:48-49`, the optional
    `sheet` prop of `CanvasShell`, `:151`, where only a mobile render is
    compact, and `:179-197`, where a phone render draws the catalogue or the
    right panel only for the named sheet.
  - `examples/basic/specs/design/canvas/parts/set_stage.tsx:63`, the optional
    `sheet` prop of `VariantSetArtboard`.
  - The wrappers with an optional sheet of their own:
    `examples/basic/specs/design/canvas/outcomes/parts/removed_artboard.tsx:28`,
    `examples/basic/specs/design/canvas/components/affected.tsx:67`, and
    `examples/basic/specs/design/canvas/flows/tour.tsx:33`.
  - Every use of `CanvasShell` and `VariantSetArtboard` under
    `examples/basic/specs/design/canvas/`.
  - `examples/basic/design-canvas-compact.css:7-37`, the compact form, and
    `examples/basic/specs/design/library/panels/floating-panel.view.tsx:45-63`,
    the sheet form of a floating panel.
  - `docs/protocol/mokly-shell-canvas-inventory.md:22-25` and `:102-110`, the
    Phone sheet column and its family rule.
- **Reason:** E changes two shared Canvas scaffolds and about twenty of their
  uses across the Canvas folders, outside the Storybook mockups that the
  branch draws.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Inspect:** the tab of the right panel that shows the selected entry's
    Details, Props, and Usage.
  - **Panel sheet:** the phone form of the right panel, a bottom sheet over
    the stage. `CanvasShell` names it `"panel"`.
  - **Phone sheet column:** the column of the Canvas inventory tables that
    names the sheet that the mobile render of each entry opens, or None.
  - **Dock:** the floating controls of a phone: Catalogue, the tab of the
    right panel, and Fit.
  - **Compact form:** the Canvas layout of every mobile render, and of a
    desktop render below the 900 px breakpoint. The floating panels close,
    an open panel is a bottom sheet, and the dock shows while no sheet is
    open.
- **Background:**
  - `CanvasShell` draws one artboard of the Canvas design family. Its
    optional `sheet` prop names the sheet that a phone render shows open:
    `"catalogue"` or `"panel"`.
  - A phone render draws the right panel only while `sheet` is `"panel"`, and
    the catalogue only while it is `"catalogue"`. With no `sheet`, it drops
    the `panel` content that the caller passed, and nothing warns.
  - `VariantSetArtboard`, the scaffold of a component's variant set, passes
    its own optional `sheet` to `CanvasShell`.
  - The tab control of the dock links to the `panelSheet` destination of the
    artboard's navigation state. Without one, the control is a picture.
  - `docs/protocol/mokly-shell-canvas-inventory.md` gives the Phone sheet of
    each entry: "None means that no sheet opens." A mobile render draws "only
    the sheet that the Phone sheet column names". The other two Canvas
    inventory pages use the same column.
  - Under `examples/basic/specs/design/canvas/`, `CanvasShell` has 34 uses in
    32 files, and `VariantSetArtboard` has 8 uses in 6 files.
  - Fourteen of these uses pass no `sheet`: thirteen outside the stories
    folder, and the failed story comparison at `stories/failed.tsx:64`.
  - Six more pass `undefined` on one branch of a condition, as in
    `sheet={mode === "current" ? "panel" : undefined}`.
  - The phone lists of `tests/fixtures/design/adoption.json` name the views
    whose phone draws the panel sheet, as the part `panels/floating-panel`
    does. The adoption check requires each listed view to draw it. It does
    not catch a view that the list leaves out.
  - A desktop render ignores `sheet`. `CanvasShell` is compact only in a
    mobile render, at `shell.tsx:151`, so a desktop render draws both panels
    as floating panels, without `data-sheet`.
  - Below the breakpoint, `design-canvas-compact.css:7-10` hides each
    floating panel without `data-sheet`, and `:26-37` shows the dock while no
    sheet is open. So a narrow desktop document shows the stage and the dock,
    and never the sheet that its state specifies.
  - The Canvas inventory says that a desktop render turns compact below the
    breakpoint, at `docs/protocol/mokly-shell-canvas-inventory.md:102-103`.
    The Phone sheet column names only the sheet of the mobile render. The
    compact layout of `docs/protocol/mokly-shell-device-chrome.md` says that
    the floating panels close below the breakpoint.
  - The sheet form of a floating panel adds `data-sheet`, a grabber, and a
    close control named `Close catalogue` or `Close panel`, in
    `floating-panel.view.tsx:45-63`.
  - A design link opens its target in the same viewport, as
    `docs/protocol/mokly-design-links.md:43-46` says. So a dock link in a
    desktop document opens a desktop document.
- **Problem:** A compact form can drop the sheet that its state specifies,
  and nothing tells the author:
  - In a mobile render, the default of `sheet` hides the panel. The three
    Inspect views of the Storybook stories passed Inspect without a sheet. So
    their phone documents held neither the Story row nor a way to see it. The
    branch fixed these three views on 2026-11-25. Any other artboard can drop
    its panel in the same way.
  - In a desktop render below the breakpoint, the shell ignores `sheet` and
    hides both panels. The dock's Inspect of the three story Inspect states
    linked to their own artboard. So in a narrow window it reopened the same
    document with the panel hidden. The branch removed those three links on
    2026-11-25.
- **Screenshot:** The finding of round 1 asked for a picture of Link to
  Storybook and Added story on mobile. It boxes the Inspect control of the
  dock above the empty sheet area. No picture was saved. Before the direct
  fix, both phone views showed the stage and the dock, with no sheet. The
  finding of round 2 asked for a picture of the desktop Link to Storybook
  view at 800 px after a press on Inspect. It boxes the dock, which stays
  while Details stays hidden. No picture was saved.
- **Impact if no action:** A new phone mockup can lose the panel content that
  its state specifies, and a phone reviewer cannot check that content. A
  reader of a narrow desktop document never sees that content, and a dock
  link there can promise a sheet that no desktop document shows.
- **Root question:** How does each Canvas artboard show, in its compact form,
  the sheet that its state specifies, so that no panel drops without notice?
- **Options:** The letters follow the options of the review findings and of
  their finding checks on the source branch. A, B, and C fixed the three
  story views in round 1. The branch applied B:
  `StoryInspectArtboard` in
  `examples/basic/specs/design/canvas/stories/parts/artboard.tsx` opens the
  panel sheet at Inspect for each story state. The branch also added the
  three views to the phone lists of the adoption fixture. F is the wider fix
  B of round 2, for the narrow desktop window.
  - **D.** Add a family `^design/canvas/stories/` to
    `tests/fixtures/design/adoption.json`. Give it a mobile
    `inspector/metadata-row` part that leaves out
    `design/canvas/stories/failed/changes`. The adoption check then fails for
    a new story page whose phone omits Details. D covers the stories only. It
    makes a gate check stricter, so the user must approve it. Effort: Small.
  - **E.** Make the phone sheet a required prop of `CanvasShell` and
    `VariantSetArtboard`, with an explicit `"none"`. Effort: Medium.
    - Type the prop as `"catalogue"`, `"panel"`, or `"none"`, with no
      default. The typecheck then names every use that states no sheet.
    - Give `"none"` to the fourteen uses that pass no sheet. Replace each
      `undefined` branch of a condition with `"none"`.
    - Give the same required prop to the three wrappers with an optional
      sheet:
      - `PreviousArtboard` in `outcomes/parts/removed_artboard.tsx`
      - the Side by side screen of `components/affected.tsx`
      - the tour artboard of `flows/tour.tsx`, whose prop is a boolean today
    - The generated views do not change. Compare a build before and after
      the change.
    - Check each value against the Phone sheet column of its entry. A wrong
      explicit value still passes the typecheck.
  - **F.** Let the shared shell honour the authored sheet in every compact
    form, for the catalogue sheet as well as the panel sheet. Effort: Medium.
    - Draw each panel once, in a desktop render too. Mark the panel that the
      state names as its sheet, so that the compact rules show it as a sheet
      below the breakpoint. Draw its grabber and its close control there, and
      hide them in the wide layout.
    - A narrow desktop document then shows the same sheet as the mobile
      render, and the dock hides there. A dock link to an artboard with a
      sheet, such as `design/canvas/stage/catalogue`, then shows that sheet in
      the same viewport.
    - F changes what a desktop render shows below the breakpoint. The Phone
      sheet column then names the sheet of the compact form in both renders,
      so `docs/protocol/mokly-shell-canvas-inventory.md:22-25` and `:102-110`
      change. No requirement covers a sheet in a desktop render today, so F
      needs the user's decision.
    - F fits with E: E states the sheet of each artboard, and F shows it in
      both renders.
- **Left out:**
  - Moving the Details rows onto the canvas: the compact layout gives the
    entry bar only the title, the kind, the status, and the frame picker.
  - A default that opens the panel sheet: it changes the phone views that
    keep the stage on purpose. The default can follow a passed panel or each
    frame selection. Examples of such views are
    `design/canvas/components/removed` and the compare modes of the Changes
    tab.
  - A family rule in the Canvas inventory: the Phone sheet column already
    gives the rule, and a sentence checks nothing.
  - A link from the dock of a desktop document to the mobile document: a
    design link opens its target in the same viewport.
- **Wider fix:** E for the mobile render. F extends the same rule to a
  desktop render, after the user's decision. D only detects the case, and
  only for the stories.
- **Previous examples:** None found before commit `54e0a948e`, which drew the
  three story Inspect views without a sheet. That commit also linked their
  dock's Inspect to their own artboards. Sixteen older states link the dock's
  tab to their own artboard too, as
  [canvas-narrow-desktop-dock-links.md](canvas-narrow-desktop-dock-links.md)
  records.
- **Related:** [canvas-narrow-desktop-dock-links.md](canvas-narrow-desktop-dock-links.md)
  records the dock links of narrow desktop documents. Its option B is F of
  this item. Its recommended D draws those links as pictures in a desktop
  render, and F would make them open documents that show the sheet. So F
  replaces D. If F lands first, its branch also closes that item. If D lands
  first, the branch of F restores the desktop links that D removes.
- **Recommendation:** E. Each artboard then states its phone sheet in the
  code, so a dropped panel shows in the typecheck and in review. F best
  serves a reader of a narrow desktop document, but it needs the user's
  decision.
- **Action:** fix after merge, apply E, because E changes two shared
  scaffolds and their uses across the Canvas folders.
