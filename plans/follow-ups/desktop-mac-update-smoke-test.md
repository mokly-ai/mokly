# Smoke-test a desktop update on a Mac

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from the post-merge TODOs of the desktop release
  pull request plan on branch `calummoore/desktop-release-process-ujn3`.
- **Location:** `packages/desktop/src/updates.ts` and
  `packages/desktop/src/install-location.ts`.
- **Reason:** The test needs two published desktop releases and a real Mac.
  The first release comes only after the change merges, and the branch was
  built on Linux.

- **Terms:**
  - **Squirrel.Mac:** the macOS update framework inside Electron. It accepts
    a downloaded version and replaces the app when the update installs.
  - **Read-only copy:** a copy of the app that runs from its mounted DMG, or
    from the hidden read-only place where macOS runs a downloaded app until
    the user moves it.
- **Background:**
  - Release builds of the Mokly desktop app update themselves from the
    pre-releases of `mokly-ai/mokly-desktop`. Preview and local builds keep
    the updater off.
  - The app checks at launch and every four hours. On macOS it shows
    "Mokly {version} is ready" with **Restart now** and **Later** only after
    Squirrel.Mac accepts the download.
  - Help → **Check for updates** answers with "Mokly is up to date.",
    "Mokly could not check for updates. Try again later.", or "Downloading
    the new version. Mokly tells you when it is ready."
  - A read-only copy offers "Move Mokly to Applications to get updates."
  - The logic tests use doubles. No test installs a real update.
- **Task:**
  1. Install the first desktop release from its DMG into Applications.
     Check that macOS shows no warning about the developer.
  2. Start it from Terminal with `/Applications/Mokly.app/Contents/MacOS/Mokly`,
     so that the log shows. Choose **Check for updates**. Check "Mokly is up
     to date.".
  3. Merge the next desktop release pull request and wait for its release.
  4. Choose **Check for updates**. Check the downloading dialog, then the
     ready dialog. Choose **Later**, quit, start again, and check the new
     version in About Mokly.
  5. Install the first release again, start it, and wait for the ready
     dialog of the launch check. Choose **Restart now**. Check the new
     version.
  6. Open the DMG and start Mokly from it. Check the move dialog. Choose
     **Move to Applications**. Check that the app restarts from Applications.
  7. Record each failure, with the Terminal log, in a new follow-up item.
- **Impact if no action:** A defect in the update path can stop every
  installed copy from updating, and nobody learns of it until people miss a
  fix.
- **Needs:** A Mac with Apple silicon or Intel, and two published desktop
  releases.
- **Done when:** A copy installed from the first release reached the newer
  version once through **Later** and once through **Restart now**, each
  manual check showed its dialog, and the DMG copy moved itself. Then delete
  this item.
