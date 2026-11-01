# No check that elements carry the reset class

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-layout-theme`, during the theme milestone of the shell views plan.
- **Location:** `packages/ui/src`, every component `.tsx` file; `packages/ui/src/reset/reset.css`.
- **Reason:** A check for a whole class of defects needs the user's approval, and no element lacks the class today.

- **Terms:**
  - **Reset class:** `mbk-reset`, defined in
    `packages/ui/src/reset/reset.css`. Its rules give the element border-box
    sizing, the reader's reduced motion, an inherited link colour, and no
    top margin on headings and paragraphs.
  - **Host slot:** an element with `data-mokly-slot` in an embedded viewer
    root. The host page owns its content, so it never gets the class.
- **Background:**
  - The user chose on 2026-10-30 that each `@mokly/ui` component uses a
    reset class, as Radix Themes uses `rt-reset`.
  - The theme milestone put box sizing and reduced motion in the reset
    class. So every element and every `<svg>` that a package component
    renders carries `mbk-reset`, last in its class list. An SVG's shapes
    take the reset through their `<svg>`.
  - On 2026-10-30, a computed-style comparison of 154 shell states found no
    package element without the class.
  - No test or lint checks the class. Testing Library tests under
    `packages/ui/tests` render each component.
- **Problem:** A new element without `mbk-reset` gets content-box sizing and
  ignores the reader's reduced-motion setting. Nothing reports it.
- **Impact if no action:** A future element can be a few pixels wider than
  its design, or animate for a reader who asked for reduced motion, until a
  person notices.
- **Root question:** How does every element of a package component get the
  reset?
- **Options:**
  - **A.** No check. Reviews catch a missing class. Effort: Small.
  - **B.** A helper in the package tests: each component test that renders
    a component also asserts that every element outside a host slot carries
    `mbk-reset`. Effort: Small.
  - **C.** A local ESLint rule for `packages/ui/src` that rejects an
    intrinsic JSX element whose literal `className` lacks `mbk-reset`.
    Effort: Medium.
- **Left out:** Moving box sizing back into each component's rules, because
  the theme milestone chose the reset class so that one rule serves every
  element. A descendant rule from the shell root, because without `@scope` it
  would also reach host slot content.
- **Wider fix:** C. The lint stops the defect where the code is written.
- **Previous examples:** None found.
- **Recommendation:** B. It reuses the component tests and checks the
  rendered result, also for a class name that the code builds at run time.
- **Answer:** On 2026-10-31 the user chose B.
- **Action:** fix after merge, apply B, because the user called this work a
  follow-up of the shell views stack.
