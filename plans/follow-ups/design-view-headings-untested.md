# No design case checks the view headings of the Changes mockups

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- **Location:**
  - `examples/basic/specs/design/canvas/parts/frame_outcomes.ts`: builds the
    view heading lines of the Changes mockups from the frames on the stage.
  - `tests/browser/design_reasons.spec.ts`: the design cases that read the
    comparison details of the Canvas mockups by route and viewport.
  - `docs/protocol/mokly-css-evidence-presentation.md:48-55`: the view heading
    rule.
- **Reason:** Milestone 12 added the headings to the mockups at its end, and
  its brief kept the change to the existing design cases.

- **Source:** Implementation.
- **Category:** Test.

- **Terms:**
  - **View heading:** one line of the Changes tab's comparison details for
    each compared frame of a loaded comparison, such as "Desktop · Light ·
    Screen changed".
  - **Design case:** a browser check that opens a design mockup and reads what
    it draws.
- **Background:** The shipped viewer draws one view heading for each compared
  frame. Commit `1d7cec76f` made the Canvas mockups with a loaded comparison
  draw the same lines with the product's `ComparisonEvidence`. A desktop
  render lists every compared frame, and a phone render with its Changes sheet
  open lists the picked frame.
- **Problem:** No design case reads the headings. A later change to
  `frame_outcomes.ts` or to the evidence parts can drop or change them, and no
  test fails.
- **Impact if no action:** The mockups can drift from the product again
  without a failing check.
- **Root question:** Which test pins the headings that each mockup draws?
- **Options:**
  - **A.** Add the expected heading lines for each route and viewport to
    `tests/browser/design_reasons.spec.ts`, next to its reasons. Effort:
    Small.
  - **B.** Add a unit test of `frame_outcomes.ts` alone. It checks the builder
    but not what each artboard passes to it. Effort: Small.
- **Left out:** A screenshot comparison, because the repository has no visual
  snapshot suite for the mockups.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. It checks the drawn text of each artboard, where a
  drift shows.
- **Action:** fix after merge, apply A, because the mockups are correct today.
