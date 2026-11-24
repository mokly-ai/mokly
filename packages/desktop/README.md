# Desktop Package

The Mokly Cloud desktop surface is a small Electron shell for macOS and
Linux. It ships the Expo web export from `packages/app` and serves it from
`mokly-app://desktop`. It uses the same API, pages and cloud chrome as the
browser app.

## Responsibilities

- Open the product without a hosted page server.
- Keep the renderer isolated and catalogue HTML on its separate origin.
- Receive desktop grants through `mokly` in one instance.
- Keep window bounds and the Chromium session across launches.
- Keep the native Mac window buttons centred in the app's top bar at each
  page zoom.
- Update release builds from the latest release of the public feed.

## What This Package Does

The main process serves bundled files, controls navigation, receives scheme
addresses and supplies the platform menu. It contains no product screen,
preload, renderer bridge or viewer implementation. Electron is pinned to
44.11.3, with Chromium 152 and Node 24.22.2. The package's exact pins are in
[`package.json`](./package.json). The builder and the updater use the public
`mokly-ai/mokly-desktop` GitHub feed. The updater follows its latest release
and takes no pre-release or draft.
Only release builds turn the updater on. Development, local builds and
pull-request packages keep it off, and their **Check for updates** item is
disabled. On macOS the ready dialog waits until the macOS update framework
accepts the download. A manual check always answers with a dialog. A macOS
copy that runs from a read-only place, such as its mounted DMG, offers to move
into Applications. A packaged Linux app without `APPIMAGE` offers the release
page; it does not download or install an update.
[Updates in the app](../../docs/protocol/cloud/desktop-distribution.md#updates-in-the-app)
holds the rules.

Only the main frame on `mokly-app://desktop` can use
`clipboard-sanitized-write`. Requests and checks deny every other permission,
including clipboard reads and all subframe permissions.

The workspace viewer loads its catalogue index and cloud chrome in the shell,
but rejects its non-HTTP host when it mounts a screen frame. Screen previews
need a change to the workspace viewer and frame probe. The smoke test waits for
the catalogue index, records this limit and separately proves that catalogue
CORS and framing admission work.

## Quick Start

From the repository root, install with Node 24.21.0 and npm 11.21.0:

```sh
npm ci
scripts/cloud/dev-api.sh
# In another terminal:
scripts/cloud/dev-catalogue.sh
# In another terminal:
npm run build --workspace @mokly-cloud/desktop
MKC_DESKTOP_CATALOGUE_SOURCE='http://*.localhost:8082' \
  npm run start --workspace @mokly-cloud/desktop
```

The scripts enable `MKC_DESKTOP_CLIENT=true` on both servers. Select
**Continue in browser** in the window. Sign in on the browser page, then select
**Open Mokly**. The log mailer prints the ordinary browser email link when
email sign-in is used. Scheme registration needs an installed package. For an
unpackaged app, keep the requesting window open and deliver its grant as an
argument of a second launch:

```sh
npm run start --workspace @mokly-cloud/desktop -- \
  'mokly://auth/desktop/callback#grant=<64 lowercase hex characters>'
```

The address must match exactly, without normalization or extra fields. It
loads `/auth/desktop/callback#grant=<grant>` on the desktop origin. The
requesting tab keeps the verifier that the landing needs to exchange the grant.

Each accepted handoff loads `about:blank` before the bundled callback. This
starts a fresh document after a used or expired grant, so the app entry captures
the new grant before the router starts. A received address stays ignored
for the rest of the run. One guard covers the reset and exchange. It watches
the POST to `/v1/auth/desktop/callback` by Electron request ID and ignores older
request and load failures. The matching request's completion or failure
releases the guard. Navigation away from the committed landing also releases
it. Grants stay in the callback fragment.

Product navigation and redirects to the public app origin load the same path,
query and fragment from the bundle. Public site paths open in the system
browser. No third-party page loads in the window: GitHub and Stripe navigation
opens in the system browser, and the app opens Stripe's pages as popups. Every popup is denied. Public app popups open in the system
browser, including product paths. Desktop-origin popups load in the existing
window. Other HTTP(S) popup targets open in the system browser. Other schemes
are dropped.

## Development

`npm run build` runs the app's `build:web` and `verify:web`, copies its export
into `bundle/web`, writes `bundle/build-config.json` through the app image's
configuration writer, `infra/docker/app-build-config.mjs`, generates site
segments and compiles `src` into `dist`.
It uses `EXPO_PUBLIC_MKC_API_ORIGIN`, `EXPO_PUBLIC_MKC_APP_ORIGIN`,
`MKC_CATALOGUE_BASE_DOMAIN`, `MKC_BUILD_SHA` and `MKC_DESKTOP_UPDATES`. Only
`MKC_DESKTOP_UPDATES=enabled` writes `updates: true` into
`bundle/build-config.json`, which turns the updater on. Local builds default to ports
8080/8081, `catalogue.mokly.example` and the current Git revision. Release
builds must supply their target environment inputs.

An unpackaged run can use `MKC_DESKTOP_DIST` and
`MKC_DESKTOP_BUILD_CONFIG` for another export and its metadata. Its optional
`MKC_DESKTOP_CATALOGUE_SOURCE` accepts only `http://*.localhost:<port>`.
Packaged builds ignore all three variables. Their CSP matches the app server
with `'self'` resolved to the desktop origin. Escaping paths return 404;
malformed percent escapes return 400. There are no health/config endpoints.

```sh
npm run test:logic --workspace @mokly-cloud/desktop
cargo xtask check --suite cloud-desktop
```

The `cloud-desktop` suite runs the logic tests, the build, then the Playwright
Electron smoke.
Linux uses `xvfb-run -a`. It needs Postgres, Python, the Playwright Chromium
browser and Electron's GTK 3, NSS and ALSA libraries. On Ubuntu, install
Playwright system dependencies and `xvfb`. On Amazon Linux 2023, install
`xorg-x11-server-Xvfb`, `gtk3`, `nss` and `alsa-lib` with `dnf`.
The suite reuses the app's real API/catalogue harness. It first opens the
shell with the API stopped, then starts its isolated stack. It tests the
Origin header, persistent session cookie, desktop grant handoff, viewer limit, catalogue
admission, navigation and the share action's write to the system clipboard.
It presses **Continue in browser**, captures the connect address, issues a grant
through the real browser page and API, and delivers it through a second launch.
It also opens a used grant, then a valid grant on the same callback route, and
proves that a new document signs in.
It reads the clipboard from the main process and awaits the result. It saves
screenshots under `.context/m5/`.
`MKC_API_PORT`, `MKC_APP_PORT`, `MKC_CATALOGUE_PORT` and `MKC_STRIPE_PORT`
move the complete stack when the default ports are busy. Rebuild after
changing ports because Expo bakes the API origin into the export.

Installs that never run Electron set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
The desktop CI job caches the Electron download. The app image's build
context excludes the desktop bundle, release output and test runtime.

### Releases

[The release workflow](../../.github/workflows/desktop-release.yml) packages
macOS arm64 and x64 as DMG and ZIP, and Linux x64 as AppImage and DEB. It uses
`electron-builder.yml`; the Linux executable is `mokly`. Package names hold no
version, for example `Mokly-mac-arm64.dmg`.
[Latest release](../../docs/protocol/cloud/desktop-distribution.md#latest-release)
lists the fixed names.

The app icon comes from `build/icon.svg`. `build/icons/` holds its renderings
at the freedesktop sizes from 16 to 512 px and the 1024 px master. macOS
packages the master, and electron-builder derives the `icns` sizes from it.
Linux packages the whole set.
After a change to the SVG, run `npm run icon:build --workspace @mokly-cloud/desktop`
from the repository root. A logic test rejects a PNG that differs from its source.

Pull requests that change package inputs build for main-preview without release
credentials or publishing. The macOS package uses an ad-hoc signature with
hardened runtime and notarization disabled. Each runner extracts the arm64 ZIP
or Linux AppImage and runs `scripts/packaged-smoke.mjs` with Playwright. It
proves the asar bundle renders **Try again** when the API is unreachable.
It checks the window overlay and the app's inset on both platforms. On macOS
it also attempts a native window screenshot that includes the buttons. The
proof JSON records a capture failure without failing the smoke. The page
screenshot stays available.
Linux needs `xvfb-run`. Package artifacts are `desktop-macos` and
`desktop-linux`; launch evidence is `desktop-smoke-macos` and
`desktop-smoke-linux`, retained for 14 days.

Releases come from the desktop release pull request. On each push to `main`,
Release Please updates it from the commits that change `packages/`, except the
npm CLI and native packages. Merging it writes the version into `package.json`
and `CHANGELOG.md`, and creates the tag `desktop-v<version>` on the merge
commit. [The release workflow](../../.github/workflows/release.yml) then checks
that the tag names that commit, and calls `desktop-release.yml` with the tag and
the commit. That job runs in the `desktop-release` environment, builds for
production with the updater on, signs and notarizes on macOS, and uploads to
one draft release of `mokly-ai/mokly-desktop`. The draft uses `v<version>`,
which matches the updater's release-page address. Both platform publishers run
in sequence. The `promote` job then checks the complete draft and makes it the
latest release. Manual dispatch runs preview packaging only.

When the tag check fails, move the tag to the release commit that the error
names, then rerun the failed jobs:

```sh
git push --force origin RELEASE_COMMIT:refs/tags/desktop-vX.Y.Z
gh run rerun RUN_ID --failed
```

Release packaging builds into a fresh directory with publishing off, then
uses the pinned GitHub publisher through an append-only upload hook. The first
platform creates the draft `v<version>`, and the second reuses it. The
publisher fails when a release that is not a draft already has the tag. It
removes `EP_GH_IGNORE_TIME` from its environment. It also removes
`EP_PRE_RELEASE` and `EP_PRELEASE`, because either would make the draft a
public pre-release before the check.

A platform job fails on an existing asset name, a skipped upload or any built
file missing from the asset list of the draft. The check also requires that
the release is still a draft with that tag, and the uploaded size and
completed state of each file. Each platform job then uploads a manifest of the
release, the tag, and the names and sizes that it checked, as the workflow
artifact `desktop-release-macos` or `desktop-release-linux`. Uploaded assets
are never replaced or deleted.

The `promote` job needs both platform jobs. It runs in the `desktop-release`
environment and installs no npm package. It reads both manifest artifacts. It
then requires one release, the tag `v<version>` of `package.json`, exactly the
fixed names of both platforms, each recorded size and the `uploaded` state. It
makes the draft a full release marked latest, then checks that GitHub's latest
release has the same id.

Rerun the failed jobs when the failed platform uploaded nothing. The rerun also
runs the skipped `promote` job. After a partial upload, the draft never becomes
latest. Release a new version through the next release pull request. Do not
delete assets or rerun an old release to repair it.

When the `promote` job fails, rerun the failed jobs. The promotion changes
nothing in a release that is already full, and it checks the latest mark
again.
[Drafts and promotion](../../docs/protocol/cloud/desktop-distribution.md#drafts-and-promotion)
says which failures can leave a full release.

Both modes derive origins from `MKC_DOMAIN` and `MKC_CATALOGUE_BASE_DOMAIN`
repository variables through the deployment domain helpers. The release
workflow passes the resolved origins, environment-specific catalogue domain and
Git revision to `scripts/build.mjs`. Release secrets are listed in
[Secrets](../../docs/ops/secrets.md#desktop-release-secrets). The packaging
script writes the Apple certificate and API key to private temporary files.
The builder reads their paths and other secrets only from its environment.
Fork pull requests receive no repository variables. Their preview build uses
the domain of the existing package homepage and reads the public main-preview
`/_config` for the catalogue domain. It then uses the same deployment helpers.
The fallback needs the deployed app's public metadata, but no API or secret.

### Key Code

- [Composition root](./src/main.ts)
- [Export handler](./src/export-handler.ts) and [configuration](./src/config.ts):
  `contentSecurityPolicy` is the policy of `infra/docker/app-server.mjs` with
  `'self'` as the desktop origin, and a contract test holds the two equal.
- [Desktop origin](./src/origin.ts): `DESKTOP_ORIGIN`, the literal that
  `client_origins::DESKTOP_ORIGIN` of `mkc-domain` owns. A contract test pins it
  to the shared [desktop origin fixture](../../fixtures/desktop-origin.json).
- [Navigation policy](./src/navigation.ts) and [handoff](./src/handoff.ts)
- [Site segments](./src/site-segments.ts): the public site's first path
  segments, which [the generator script](./scripts/site-segments.ts) writes
  with `apps/site/scripts/generate-site-segments.ts`. A contract test holds them
  equal to the Worker's copy.
- [Permission policy](./src/permissions.ts)
- [Window](./src/window.ts), [lifecycle and startup](./src/lifecycle.ts) and [menu](./src/menu.ts):
  `createWindow` hides the Mac title bar and lets the overlay follow the native
  button position. Linux keeps its native frame and default zoom roles.
  `startDesktop` owns startup, Dock activation and second-instance delivery.
- [Mac window buttons](./src/window-buttons.ts): `windowButtonPosition` owns
  the initial and zoomed positions for the app's 48px top bar.
  `installWindowButtons` follows zoom, navigation and full-screen exit.
  `zoomMenuItem` supplies the three Mac zoom commands with the default labels,
  accelerators and half-level steps.
- [Safe main-process diagnostics](./src/diagnostics.ts)
- [Updater](./src/updates.ts) and the
  [move to Applications offer](./src/install-location.ts)
- [Build](./scripts/build.mjs) and [Electron smoke](./src/_tests_/desktop.spec.ts)
- [App icon source](./build/icon.svg) and [icon renderer](./scripts/icon.mjs)
- [Release inputs](./scripts/release-environment.py), [packaging](./scripts/package.mjs)
  and [packaged launch](./scripts/packaged-smoke.mjs)
- [Release asset checks](./scripts/release-assets.mjs): the check of each
  platform's built files against the draft.
- [Append-only publisher](./scripts/release-publisher.mjs): the pinned GitHub
  publisher with an upload hook that only adds assets.
- [Promotion check](./scripts/release-promote.mjs): the `promote` job's check
  of the complete draft, its promotion and the latest check.
- [GitHub client](./scripts/release-github.mjs): reads, append-only asset
  uploads and the one release promotion. It imports no npm package, and it
  has no operation that deletes or changes an asset.

### Related Docs

- [Desktop contract](../../docs/protocol/cloud/desktop-app.md)
- [Desktop distribution](../../docs/protocol/cloud/desktop-distribution.md)
- [App npm workspace](../app/README.md)
- [Repository verification](../../docs/protocol/cloud/repository-verification.md)
