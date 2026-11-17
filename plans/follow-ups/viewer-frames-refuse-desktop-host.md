# Viewer frames do not accept the desktop host

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/app/src/viewer/published.web.tsx:94-99`, `ts/app/package.json:22`, `ts/node_modules/@mokly/viewer/dist/browser/post_message_adapter.js:1-5` and `:21-30`, and `ts/node_modules/@mokly/viewer/dist/inspector/values.js:62-70`.
- **Reason:** The fix needs a released change in the open-source `mokly-ai/mokly` repository first.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The pinned 0.5.0 adapter and inspector still reject a host origin that is not HTTP or HTTPS. Nobody made a frame proof in the shell.

- **Terms:**
  - **Desktop origin:** `mokly-app://desktop`, the origin from which the Electron shell serves the bundled web export.
  - **`postMessageAdapter`:** The `@mokly/viewer` frame adapter that lets the viewer talk to a screen frame on the catalogue origin.
- **Background:** The desktop shell serves the app from its own origin. Decision 1A of 2026-10-15 kept `mokly-app://desktop` as that origin. The viewer's `postMessageAdapter` and the inspector embedded in published screens accept only web host origins. So screen frames wait for an upstream viewer release and a separate pin bump. The cloud pins `@mokly/viewer` 0.5.0 and `@mokly/mokly` 0.14.0. On 2026-10-31 the npm registry gave 0.17.0, published on 2026-10-29, as the latest release of both. The 0.17.0 adapter and inspector still accept only HTTP and HTTPS hosts, so a pin bump alone does not fix the frames. The full scope crosses two repositories and bumps two dependencies, so it is Large. `AGENTS.md` requires that a field or behaviour the cloud needs lands upstream first.
- **Task:** Do the steps below in order.
  - Propose in `mokly-ai/mokly` that `postMessageAdapter` and the inspector accept the desktop origin as a host.
  - After its release, bump `@mokly/viewer` and `@mokly/mokly` in their own change, and regenerate the contract fixtures with `cargo xtask mokly-fixtures`.
  - Publish screens again with the new CLI, so that their embedded inspector accepts the desktop host.
  - Prove that screen frames render in the shell.
- **Impact if no action:** The desktop shell cannot show screen frames, so it is not yet useful for reading a catalogue.
- **Needs:** An accepted upstream proposal and its release. Opening the proposal is an outward-facing action, so confirm it with the owner first.
- **Done when:** Screen frames render in the shell, served from `mokly-app://desktop`, from a publication made with the new CLI.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.
