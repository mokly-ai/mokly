# ViewerPanel names a type and a component

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch calummoore/click-on-row-ux-0nhj, review round 1
- **Location:** `packages/app/src/viewer/selection.ts:13`, `packages/app/src/viewer/panel.tsx:70`, `packages/app/src/screens/viewer/more-menu.tsx:17-18` and `packages/app/src/screens/viewer/panel-host.tsx:12-20`.
- **Reason:** Both exports were on `origin/main` before the branch that found them, and the fix reaches files outside that branch's diff.
- **Category:** Code structure.

- **Background:**
  - `selection.ts:13` exports `ViewerPanel` as the union `"projects" | "switcher" | "history" | "share"`. It names the overlay that a viewer slot opens.
  - `viewer-screen.tsx` and `slots.tsx` under `packages/app/src/screens/viewer/` import that type under its own name. `packages/app/src/_tests_/viewer/account-menu.test.ts` does too.
  - `panel.tsx:70` exports the component `ViewerPanel`, the shared modal frame of one slot's overlay.
  - `more-menu.tsx` and `panel-host.tsx` import both. Each renames the type to `PanelId` on import.
- **Problem:** One name stands for a type of panel ids and for a component. Two files must rename one of them on import.
- **Impact if no action:** An automatic import can offer the wrong one, and a reader cannot tell the two apart by name. The type check catches a wrong use, so the cost is confusion.
- **Root question:** Which name does each of the two exports keep?
- **Options:**
  - **A.** Rename the type in `selection.ts` to `PanelId`, the name that two files already give it. Update the imports in `viewer-screen.tsx`, `slots.tsx`, `more-menu.tsx`, `panel-host.tsx` and `account-menu.test.ts`. Effort: Small.
  - **B.** Rename the component, for example to `ViewerPanelFrame`, in `panel.tsx`, `more-menu.tsx` and `panel-host.tsx`. Effort: Small.
- **Left out:** Fewer than three approaches are real, because only one of the two names has to change.
- **Wider fix:** The lint of `plans/follow-ups/duplicate-export-name-lint.md`, which waits for the user.
- **Previous examples:** `RowTarget` in `packages/app`, renamed to `RowPress` on 2026-11-26. `VersionFailure` is the same case, as an interface in `packages/app/src/viewer/source-store.ts:25` and a component in `packages/app/src/viewer/version-failure.tsx:13`.
- **Related:** `plans/follow-ups/duplicate-export-name-lint.md`: the check for the class. This item is one of its two cases on `origin/main`.
- **Recommendation:** A. The code already calls the type `PanelId` where both meet, and the component keeps the name of its file.
- **Action:** fix after merge, apply A, because the name was on `origin/main` and the rename reaches files outside the diff of the branch that found it.
