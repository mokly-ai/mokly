# Guest settings index offers only a first workspace

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from a finding check of the review of the branch `calummoore/adding-new-workspace-not-possible-8n58`.
- **Location:** `packages/app/src/settings/panes/sections-pane.tsx:49-65`, `packages/app/src/settings/dialog-host.tsx:198-247`, `packages/app/src/settings/scope.ts:104`, `docs/mockups/src/screens/product/settings/sections-pane.tsx:86-100`, `docs/protocol/cloud/settings-dialog.md:133-136`, `docs/protocol/cloud/platform-model.md:63-64`.
- **Reason:** The problem is on `origin/main` before that branch, so it needs its own branch.
- **Category:** Product bug.

- **Terms:**
  - **Project-only guest:** a reader who can open their granted projects but belongs to no workspace, so they cannot read workspaces.
  - **Settings index:** the first pane of the settings dialog. It lists the sections and panes that the reader can reach.
- **Background:** The account menu's Settings opens the settings dialog over the viewer for every reader. The protocol keeps a Project section for a project-only guest. On a wide screen, the dialog's rail already lists the guest's Project panes, and `packages/app/src/_tests_/settings/project-guest.spec.ts` checks that rail. `SectionsPane` draws the index. With no workspace in scope, it ignores `availablePanes` and draws an empty state instead. The catalogue draws the same empty state.
- **Problem:** For a project-only guest, the index shows only "Create your first workspace", with the line "Workspace and project settings appear once you have one." That line contradicts the Project section that the rail beside it lists. Its action opens `/new`, which has no way back to the viewer. On a compact screen, the dialog host moves the index to `/settings` and drops the project, and `scope.ts:104` finds a project only when there is a workspace, so the guest sees only the empty state.
- **Screenshot:** None, because the empty-state text and the rail are in the code and the catalogue drawing named above.
- **Impact if no action:** Each guest who opens Settings is told that project settings need a workspace, and is pushed to create one.
- **Root question:** What does the Settings index show a reader who has a project in scope but no workspace?
- **Options:**
  - **A.** Change the condition at `sections-pane.tsx:49`, so that a scope with a project and no workspace lists the Project section from `availablePanes`. Keep the empty state for a reader with neither. Make the compact host keep the project, and let `scope.ts` find a project without a workspace. Draw the guest's index in the catalogue. Add the index case to `project-guest.spec.ts`, which today opens `?settings=project`. Effort: Small.
  - **B.** Keep the empty state, and change its line in the app and the catalogue drawing so that it does not claim that project settings need a workspace. Effort: Small.
- **Left out:** Only two approaches are real, because the protocol already keeps the guest's Project section, so the index either shows it or stops denying it.
- **Wider fix:** None, because the unit tests of `availablePanes` in `packages/app/src/_tests_/settings.test.ts:49-128` already hold the per-role rule, and A makes the index read it.
- **Previous examples:** None found.
- **Related:**
  - `plans/follow-ups/create-workspace-from-viewer-has-no-way-back.md`: the same dead end at `/new`.
  - `plans/follow-ups/viewer-projects-without-workspaces-lacks-mockup.md`: the same reader, in the viewer with no workspace. Its option A sends that reader to `/new`, which this item calls the defect.
- **Recommendation:** A. It gives the guest the section that the protocol promises, on every screen size.
- **Action:** fix after merge, apply A, because it is a separate defect on `origin/main` that needs its own branch.
