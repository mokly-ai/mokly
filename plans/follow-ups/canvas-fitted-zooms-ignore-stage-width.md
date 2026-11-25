# Canvas fitted zooms ignore the stage width

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 2,
  finding 7. Its finding check moved the finding outside the review scope,
  because every fitted Canvas artboard has the problem.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/sketches.tsx:15-31`, `FITS`,
    and `:33-54`, `SetFit` and `SET_FITS`, whose comment names the stage of
    a 1440 × 900 window.
  - `examples/basic/specs/design/canvas/components/parts/sketches.tsx:22-32`,
    `PAIR_FITS`.
  - `examples/basic/specs/design/canvas/stories/parts/sketches.tsx:31-38`,
    `MENU_FITS`, and
    `examples/basic/specs/design/canvas/outcomes/parts/invoice.tsx:23`,
    `INVOICE_FIT`.
  - `examples/basic/specs/design/canvas/parts/stage.tsx:224` and `:273`,
    where `CanvasStage` sets the tags rule and the frame scale from its
    `zoom`.
  - `examples/basic/specs/design/canvas/parts/frames.tsx:51-66`, `TAG_ZOOM`
    and `stageTags`, which hide the tags of the frames below 60%.
  - `examples/basic/specs/design/canvas/parts/shell.tsx:167-178`, where
    `CanvasShell` prints its own `zoom` in the zoom pill.
  - `examples/basic/design-canvas-shell.css:42-51` and `:140-158`, the stage
    between the panels.
  - `docs/protocol/mokly-shell-canvas-stage.md:115-133`, the section "Pan,
    Zoom And Fit".
- **Reason:** The fix reaches the shared stage and every fitted artboard of
  the Canvas family, not only the Storybook mockups that the branch draws.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Canvas family:** the design mockups of the Canvas viewer, authored
    under `examples/basic/specs/design/canvas/`, whose entry paths start with
    `design/canvas/`.
  - **Stage:** the part of the canvas between the floating catalogue and the
    right panel, above the zoom pill.
  - **Section:** the box of the selected entry on the stage. It holds the
    frames, the gaps between them, and 22 px of padding at each side.
  - **Fitted zoom:** the largest zoom, up to 100%, at which every shown frame
    and its label fit the stage. An artboard draws its section at that zoom,
    as after Fit.
  - **Frame tags:** the labels on a frame that keep their size at every zoom,
    such as a highlight's labels and a selection's name and size tags. The
    tags rule hides them below 60%.
- **Background:**
  - The stage contract, section "Pan, Zoom And Fit" of
    `docs/protocol/mokly-shell-canvas-stage.md`, says that an entry opens
    fitted. While the stage stays fitted, it refits when the stage changes
    size.
  - A Canvas artboard is a static document, and a design document carries no
    scripts. Each artboard takes its zoom from a constant: `FITS`,
    `SET_FITS`, `PAIR_FITS`, `MENU_FITS`, or `INVOICE_FIT`.
  - The artboard passes the same constant to `CanvasStage`, which scales the
    frames and sets the tags rule, and to `CanvasShell`, which prints it in
    the zoom pill.
  - Each constant fits the stage of a 1440 × 900 window. The comment of
    `SetFit` says so: the largest zoom up to 100% that keeps the set at least
    10 px inside the stage. Commit `6d4f4f6cf`, the Canvas redesign of
    2026-11-24, added the constants.
  - The stage is the window width less the panels: 860 px at 1440 px, 700 px
    at 1280 px, and 500 px at 1024 px. Below 1180 px the panels narrow to
    224 px and 284 px. Below 900 px the compact form replaces them.
  - The stage centres the section, and the panels float over the part that
    overflows. So each panel covers the outer frame on its side by the
    overflow less the 22 px padding.
  - The Mokly viewer draws each desktop document in a 1280 × 800 frame, as
    `DESKTOP_FRAME_SIZE` in
    `packages/viewer/src/shell/canvas_frame_size.ts:18-21` gives it. A reader
    who opens a document in a browser window gets the width of that window.
  - On 2026-11-25, a run of the build of 2026-11-24 in Chromium measured how
    much of each outer frame the panels cover, at each side of the section.
    The values follow from the frame sizes, the gaps of 40 px and 44 px, and
    the padding. At 1440 px no panel covers a frame.

    | Artboard                                                                                       | Zoom | Frame width       | At 1280 px | At 1024 px |
    | ---------------------------------------------------------------------------------------------- | ---- | ----------------- | ---------- | ---------- |
    | `design/canvas/stage/component-set/toolbar`, the four Toolbar frames                           | 94%  | 377 px            | 47 px      | 147 px     |
    | `design/canvas/components/affected` and `design/canvas/changes/side-by-side`, the Desktop pair | 29%  | 371 px            | 43 px      | 143 px     |
    | `design/canvas/stories/failed/changes`, the Expanded pair                                      | 100% | 360 px            | 30 px      | 130 px     |
    | `design/canvas/stage/document`, the Payment terms reading frame                                | 100% | 760 px            | 30 px      | 130 px     |
    | `design/canvas/inspect/unchanged`, Profile's Desktop and Mobile frames                         | 42%  | 538 px and 164 px | 23 px      | 123 px     |
    | `design/canvas/overview`, Welcome's Desktop and Mobile frames                                  | 38%  | 486 px and 148 px | 0 px       | 89 px      |
    | `design/canvas/stage/component-set`, the Action's set                                          | 100% | 141 px to 234 px  | 0 px       | 4 px       |

  - The browser case "both artboards fit their viewport's width" in
    `tests/browser/component_design_cases.ts:53-71` opens each desktop
    document at 1440 × 1000 only. It checks the document width, which cannot
    show a frame under a panel, because the canvas clips its overflow.
- **Problem:** Every fitted zoom fits a 1440 px window only. In a narrower
  desktop window, and in the viewer's own 1280 × 800 frame, the panels cover
  the outer frames of the wider sections. Fit opens the same artboard, so it
  shows the same zoom.
- **Screenshot:** The source finding asked for a picture of the desktop
  Failed story in Changes at 1024 × 800, with boxes where the panels cover
  Before and Current. No picture was saved. At that width, the catalogue
  covers the left 130 px of Before, and the right panel covers the right
  130 px of Current.
- **Impact if no action:** In the viewer, the panels hide the outer edges of
  the six measured artboards and of the others that share their zooms. In a
  1024 px window, a reader loses up to three quarters of a frame, such as
  Profile's Mobile frame. The mockups then depict a Fit that the product does
  not have.
- **Root question:** How does each fitted Canvas artboard keep every shown
  frame inside the stage at every desktop width, as the product's Fit does?
- **Options:** The letters follow the options of the review finding on the
  source branch, which named the Storybook views alone.
  - **A.** Give each fitted artboard a zoom for each range of window widths,
    such as 1440 px and up, 1180 px to 1439 px, and 900 px to 1179 px. The
    frames, the zoom pill, and the tags rule use the zoom of the range. Each
    range leaves spare space above its narrowest width, and each new artboard
    repeats the work. Effort: Large.
  - **B.** Let the shared stage derive the fitted zoom from the stage width,
    the frame sizes, the gaps, and the padding. Effort: Large.
    - `CanvasStage` knows the size and the kind of each frame, so it can
      compute the width and the height of the section at 100%. The gaps and
      the padding keep their size at every zoom.
    - The document has no scripts, so the zoom must come from CSS. The stage
      can compute one zoom for each step of a fixed list of window widths,
      and a container query then picks the zoom of the step. This works in
      every browser. The zoom pill and the tags rule then take one value for
      each step, and each step leaves some spare space.
    - Or CSS computes the exact zoom from the stage width. An example is
      `min(1, calc((100cqw - 104px) / 720px))` for the Expanded pair, where
      `100cqw` is the stage width. The 720 px are the two frames at 100%. The
      104 px are the 40 px gap, the 44 px of padding, and a 20 px margin.
    - On 2026-11-25, Chromium 149 of the browser checks computed such a zoom
      in a probe. Other browsers were not checked. The zoom pill can then
      print the zoom only through a CSS counter.
    - Keep each constant as the zoom of a 1440 px window, so that a browser
      without the CSS keeps the view of today.
    - Check every fitted artboard at 1440, 1280, 1024, and 900 px.
- **Left out:**
  - C of the source finding, full-size frames in a scrollable area between
    the panels: the entry then opens at 100%, not fitted, against the stage
    contract that the mockups depict.
  - Fitting every constant to the 700 px stage of the viewer's 1280 × 800
    frame: below 1280 px the panels still cover frames. It can serve as a
    first step at Medium effort.
  - A check of the document width alone: the canvas clips its overflow, so
    the check cannot see a frame under a panel.
  - Change nothing: the viewer's own frame shows covered frames.
- **Wider fix:** B. One computation in the shared stage fits every artboard,
  so a new artboard needs no zoom of its own.
- **Previous examples:** Every fitted artboard since commit `6d4f4f6cf`.
  Commit `477767fc8` checked a narrow stage by the bounds of the stage and
  its frames, for another layout rule.
- **Recommendation:** B. The shared stage then fits each artboard at the
  width of the reader's window, as the product does.
- **Action:** fix after merge, apply B, because B changes the shared stage
  and every fitted artboard of the Canvas family.
