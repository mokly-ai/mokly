# Shell controls lack a consistent focus ring

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-component-migration`, during the chrome mockup adoption of the shell views plan. Broadened on 2026-10-30, from the branch `calummoore/mokly-ui-controls`, during the control mockup adoption.
- **Location:** `packages/ui/src/top-bar/top-bar.css`, the rule that sets `outline: none` on the search field. `packages/ui/src/tag-chip/tag-chip.css` and `packages/ui/src/tag-picker/tag-picker.css`, which give the tag chips and the tag button no focus rule. `packages/ui/src/icon-control/icon-control.css`, the focus rule of the view controls and the inspector tabs.
- **Reason:** The user chose on 2026-10-30 to keep the shipped look in that plan, and these focus styles are older than the plan.

- **Terms:**
  - **Top bar:** the 48px header of the Browse shell, drawn by
    `@mokly/ui/top-bar`, with the catalogue search field.
  - **Tag picker:** the tag button at the end of the search field and its
    panel of tag chips, drawn by `@mokly/ui/tag-picker` and
    `@mokly/ui/tag-chip`.
  - **View controls:** the icon group in a screen header, drawn by
    `@mokly/ui/view-controls`: the viewport select and the Dark preview and
    Highlight components toggles. The inspector tabs share their icon control
    look, from `@mokly/ui/icon-control`.
- **Background:**
  - The search field's stylesheet sets `outline: none` and adds no other
    focus style.
  - The tag chips and the tag button have no focus rule, so they show the
    browser's default focus ring. Chrome draws it as a thin dark ring.
  - The links and buttons of the top bar, the screen header and the
    segmented control have no focus rule either, so they show the same
    default ring.
  - The view controls and the inspector tabs draw a 2px ring in the accent,
    `--mokly-accent`, 2px outside the control. A host can replace that token
    with its own accent.
  - The appearance selector draws a 2px ring in the deep accent,
    `--mbk-accent-deep`.
  - `docs/protocol/mokly-viewer-palette.md` says that every focus ring uses
    `--chrome-control-edge` or `--mbk-sage-deep`, the deep accent of the
    design palette.
  - On 2026-10-30, the design mockups started to render the shipped top bar,
    and then the shipped tag picker, tag chip and view controls. Their own
    copies had drawn 2px rings on these controls. The user then chose to keep
    the shipped look for every visible difference, including these focus
    styles.
- **Problem:** When the search field has keyboard focus, only the text caret
  shows it. The tag chips and the tag button show only the browser's default
  ring. The view controls show the accent ring, so the chrome draws three
  focus styles, and only the appearance selector's ring follows the palette
  contract.
- **Impact if no action:** Keyboard users can hardly see focus on the search
  field, which works against the visible focus rule of WCAG 2.4.7. The other
  controls show focus in different styles, and a host accent with low contrast
  weakens the ring of the view controls.
- **Root question:** How does each chrome control show keyboard focus?
- **Options:**
  - **A.** Keep the shipped focus styles. Effort: Small.
  - **B.** The search field gets a visible focus ring, such as the 2px
    `--mbk-accent-deep` outline of the appearance selector. Effort: Small.
  - **C.** B, plus the same 2px ring on the chrome's links and buttons,
    including the tag chips, the tag button and the view controls. Effort:
    Small.
- **Left out:** Removing the field from the tab order, because that hides a
  control from keyboard users.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Recommendation:** B. One rule restores a visible focus indicator.
- **Answer:** On 2026-10-31 the user chose B.
- **Action:** fix after merge, apply B, because the user called this work a
  follow-up of the shell views stack.
