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
updater needs an unauthenticated feed. The shell's version is
`packages/desktop/package.json`; a tag `desktop-v<version>` on
this repository runs the release workflow, which builds on a macOS runner and
a Linux runner and publishes with electron-builder's GitHub publisher. Every
release is a pre-release until local mode lands, as
[Desktop application](./desktop-app.md) requires. Pull requests run the same packaging
without release signing or publishing, so the build is proven before any secret
exists. The workflow checks that the source tag equals `desktop-v` plus the
package version. The publisher creates `v<version>` in the public repository,
which is also the release-page address the `deb` updater opens. The two
platform publishers run in sequence to create and fill one pre-release.

Release packaging first builds with publishing disabled in a fresh output
directory. The pinned GitHub publisher keeps its two-hour upload limit, but
an append-only upload hook prevents its asset replacement path. An existing
asset name or a racing upload collision fails the job. Published assets are
never replaced or deleted, and `EP_GH_IGNORE_TIME` is never enabled. After
uploading, the job reads the release asset list with the release token and
checks every built package, blockmap and update file by name, size and
`uploaded` state. A skipped upload or partial inventory fails, even if the
publisher returns success. Delayed recovery needs a new package version and
a matching new source tag; rerunning a release never repairs published assets.

`.github/workflows/desktop-release.yml` runs on matching tags, package-affecting
pull requests and manual dispatch. Dispatch on a `desktop-v*` tag releases it;
dispatch on a branch runs preview packaging. Both jobs use the repository's
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

The updater is off when the application is not packaged. It uses the GitHub
provider for `mokly-ai/mokly-desktop` and accepts pre-releases. It checks the feed at launch and every four hours, downloads in the
background and then shows one native dialog, **Restart now** or **Later**;
**Later** installs on the next quit. Linux without an `APPIMAGE` environment variable has no in-place updater: its
dialog names the new version and offers the release page. The AppImage
updater replaces the file in place. The product's pages update by release,
not by cloud deploy, and the API makes no version check; because the project
is not in production, an API change may break an older desktop build until
it updates.

The release workflow reads GitHub Actions secrets `APPLE_API_KEY`,
`APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `CSC_LINK`, `CSC_KEY_PASSWORD` and
`DESKTOP_RELEASES_TOKEN`; [Secrets](../../ops/secrets.md) records their owners
and rotation. Fork builds receive none of them. Only the publishing steps
receive secrets. The macOS packaging script writes the certificate and API key
to private temporary files, passes their paths to electron-builder through its
environment, and removes the files after success or failure. The publisher
reads `DESKTOP_RELEASES_TOKEN` as `GH_TOKEN`.

## Verification

The `cloud-desktop` suite of `cargo xtask check` runs the logic tests of the
desktop project, the export it bundles and its Electron smoke test. The
`cloud-typecheck` suite typechecks the project, and the Repository suite lints
and formats it.

- Logic tests (`src/_tests_/*.test.ts`, `node:test` through `tsx`) cover the
  scheme-address validator, the navigation policy with its rewrite and site
  segments, the export resolver against a table of the app server's rules,
  the build configuration reader and the update dialog decisions, with the
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

Before a release, the packaged app is smoke-tested by hand on macOS: install
from the `dmg`, sign in through the browser, open a project and run **Check
for updates**.
