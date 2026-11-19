# The Workspace pane drawing fails as a whole pane

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from task M2c of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `docs/mockups/src/screens/product/settings/workspace-pane.tsx:46-60` (the `state === "error"` branch) and `apps/app/src/settings/panes/workspace-pane.tsx:81-86` (the `PaneResource` of the Projects section).
- **Reason:** The drawing and the app disagree on where one failure sits, and only the user decides which side of a mockup and product difference is right.
- **Category:** Mockup.

- **Terms:**
  - **Workspace pane:** The settings pane that shows the workspace's name, plan, address, GitHub accounts and role, then a Projects section with the workspace's projects.
  - **Settings scope:** The workspace and project that the settings dialog reads for the address before it draws a pane. The Workspace pane takes its name and facts from it.
- **Background:** The Workspace pane reads its projects itself, after the settings scope. In the app, the projects' wait, the empty state and the failure all sit inside the Projects section, so the name field and the facts stay on screen. The mockup's wait and empty drawings do the same. The mockup's error drawing, `product/settings/workspace/error`, instead replaces the whole pane with "Projects couldn’t load" and **Try again**. `docs/protocol/cloud/settings-dialog-states.md` says that a pane that fails to load says so where the pane would be, with one retry.
- **Problem:** The error drawing removes the name field, the facts and the GitHub accounts fact, which do not come from the projects read. A reader who typed a new name while the projects loaded would lose it when the projects read fails. The **Wait** composition in `docs/protocol/cloud/folio-chrome.md` says that a failed read removes nothing that the reader typed.
- **Impact if no action:** The spec contradicts itself and the app, so the next change to this pane has no clear target for this failure.
- **Root question:** Where does the Workspace pane say that its projects could not load?
- **Options:**
  - **A.** Redraw the failure inside the Projects section, as the app and the empty drawing do. Keep the name field and the facts. Effort: Small.
  - **B.** Make the whole pane wait for the projects read, including the name field and the facts, so that the failure can replace the pane. The app then wraps the whole pane in the projects read. Effort: Medium.
- **Left out:** Change nothing. The spec then keeps two regions for one read.
- **Wider fix:** None. The **Wait** composition already states the rule.
- **Previous examples:** The GitHub accounts fact of the same pane already fails in its own line with "Couldn’t load" and a quiet **Try again** (`apps/app/src/settings/panes/workspace-github.tsx:56-68`).
- **Recommendation:** A. The name and the facts come from the settings scope, not from the projects read, and the app already places the failure in the section.
- **Action:** ask the user, because option A decides which side of a mockup and product difference is right, and no recorded decision covers it.
