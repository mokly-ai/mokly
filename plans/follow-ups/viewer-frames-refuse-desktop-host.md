# Viewer frames do not accept the desktop host

- **Severity:** Medium (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/frame/src/probe/values.ts:99-106`, `packages/frame/src/adapters/post_message_adapter.ts:24-34`, `docs/protocol/mokly-frame-probe-wire.md:9` and `:23`, `apps/app/src/viewer/published.web.tsx:81-88`, `apps/desktop/src/_tests_/viewer.ts:40`, and the section "Current Viewer Limit" of `docs/protocol/cloud/desktop-app.md`.
- **Reason:** The fix changes a requirement of the Mokly frame probe protocol, which the owner must approve, and the frame proof needs a packaged desktop shell and a catalogue that the changed CLI published.
- **Checked:** 2026-11-17, in the combined repository. The problem is still open. `origin` in `packages/frame/src/probe/values.ts:99-106` accepts only an `http:` or `https:` origin. The adapter and the frame probe of each published screen use it, so both reject `mokly-app://desktop`. Nobody made a frame proof in the shell.

- **Terms:**
  - **Desktop origin:** `mokly-app://desktop`, the origin from which the Electron shell serves the bundled web export.
  - **`postMessageAdapter`:** The frame adapter of `@mokly/frame`, which `@mokly/viewer` exports. It lets the viewer talk to a screen frame on the catalogue origin.
  - **Frame probe:** The script that the CLI embeds in each published screen. It answers the adapter from inside the frame. Its earlier name was the inspector.
- **Background:**
  - The desktop shell serves the app from its own origin. Decision 1A of 2026-10-15 kept `mokly-app://desktop` as that origin.
  - `docs/protocol/mokly-frame-probe-wire.md:9` and `:23` require an HTTP(S) frame origin and an HTTP(S) host origin. So the adapter throws `FrameError("origin")` in the shell, and the shell shows no managed screen frame. `apps/desktop/src/_tests_/viewer.ts:40` asserts that frame error state.
  - The cloud uses the workspace `@mokly/frame`, `@mokly/viewer` and `@mokly/mokly` packages. So one change can fix the Mokly side and the cloud side together, with no release and no version bump.
  - Mokly never depends on the cloud, as `docs/protocol/repository-layout.md` requires. So the new Mokly rule must not name the desktop origin. For example, it can accept a canonical origin of any standard scheme, or a host origin that the host gives to the adapter.
- **Task:** Do the steps below in order.
  - Get the owner's approval for the changed host-origin rule of `docs/protocol/mokly-frame-probe-wire.md`, because it changes a requirement.
  - In one change, update `origin`, the adapter, the protocol page and the tests of `packages/frame`. Change `apps/desktop/src/_tests_/viewer.ts` to expect a mounted frame. Update the section "Current Viewer Limit" of `docs/protocol/cloud/desktop-app.md`. When the contract fixtures change, regenerate them with `cargo xtask mokly-fixtures`.
  - After the deploy, publish each hosted catalogue again with the changed CLI, so that its frame probe accepts the desktop host.
  - Prove that screen frames render in the shell.
- **Impact if no action:** The desktop shell cannot show screen frames, so it is not yet useful for reading a catalogue.
- **Needs:** The owner's approval of the changed frame protocol rule, the deployed change, and a packaged shell.
- **Done when:** Screen frames render in the shell, served from `mokly-app://desktop`, from a publication that the changed CLI made.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.
