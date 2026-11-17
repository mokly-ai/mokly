# Install step Back always opens a new workspace

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from an outside-the-scope note of the Milestone 5 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/app/src/screens/account/install-screen.tsx:176`, `:230` and `:242`, and `docs/protocol/product-navigation.md:128-146`.
- **Reason:** The protocol doc is silent on the Back of the install step, so the destination is a decision.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The owner, member and reviewer pages still link Back to `createWorkspacePath`, and the resolution table still gives no install-step Back.
- **Category:** Product bug.

- **Terms:**
  - **Install step:** The onboarding step at `/install?workspaceId=W` that installs the Mokly GitHub App for a workspace.
- **Background:** The install step draws a Back link on its owner, member and reviewer pages. All three link to `createWorkspacePath`, which is `/new`, the Create a workspace step. A reader also reaches the install step for an existing workspace, for example from the Workspace pane's no-project state. The resolution table in `docs/protocol/product-navigation.md:128-146` gives Back only for the CLI form.
- **Problem:** For an existing workspace, Back offers to create another workspace instead of returning to where the reader came from.
- **Impact if no action:** A reader who leaves the install step lands on a creation form they did not ask for, and can create a second workspace by mistake.
- **Root question:** Where does Back on the install step take a reader?
- **Options:**
  - **A.** Keep `/new` for onboarding, and send Back to the workspace's viewer when the workspace already has a project. Effort: Small.
  - **B.** Send Back to `/dashboard`, which resolves to the reader's authorized destination. `/dashboard` does not always leave the install step. For a workspace with no project and no connected installation, it resolves to `/install?workspaceId=W` again. Effort: Small.
- **Left out:** Remove Back. The design call of 2026-10-29 keeps the strip and Back, so a page with no action is not a dead end.
- **Wider fix:** None found.
- **Previous examples:** The CLI form's Back depends on the workspace state, as the table states.
- **Recommendation:** B. `/dashboard` returns a reader with a last opened project to it, so Back needs no new rule. A reader whose only workspace is empty then stays on the install step, and the user must accept that.
- **Action:** ask the user, because condition 2 holds: the requirements are silent on this Back.

Add the chosen row to the resolution table in `docs/protocol/product-navigation.md`.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L244-L261) of the deleted plan.
