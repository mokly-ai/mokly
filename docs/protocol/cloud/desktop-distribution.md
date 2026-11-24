# Desktop Distribution And Verification

This is the delivery and test contract for the
[desktop shell](./desktop-app.md).

## Distribution And Updates

Builds are `dmg` and `zip` for macOS on arm64 and x64 as two separate
builds, and `AppImage` and `deb` for Linux x64. Separate macOS builds avoid
making each reader download both architectures in one universal build.
macOS builds are signed with a
Developer ID Application certificate, use the hardened runtime, and are
notarized with an App Store Connect API key through electron-builder. Linux
builds are unsigned. A release packages the export built for production at
the release's revision; the pull-request job builds it for the main-preview
origins so a reviewer can run the artifact against a live environment.

Every package carries the Mokly app icon: the light-surface brand mark on a
white rounded-square plate, drawn on the macOS icon grid. The Dock, Finder,
the `dmg` window and Linux launchers show it. The white plate keeps the mark's
own colours and stays visible on light and dark Docks; a dark plate was
rejected because it disappears on a dark Dock.

Releases are GitHub releases of the public repository
`mokly-ai/mokly-desktop`, which holds releases and nothing else, because the
updater needs an unauthenticated feed. A feed in this repository was
rejected: the updater reads the latest release of its feed, and the latest
release here is the npm release, which holds no desktop files.

### Latest Release

