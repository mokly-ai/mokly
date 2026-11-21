# Unlinked projects cannot link a repository later

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from design call 5 of 2026-10-29 in the deleted `plans/workspaces.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/project_input.rs:8-41`, `crates/mkc-api/src/input.rs:80-91`, `crates/mkc-api/src/platform/projects.rs:58-85`, `packages/app/src/settings/panes/project-pane.tsx:109-174` and `docs/protocol/cloud/platform-model.md:169-186`.
- **Reason:** The workspaces change left this feature out by a design call, and no requirement or user decision asks for it yet.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. A project gets its repository link only at creation, and neither the update path nor the project pane has a link action.
- **Category:** Docs or spec.

- **Terms:**
  - **CLI project:** A project with no GitHub repository link. It publishes only with the Mokly CLI and a project token.
- **Background:** Since PR #77, a project links an installed repository or has no link. The user decided on 2026-10-29 that this is one kind of project with an optional link. A project without a link has no builds, no GitHub check and no pull request details. Its Automatic builds setting stays off. The design call of 2026-10-29 left out a way to add the link later. The optional-link decision of the user did not approve a later-link action.
- **Problem:** A team that starts with a CLI project and later installs the App cannot link that project. It must create a second project. It can keep the first project, but it cannot combine that history with the new cloud builds.
- **Impact if no action:** Teams that start with the CLI keep two projects, and their publication history stays apart from their cloud builds.
- **Root question:** Can a project without a repository link gain one later, and how?
- **Options:**
  - **A.** Keep projects without a link as they are. Document that a new project is needed to use cloud builds. Effort: Small.
  - **B.** Add a link action to the project pane that binds an installed repository whose identity matches the stored repository. It keeps the active installation ownership and the publication history. Effort: Large.
- **Left out:** Link any installed repository without an identity match. Ingest compares the stored identity, so a mismatch would refuse later uploads.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. It keeps the history of a team that grows into cloud builds.
- **Action:** ask the user, because condition 2 holds: B adds behaviour at a boundary that no requirement covers.

Source: [answer 5 and the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/workspaces.md?plain=1#L251-L253) of the deleted plan.
