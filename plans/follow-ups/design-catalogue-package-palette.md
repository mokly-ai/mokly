# Design catalogue repeats the package palette

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-10-31, from the branch `calummoore/mokly-ui-layout-theme`, an unchecked post-merge task of the shell views plan, which its last pull request deletes.
- **Location:** `examples/basic/design.css`, the `:root`, `[data-mbk-light-only]`, and `[data-mbk-appearance]` palette blocks, about 105 token declarations; `packages/ui/src/theme/theme.css`, the shipped palette.

- **Terms:**
  - **Design catalogue:** the static mockups of the Browse shell under
    `examples/basic/specs/design`, with their stylesheets
    `examples/basic/design*.css`.
  - **Package theme:** `packages/ui/src/theme/theme.css`, which declares the
    shell's tokens and its Light and Dark palette on the shell root class
    `mbk` and the stub document class `mbk-document`.
- **Background:**
  - Since 2026-10-31, `examples/basic/design.css` imports the package theme
    and the reset stylesheet first, and each artboard root carries the `mbk`
    class and `data-mokly-theme`, so the package components on an artboard
    draw in the shipped palette.
  - `design.css` still declares the same `--chrome-*`, `--mbk-*`, and
    `--mokly-*` tokens again on `:root` and on its own appearance marks, for
    the artboards' own parts, such as the explorer's canvases and captions.
  - `docs/protocol/mokly-viewer-palette.md` names the shipped palette.
    `tests/design_appearance.test.ts` and `tests/design_boundaries.test.ts`
    read both palette sources.
- **Task:** Let the design catalogue's own parts read the package theme in
  place of the repeated palette: give each artboard part a root that the
  theme reads, or move each design-only token into a small design sheet.
  Then delete the repeated declarations from `design.css`, and make the two
  design tests read one palette source.
- **Impact if no action:** A palette change in the package must also change
  `design.css`, or the artboards' own parts drift from the shipped colours.
- **Needs:** Nothing.
- **Done when:** `examples/basic/design.css` declares no token that the
  package theme declares, and the design tests read the palette from the
  package theme alone.
