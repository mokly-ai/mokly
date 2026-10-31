# Package pictures look like working controls

- **Severity:** Low. **Likelihood:** Common. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, review finding 4 and two problems outside its scope.
- **Location:** `packages/ui/src/catalogue-tree/catalogue-tree.css:51` and `:65`, which style the tree row picture of `packages/ui/src/catalogue-tree/tree-link.tsx`; `packages/ui/src/catalogue-navigation/catalogue-navigation.css:213` and `:237`, which style the separator picture of `packages/ui/src/catalogue-navigation/navigation-resize.tsx`; `packages/ui/src/icon-control/icon-control.css:22` and `:61`.
- **Reason:** The shared rule changes every picture form of the package, which is Large, and the user must accept that a picture loses its tooltip.

- **Terms:**
  - **Static depiction:** a page that draws the shell without running a
    script, such as an artboard of the design catalogue under
    `examples/basic/specs/design`.
  - **Picture form:** the element that a `@mokly/ui` component draws for a
    control in a static depiction when the control has no address: usually a
    `span`, often with `role="img"`. It looks like the control and does
    nothing.
  - **Action feedback:** the pointer cursor, the hover fill, and the press
    style that tell a reader that an element acts.
- **Background:**
  - Each package control that a static depiction draws has a link form for
    an address and a picture form without one. Examples are the top bar's
    menu and brand, the screen header's path chip, the tag chip, the tag
    button, the navigation filter options, Collapse all, the tree rows, and
    the navigation separator.
  - Each control's stylesheet gives its class the action feedback, so the
    picture form gets it too unless a rule limits the feedback to links and
    buttons.
  - The class has been fixed one picture at a time. Commit `e4c6d2c8` and
    commit `14c6f9ec` gave five pictures, such as `span.mbk-menu` and
    `span.mbk-pathchip`, the default cursor. On 2026-10-30 the branch
    `calummoore/mokly-ui-controls` limited the tag chip's and the tag
    button's pointer and hover fill to `:is(a, button)`.
  - Chrome confirms two pictures that still act like controls:
    - The tree row picture, drawn for a row without an address, takes
      `cursor: pointer` and the accent hover fill from `.mbk-nav-row`.
    - The separator picture, drawn when the navigation column is not
      operable, takes `cursor: col-resize` and the hover glow from
      `.mbk-nav-resize`. Artboards show it through
      `examples/basic/design-library/chrome/catalogue-navigation.css:13`.
  - `.mbk-icon-button` gives every element form the pointer and a hover fill.
    A future picture of an icon control would inherit them.
  - The explorer's depicted resize grip already leaves hit testing with
    `pointer-events: none`, in `examples/basic/design-component-workspace.css:77`.
- **Problem:** A picture that does nothing shows the pointer and a hover
  fill, so a reader expects it to act. Each new picture form repeats the
  defect unless its author remembers a per-control rule.
- **Impact if no action:** Readers of the design catalogue and other static
  hosts get false action feedback from the tree rows and the separator, and
  later pictures repeat it.
- **Root question:** How does every picture form of the package show that
  it does not act?
- **Options:**
  - **A.** Fix the two remaining pictures one at a time: give the pointer
    and the hover rules of `.mbk-nav-row` and `.mbk-nav-resize` only to their
    link and handle forms. Effort: Small.
  - **B.** One shared picture rule: every picture form carries one package
    marker, such as the class `mbk-picture`, whose rule sets
    `pointer-events: none` and `cursor: default`. No hover or press rule then
    reaches a picture. A picture loses its `title` tooltip, such as the
    Refresh picture of `packages/ui/src/comparison-toolbar/comparison-toolbar.tsx:36`.
    Effort: Large.
- **Left out:** A disabled button for each picture, because Chrome still draws
  the pointer and the hover fill on it with these sheets, and it tells a
  screen reader that the control is unavailable. A marker that sets only the
  cursor, because it cannot undo each control's own hover fill. A test or a
  lint for the class, because B removes the cause.
- **Wider fix:** B.
- **Previous examples:** Commits `e4c6d2c8` and `14c6f9ec`, and the tag chip
  and tag button fixes of 2026-10-30.
- **Recommendation:** B. One rule then covers every picture, also the ones
  that later components add.
- **Answer:** On 2026-10-31 the user chose B.
- **Action:** fix after merge, apply B, because the marker spans every
  picture form of the shell views stack, which lands in five pull requests.
