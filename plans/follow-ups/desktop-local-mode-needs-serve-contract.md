# Desktop local mode needs a serve contract

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/desktop`, `docs/protocol/desktop-app.md:3-17` and `:81-92`, and `docs/product-direction.md:26-34`.
- **Reason:** Local mode needs a host serve contract from the open-source `mokly-ai/mokly` repository, and the pinned release has none.
- **Checked:** 2026-10-31, at commit `f568853e`. The task is still open. `docs/protocol/desktop-app.md` still defers local mode, and the pinned `@mokly/mokly@0.14.0` exports no host serve API.

- **Terms:**
  - **Local mode:** The desktop feature that opens a checkout on the reader's computer, runs the pinned CLI, and shows unpublished screens in the viewer.
  - **Serve contract:** A released interface of `@mokly/mokly` that lets a host program start the CLI's serve and read its screens.
- **Background:**
  - `docs/product-direction.md` names local mode as the reason for the desktop shell.
  - PR #42 built everything that does not depend on the serve contract. The shell publishes pre-releases only, and the public download page lands with local mode.
  - The public declarations of the pinned `@mokly/mokly@0.14.0` export the config, authoring and renderer contracts only. They have no host serve lifecycle.
  - On 2026-10-31 the npm registry listed 0.17.0 as the latest release. Its published docs showed no host serve API, but nobody proved that no release offers one.
- **Task:** Do the steps below in order.
  - Check whether a released `@mokly/mokly` version already offers a host serve contract.
  - If none does, propose the serve contract in `mokly-ai/mokly`.
  - After the contract releases, create a `desktop-local-mode` plan with the `plans` skill.
  - The plan covers the pin bump, the bridge, the local source in the viewer host and the Local branch entry.
  - It also covers the policy change for the loopback origin and the public download page on the site.
- **Impact if no action:** The desktop shell stays a pre-release without its main feature.
- **Needs:** An accepted upstream proposal and its release. Opening the proposal is an outward-facing action, so confirm it with the owner first.
- **Done when:** The `desktop-local-mode` plan exists on a branch, or the owner drops local mode.

The effort covers the proposal and the plan only. The later pin bump, bridge and viewer work need their own grades in that plan.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.