A desktop release becomes a full GitHub release marked latest, but only after
the check of the complete assets of both platforms. A release stays a draft
when a platform job or asset check fails, or when a higher version is already
latest, as [Drafts And Promotion](#drafts-and-promotion) says. The latest
download address of each asset therefore never breaks:
`https://github.com/mokly-ai/mokly-desktop/releases/latest/download/{name}`.

These fixed addresses give download links a stable target. A version record
in the site source was rejected, because a person must update it after each
release. A GitHub API lookup at site build time with a site redeploy was
rejected, because it adds network access to the site build and links two
workflows. A Mokly-hosted bucket was rejected, because it adds infrastructure
and credentials.

Each release holds exactly these assets. Their names are a contract, because
a download link names the asset. The names hold no version. Only the release
tag, `v<version>`, holds the version.

- macOS installers: `Mokly-mac-arm64.dmg`, `Mokly-mac-x64.dmg`,
  `Mokly-mac-arm64.zip` and `Mokly-mac-x64.zip`.
- macOS blockmaps: each installer name plus `.blockmap`.
- macOS update file: `latest-mac.yml`.
- Linux: `Mokly-linux-x86_64.AppImage`, `Mokly-linux-amd64.deb` and the update
  file `latest-linux.yml`.

### Release Pull Requests

The shell's version is `packages/desktop/package.json`. Versions have the form
`0.x.y`, and the first is `0.1.0`. The alpha line was rejected, so that the
version shows the kind of change. Each version comes from a release pull
request, as the [npm release](../npm-release-management.md) does. A
version from a pushed tag or a hand edit was rejected: one merge then sets the
version, writes the changelog and starts the release.

- The `desktop` Release Please component covers `packages/`, except the npm
  CLI package and the native packages. The bundle of the shell is the shell,
  the app export and the shared packages, so every change to one of them can
  release the shell. Its changelog is `packages/desktop/CHANGELOG.md`.
- Each push to `main` updates the desktop release pull request. A `fix` gives
  a patch version and a `feat` gives a minor version. The desktop and npm
  releases have separate pull requests, so each product ships on its own.
- The merge creates the tag `desktop-v<version>` on the merge commit, and a
  GitHub pre-release of this repository. The npm release stays the latest
  release of this repository.
- The release workflow then checks that the tag points at the merge commit.
  It checks out that commit, never a tag or a branch name, and stops before
  signing when the check fails. The workflow never moves a tag. A person
  moves it to the merge commit and reruns the failed jobs.
- It checks that the tag equals `desktop-v` plus the package version. It then
  builds on a macOS runner and a Linux runner and uploads to the draft release
  `v<version>` of the feed. The `deb` updater opens the release page of that
  tag. A final [promotion](#drafts-and-promotion) makes the draft the latest
  release, unless a higher version is already latest.
- Pull requests run the same packaging without release signing or
  publishing, so the build is proven before any secret is used.

`.github/workflows/desktop-release.yml` runs on package-affecting pull
requests and manual dispatch, and the release workflow calls it for a desktop
release. Dispatch runs preview packaging. Both jobs use the repository's
`MKC_DOMAIN` and `MKC_CATALOGUE_BASE_DOMAIN` variables. The desktop build-input
script calls `infra/scripts/render-values.py`'s domain helpers for production
or main-preview, including the environment's catalogue base domain.
Fork pull requests do not receive repository variables. For those builds the
script derives the app domain from the existing package homepage and reads
the catalogue base domain from the public main-preview `/_config`. It then
applies the same domain helpers. This reuses deployed build metadata and adds
no second domain setting. Production releases require repository variables.

Preview macOS builds set `CSC_IDENTITY_AUTO_DISCOVERY=false`, use an ad-hoc
signature and disable hardened runtime and notarization. This lets arm64
packages start without an Apple credential. Release macOS builds keep hardened
runtime and require the Developer ID signature and notarization. Linux builds
use the `mokly` executable name in both modes.

### Drafts And Promotion

One draft `v<version>` holds the files of both platforms. A platform job fails
when a published release already has that tag. Before any upload, each
platform attempt records the name, size and SHA-256 hash of each built file.
The jobs only add assets: an uploaded asset is never replaced or deleted. An
existing asset name or an upload collision fails the job, unless the draft
already holds the complete fixed set of its platform, and the GitHub digest
and size of each file match one record of an earlier attempt. In that case the
job uploads nothing. A partial set, an extra file, a mismatch or no matching
record still fails. Each job then requires a draft with that tag. A skipped
upload, or a file without its size and `uploaded` state, fails the job. A
rerun that replaces draft assets was rejected, because it reverses the
never-delete rule, and so was the draft as the only record, because it drops
the recorded sizes.

A final promotion runs only after both platform jobs pass. It requires exactly
the assets that [Latest Release](#latest-release) lists, each with the size
that its platform job recorded and the `uploaded` state, and the tag
`v<version>` of the shell's version. When GitHub's latest release has a higher
version, the promotion does not publish: the release stays a draft, and the
job passes with a warning that names both versions. With no latest release,
or one with an equal or lower version, one publication request makes the
draft a full release marked latest, and the promotion then checks that mark.
The latest mark never moves backward, because a newer version holds every
change of the older one. Publishing the older release without the latest
mark, and moving the mark back after each promotion, were rejected.

Only the publication request makes a release public. A failure before it
keeps the release a draft, and a failure of the request or after it can leave
a full release. A rerun of the promotion leaves a full release unchanged and
checks the latest mark again, or it passes with a warning when a higher
version is latest. A rerun of the failed jobs repairs a run whose failed
platform uploaded nothing or its complete set, and it runs the skipped
promotion. A release with a partly uploaded platform stays a draft and needs a
new version. The build records, and the records that the promotion reads, are
kept for 35 days, which covers GitHub's 30-day rerun window.

### Release Secrets

The platform jobs and the promotion read the signing credentials and the
release token from the `desktop-release` GitHub environment, which admits only
`main`. [Secrets](../../ops/secrets.md) records their names, owners and
rotation. Repository secrets were rejected, because a workflow on any branch
can read them, and the signing credentials decide which builds install as an
update. Pull requests, manual dispatches and fork builds receive none of them.
Only the macOS signing step receives the signing credentials, and no release
token. The publishing steps and the promotion step receive only the release
token. The promotion job runs no third-party package code.

### Updates In The App

- Only the packages that a release publishes have the updater on. A build-time
  flag turns it on. Preview packages and local builds keep it off, and their
  **Check for updates** item is disabled. Reason: a preview build with the
  updater on could install a production release over itself. The updater
  never runs in an unpackaged app.
- The updater reads the public release feed of `mokly-ai/mokly-desktop`. It
  follows GitHub's latest release of that repository and never takes a
  pre-release or a draft. Reason: the app then installs the same release that
  the latest download addresses serve. It checks the feed at launch and every
  four hours and downloads in the background.
- It then shows one native dialog, "Mokly <version> is ready", with
  **Restart now** and **Later**. **Later** installs on the next quit. On macOS
  the dialog comes only after the macOS update framework accepts the
  download. Reason: macOS can still refuse it, and **Restart now** would then
  wait for ever. Without a manual check, the app offers each version once.
- **Check for updates** answers each manual check with a native dialog:
  - No new version: "Mokly is up to date."
  - A failed check: "Mokly could not check for updates. Try again later."
  - A new version: "Downloading the new version. Mokly tells you when it is
    ready." The ready dialog follows.
  - A downloaded version that waits: the ready dialog again.
- A failed automatic check, download or install does not stop the app and
  shows no dialog.
- At launch on macOS, a release build that runs from a read-only place outside
  an Applications folder shows "Move Mokly to Applications to get updates."
  with **Move to Applications** and **Not now**. Such a place is its mounted
  `dmg`, or the hidden read-only copy that macOS runs until the user moves the
  app. Reason: the macOS update framework cannot replace an app there, so the
  copy would download each update and never install it.
- **Move to Applications** moves the app and restarts it from there. **Not
  now** hides the dialog until another version runs. A copy in a writable
  folder shows no dialog, because it can update itself.
- Linux without an `APPIMAGE` environment variable has no in-place updater:
  its dialog names the new version and offers the release page. The AppImage
  updater replaces the file in place.
- The product's pages update by release, not by cloud deploy, and the API
  makes no version check; because the project is not in production, an API
  change may break an older desktop build until it updates.

## Verification

The `cloud-desktop` suite of `cargo xtask check` runs the logic tests of the
desktop project, the export it bundles and its Electron smoke test. The
`cloud-typecheck` suite typechecks the project, and the Repository suite lints
and formats it.

- Logic tests (`src/_tests_/*.test.ts`, `node:test` through `tsx`) cover the
  scheme-address validator, the navigation policy with its rewrite and site
  segments, the export resolver against a table of the app server's rules,
  the build configuration reader, the update flag, the update dialogs and
  manual check answers and the read-only install check, with the
  Electron APIs injected as doubles. Permission cases cover the main-frame
  clipboard write grant and denial of other frames, origins and permissions.
  Event-order cases hold the initial load,
  deliver a handoff and check that the app stays open. They also close and
  reopen the macOS window through both entry events. Credential-bearing load
  errors test the shared diagnostic formatter.
- The Electron smoke test (`src/_tests_/*.spec.ts`, Playwright's Electron
  launcher) runs the main process against the export and the real API the
  application harness starts. It launches first with no API reachable and
  proves the session error state with **Try again**. It then presses the entry
  screen's action, mints a grant through the API for the challenge that the
  action opened, delivers the grant address as a scheme-form launch argument
  and proves the session survives a relaunch. It proves that a used grant
  shows the expired state and that a valid grant delivered next starts a fresh
  landing document and signs the window in. It opens the viewer route and
  proves that a public-origin product link is rewritten into the bundle, that a
  site link, an external link, a GitHub page and a Stripe page reach the
  system-browser opener, and that a public-origin callback path is rewritten
  into the bundle before any request reaches the hosted server. It proves
  Chromium sends `Origin: mokly-app://desktop`, the API admits it, and the
  `SameSite=None; Secure` session cookie is stored, sent and kept across a
  relaunch. It loads the catalogue index through CORS. It proves
  that a plain catalogue document renders with desktop `frame-ancestors`
  admission and is blocked without it. It presses the share panel's
  **Copy link** action and awaits a read of the system clipboard from the main
  process. It also captures the real main-process logger
  during a rejected handoff load and proves that its output has no credential.
  Linux runs it under `xvfb-run`.

The pull-request packaging job also extracts the macOS arm64 ZIP or Linux
AppImage and launches that executable with Playwright's Electron launcher.
It requires `app.isPackaged`, an `app.asar` application path and the bundled
`mokly-app://desktop/dashboard` session error with **Try again**. A local
connection-closing proxy prevents renderer API access. Linux uses `xvfb-run`.
Each platform uploads the packages and its launch evidence as separate
artifacts. Screenshots and JSON evidence live under
`.context/desktop-app-shell/`.

Before a desktop release pull request merges, the packaged app is
smoke-tested by hand on macOS: install
from the `dmg`, sign in through the browser, open a project and run **Check
for updates**.
