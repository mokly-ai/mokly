# Desktop install and update lack a recorded proof

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/desktop/src/updates.ts`, `.github/workflows/desktop-release.yml` and `docs/protocol/desktop-distribution.md:67-75` and `:133-135`.
- **Reason:** The proof needs published releases and a real Mac and Linux machine, outside the repository.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify an installed walk. Both pre-releases are on the public feed, but no dated install, handoff or update result exists for either platform.

- **Terms:**
  - **Update feed:** The releases of the public `mokly-ai/mokly-desktop` repository, which the installed shell reads to find updates.
  - **Handoff:** The sign-in flow that hands the email link from the browser to the shell through the `mokly` scheme.
- **Background:** PR #42 added the Electron shell on 2026-10-21. Since Deploy run 40260715261 on 2026-10-26, `main-preview` and production admit the desktop origin. The list below gives the release facts that PR #58 records, as history.
  - On 2026-10-26 the Apple secrets were added with the individual membership `UV85J3PKBX`. The certificate expires on 2027-11-25.
  - Release run 40316994987 signed and notarized both macOS packages of `0.1.0-alpha.1`. Its second attempt published all twelve files.
  - Release run 40397608619 published `0.1.0-alpha.2` with the Mokly app icon.
  - On 2026-10-31 the public feed listed both pre-releases, published on 2026-10-26. PR #58 still keeps the installed update proof open.
  - `ts/desktop/src/updates.ts` reads the public feed, allows pre-releases, and installs the update or opens the release page by package type.
  - `docs/protocol/desktop-distribution.md:133-135` requires a manual installed walk on macOS before a release.
  - The desktop viewer has a known frame limit on its non-HTTP origin, in `plans/follow-ups/viewer-frames-refuse-desktop-host.md`. That limit is not evidence that the install or the update failed.
- **Task:** Prove the installed shell and its updater, then record the results.
  - On macOS, install `0.1.0-alpha.1` from the `dmg`. Sign in through the handoff, open a project, and run **Check for updates**.
  - Confirm that the shell updates to `0.1.0-alpha.2` on macOS.
  - Repeat the install and the update with the AppImage on Linux.
  - For each platform, record the date, the device and architecture, the installed asset, the handoff result, the source and target versions and the update result.
  - Record the results in a runbook under `docs/ops/`. If an earlier dated walk exists, record that instead.
- **Impact if no action:** A broken updater can strand every installed copy on its first version, and nobody knows it.
- **Needs:** A Mac and a Linux machine, and the two releases on the update feed.
- **Done when:** A runbook under `docs/ops/` records a dated working install, sign-in and update on both platforms. Record an updater defect only when an installed walk fails.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L796-L825) of the deleted plan.
