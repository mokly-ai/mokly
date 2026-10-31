# Shell rules guard generic class names

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-layout-theme`, during the theme milestone of the shell views plan.
- **Location:** The 77 selectors with `:where(.mbk-reset)` in `packages/ui/src/browser-bar/browser-bar.css`, `packages/ui/src/device-frame/device-frame.css`, `packages/ui/src/catalogue-tree/catalogue-tree.css`, `packages/ui/src/comparison-pane/comparison-pane.css`, `packages/ui/src/comparison-stage/comparison-stage.css`, `packages/ui/src/flow-step/flow-step.css`, and `packages/ui/src/preview-frame/preview-frame.css`, and the components that render these classes.
- **Reason:** The rename changes the shell's class names, which the browser specs, the tests, and the design mockups read, and the theme milestone kept every class name.

- **Terms:**
  - **Reset class:** `mbk-reset`, which each `@mokly/ui` component puts on
    every element that it renders, apart from host slots. It gives border-box
    sizing and the reader's reduced motion.
  - **Generic class name:** a shell class without the `mbk-` or `mokly-`
    prefix, such as `address`, `browser-frame`, `phone-frame`, `flow-step`,
    `lights`, `i-expand`, or `mb-pane`.
  - **Host slot:** an element with `data-mokly-slot` in an embedded viewer
    root. The host page owns its content.
- **Background:**
  - The user chose on 2026-10-30 that the shell's theme sits on the shell
    root class `mbk`, that each component uses the reset class, and that the
    embedded stylesheet drops its
    `@scope (.mokly-viewer) to ([data-mokly-slot])` wrapper.
  - Without the wrapper, a rule such as `.address { … }` also styles a host
    page element with the class `address`.
  - The theme milestone therefore wrote each selector that names only
    generic classes with the guard `:where(.mbk-reset)`, for example
    `.address:where(.mbk-reset)`. The guard adds no specificity, and a host
    element does not carry `mbk-reset`.
  - `pageRuleFailures` in `packages/viewer/tests/style_rules.ts` fails the
    viewer styles test for each package selector that names no `mbk` or
    `mokly` class, so an unguarded generic rule cannot ship.
  - 34 generic class names carry the guard. About 51 test, spec, and mockup
    files under `tests/`, `packages/viewer/tests`, `packages/ui/tests`, and
    `examples/basic` read some of them.
- **Problem:** Each new rule on a generic class must remember the guard, and
  the guard makes 77 selectors longer and harder to read. The names also do
  not show that they belong to the shell.
- **Impact if no action:** Nothing breaks. Each new rule repeats the guard,
  and the test stops a rule that forgets it.
- **Root question:** How do the shell's class names stay apart from a host
  page's class names?
- **Options:**
  - **A.** Keep the generic names and the `:where(.mbk-reset)` guard.
    Effort: Small.
  - **B.** Rename each generic class to an `mbk-` name, such as
    `mbk-address`, in the components, the stylesheets, the tests, the
    browser specs, and the design mockups, and drop the guard. Effort:
    Large.
- **Left out:** Restoring the `@scope` wrapper, because the user dropped it
  on 2026-10-30, and Firefox drew no `::placeholder` rule inside it. CSS
  modules or hashed names, because hosts and tests read the class names.
- **Wider fix:** B. One prefix marks every shell class, so no rule needs a
  guard.
- **Previous examples:** None found.
- **Recommendation:** B. The names then explain their owner, and new rules
  need no guard.
- **Answer:** On 2026-10-31 the user chose B.
- **Action:** fix after merge, apply B, because the rename touches the
  components, tests, browser specs, and mockups of every slice, and the user
  called this work a follow-up of the shell views stack.
