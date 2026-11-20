# Desktop local mode needs a serve contract

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/mokly/src/index.ts`, `apps/desktop`, `docs/protocol/cloud/desktop-app.md:3-17` and the section "Local Mode", and `docs/product-direction.md:26-34`.
- **Reason:** Local mode needs a host serve contract in `@mokly/mokly`, a new public interface that the owner must choose to start.
- **Checked:** 2026-11-17, in the combined repository. The task is still open. `docs/protocol/cloud/desktop-app.md` still defers local mode, and `packages/mokly/src/index.ts` exports the authoring API only, with no host serve API.

- **Terms:**
  - **Local mode:** The desktop feature that opens a checkout on the reader's computer, runs the Mokly CLI, and shows unpublished screens in the viewer.
  - **Serve contract:** A public interface of `@mokly/mokly` that lets a host program start the CLI's serve and read its screens.
- **Background:**
  - `docs/product-direction.md` names local mode as the reason for the desktop shell.
  - PR #42 built everything that does not depend on the serve contract. The shell publishes pre-releases only, and the public download page lands with local mode.
  - The public entry of the workspace `@mokly/mokly`, `packages/mokly/src/index.ts`, exports the authoring API only. It has no host serve lifecycle.
  - The cloud uses the workspace Mokly packages, so the serve contract and the desktop work can land in this repository with no release and no version bump. Mokly never depends on the cloud, as `docs/protocol/repository-layout.md` requires, so the contract must serve any host program, not only the desktop shell.
- **Task:** Do the steps below in order.
  - Ask the owner whether to start local mode.
  - If the owner agrees, create a `desktop-local-mode` plan with the `plans` skill.
  - The plan covers the serve contract of `@mokly/mokly` and its protocol page, the bridge, the local source in the viewer host and the Local branch entry.
  - It also covers the policy change for the loopback origin and the public download page on the site.
- **Impact if no action:** The desktop shell stays a pre-release without its main feature.
- **Needs:** The owner's choice to start local mode. A new public interface of `@mokly/mokly` changes a requirement, so the owner approves the plan first.
- **Done when:** The `desktop-local-mode` plan exists on a branch, or the owner drops local mode.

The effort covers the plan only. The later contract, bridge and viewer work need their own grades in that plan.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.
