# Phone artboards drop a panel without notice

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 2. It is the wider fix E of the finding check, which the branch
  split off its direct fix.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/shell.tsx:48-49`, the optional
    `sheet` prop of `CanvasShell`, and `:179-197`, where a phone render draws
    the catalogue or the right panel only for the named sheet.
  - `examples/basic/specs/design/canvas/parts/set_stage.tsx:63`, the optional
    `sheet` prop of `VariantSetArtboard`.
  - The wrappers with an optional sheet of their own:
    `examples/basic/specs/design/canvas/outcomes/parts/removed_artboard.tsx:28`,
    `examples/basic/specs/design/canvas/components/affected.tsx:67`, and
    `examples/basic/specs/design/canvas/flows/tour.tsx:33`.
  - Every use of `CanvasShell` and `VariantSetArtboard` under
    `examples/basic/specs/design/canvas/`.
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
- **Problem:** The default of `sheet` hides the panel on a phone without
  notice. The three Inspect views of the Storybook stories passed Inspect
  without a sheet. So their phone documents held neither the Story row nor a
  way to see it. The branch fixed these three views on 2026-11-25. Any other
  artboard can drop its panel in the same way.
- **Screenshot:** The finding asked for a picture of Link to Storybook and
  Added story on mobile. It boxes the Inspect control of the dock above the
  empty sheet area. No picture was saved. Before the direct fix, both phone
  views showed the stage and the dock, with no sheet.
- **Impact if no action:** A new phone mockup can lose the panel content that
  its state specifies, and a phone reviewer cannot check that content.
- **Root question:** How does each Canvas artboard show on a phone the sheet
  that its state specifies, so that no panel drops without notice?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. A, B, and C fixed the three story
  views. The branch applied B: `StoryInspectArtboard` in
  `examples/basic/specs/design/canvas/stories/parts/artboard.tsx` opens the
  panel sheet at Inspect for each story state. The branch also added the
  three views to the phone lists of the adoption fixture.
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
- **Wider fix:** E. D only detects the case, and only for the stories.
- **Previous examples:** None found before commit `54e0a948e`, which drew the
  three story Inspect views without a sheet.
- **Recommendation:** E. Each artboard then states its phone sheet in the
  code, so a dropped panel shows in the typecheck and in review.
- **Action:** fix after merge, apply E, because E changes two shared
  scaffolds and their uses across the Canvas folders.
