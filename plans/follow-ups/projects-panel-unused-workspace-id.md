# Projects panel passes a workspace id nobody reads

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-27, from an outside-the-scope note of the review of the branch `calummoore/adding-new-workspace-not-possible-8n58`.
- **Location:** `packages/app/src/viewer/panels/projects.tsx` (the `workspaceId` prop and `onCreateProject`), `packages/app/src/screens/viewer/panel-host.tsx:89-91`.
- **Reason:** The unused value is on `origin/main` before that branch, so it needs its own branch.
- **Category:** Code structure.

- **Background:** `ProjectsPanel` takes a `workspaceId` prop and passes it to `onCreateProject(workspaceId)`. Its one caller, `ViewerPanelHost`, ignores that argument and builds the address from `project.workspaceSlug`.
- **Problem:** The prop carries a value that nothing reads, so the callback's signature suggests that the panel chooses the workspace when it does not.
- **Impact if no action:** The next edit can trust the argument and create the project in the wrong place.
- **Root question:** Which component decides the workspace that Create project opens?
- **Options:**
  - **A.** Remove the `workspaceId` prop and the callback argument, so the host alone decides. Effort: Small.
  - **B.** Keep the prop, and make the host use the argument instead of `project.workspaceSlug`. Effort: Small.
- **Left out:** Only two approaches are real, because either the panel or the host owns the choice.
- **Wider fix:** None, because the lint for unused values cannot see an argument that a caller drops.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/projects-panel-offers-reviewer-create-project.md`: its option A reads the viewer's workspace id in the panel. If that lands first, keep the prop under B.
- **Recommendation:** A. The host already holds the project, so it is the one owner of the choice.
- **Action:** fix after merge, apply A, because it is a separate cleanup of code on `origin/main`.
