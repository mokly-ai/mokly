# The search field shows no focus ring

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-component-migration`, during the chrome mockup adoption of the shell views plan.
- **Location:** `packages/ui/src/top-bar/top-bar.css`, the rule that sets `outline: none` on the search field.
- **Reason:** The user chose on 2026-10-30 to keep the shipped look in that plan, and the missing ring is older than the plan.

- **Terms:**
  - **Top bar:** the 48px header of the Browse shell, drawn by
    `@mokly/ui/top-bar`, with the catalogue search field.
- **Background:**
  - The search field's stylesheet sets `outline: none` and adds no other
    focus style.
  - The other chrome controls show the browser's default focus ring.
  - On 2026-10-30, the design mockups started to render the shipped top bar.
    The user then chose to keep the shipped look for every visible
    difference, including this one.
- **Problem:** When the search field has keyboard focus, only the text caret
  shows it.
- **Impact if no action:** Keyboard users can hardly see focus on the search
  field, which works against the visible focus rule of WCAG 2.4.7.
- **Root question:** How does the search field show keyboard focus?
- **Options:**
  - **A.** Keep the shipped focus style. Effort: Small.
  - **B.** The search field gets a visible focus ring, such as the 2px
    `--mbk-accent-deep` outline of the appearance selector. Effort: Small.
  - **C.** B, plus a 2px ring on the chrome's links and buttons. Effort:
    Small.
- **Left out:** Removing the field from the tab order, because that hides a
  control from keyboard users.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Recommendation:** B. One rule restores a visible focus indicator.
- **Action:** ask the user, because condition 1 holds: B changes the shipped
  look, which the user chose to keep on 2026-10-30.
