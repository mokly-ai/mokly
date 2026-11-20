# Drag area list has four copies

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-18, from branch `calummoore/mac-title-bar-integration`, the Mac window plan's covered drag area work.
- **Location:** `docs/mockups/styles/product/shared.css` (the drag rule, the opt-out rule and the covered rule) and `dragAreas` in `packages/app/src/layout/drag-covers.ts`.
- **Reason:** One marker class reaches the app's bar components and the catalogue's drawings, which the covered drag area work did not change.

- **Terms:**
  - **Drag area:** a part of the page that moves the Mac app's window, which has no title bar. A shared CSS rule gives it `-webkit-app-region: drag`.
  - **Covered check:** the app's check in `packages/app/src/layout/drag-covers.ts`, which turns off the drag of an area that a viewer package surface or a skip link covers.
- **Background:** Six classes are drag areas: `.fo-package-slot`, `.fo-top-bar`, `.fo-stage-bar`, `.fo-account-header`, `.fo-layer-bar` and `.fo-window-band`. The list appears in three rules of `docs/mockups/styles/product/shared.css` and once in the covered check. Only a rule in `packages/app/README.md` keeps the four lists the same.
- **Problem:** A new drag area that joins the CSS rules but not the covered check moves the window, but it never turns off under a cover. Nothing fails when the lists differ.
- **Impact if no action:** A later top bar can lose presses under a viewer surface or a skip link in the Mac app, and only a test on a Mac shows it.
- **Root question:** How do the stylesheet and the covered check always agree on which parts move the window?
- **Options:**
  - **A.** Keep the README rule. Effort: Small.
  - **B.** Add a logic test that compares the classes of the drag rule with the check's list. A new check needs the user's approval. Effort: Small.
  - **C.** Give every drag area one cloud marker class, and let the three rules and the check select only that class. Effort: Medium.
- **Left out:** Reading the drag rule from the loaded stylesheets at run time. It is fragile while stylesheets load, and it adds work to each check.
- **Wider fix:** C. One class removes the copies.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** C, because one class ends the drift for good.
- **Action:** fix after merge, apply C, because it reaches the app's bar components and the catalogue's drawings outside the covered drag area work.
