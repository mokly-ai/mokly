# Desktop Package

The Mokly Cloud desktop surface is a small Electron shell for macOS and
Linux. It ships the Expo web export from `apps/app` and serves it from
`mokly-app://desktop`. It uses the same API, pages and cloud chrome as the
browser app.

## Responsibilities

- Open the product without a hosted page server.
- Keep the renderer isolated and catalogue HTML on its separate origin.
- Receive the `mokly` email sign-in handoff in one application instance.
- Keep window bounds and the Chromium session across launches.
- Check the public pre-release feed in packaged builds.

## What This Package Does

The main process serves bundled files, controls navigation, receives scheme
addresses and supplies the platform menu. It contains no product screen,
preload, renderer bridge or viewer implementation. Electron is pinned to
44.11.3, with Chromium 152 and Node 24.22.2. The package's exact pins are in
[`package.json`](./package.json). The builder and the updater use the public
`mokly-ai/mokly-desktop` GitHub feed, including pre-releases.
The updater is off in development. A packaged Linux app without `APPIMAGE`
offers the release page; it does not download or install an update.

Only the main frame on `mokly-app://desktop` can use
`clipboard-sanitized-write`. Requests and checks deny every other permission,
including clipboard reads and all subframe permissions.

Viewer 0.19.0 loads its catalogue index and cloud chrome in the shell, but
rejects its non-HTTP host when it mounts a screen frame. Screen previews need a
later Mokly release and a separate pin bump. The smoke test waits for the
catalogue index, records this limit and separately proves that catalogue CORS
and framing admission work.

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

The scripts enable `MKC_DESKTOP_CLIENT=true` on both servers. The log mailer
prints the hosted email link. Open that link in a browser, then select
**Open Mokly**. Scheme registration needs an installed package. For an
unpackaged launch, deliver its scheme address as a launch argument:

```sh
npm run start --workspace @mokly-cloud/desktop -- \
  'mokly://auth/email/callback#token=<64 lowercase hex characters>'
```

Each accepted handoff loads `about:blank` before the bundled callback. This
starts a fresh document after a used or expired link, so the app entry captures
the new token before the router starts. The guard stays active through this
reset. It matches the new callback POST by Electron request ID and ignores older request
and load failures. Tokens stay in the callback fragment.

## Development

`npm run build` runs the app's `build:web` and `verify:web`, copies its export
into `bundle/web`, writes `bundle/build-config.json` through the app image's
configuration writer, `infra/docker/app-build-config.mjs`, generates site
segments and compiles `src` into `dist`.
It uses `EXPO_PUBLIC_MKC_API_ORIGIN`, `EXPO_PUBLIC_MKC_APP_ORIGIN`,
`MKC_CATALOGUE_BASE_DOMAIN` and `MKC_BUILD_SHA`. Local builds default to ports
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
cargo xtask desktop
cargo xtask desktop-check
```

Stage 25 runs logic tests, the build, then the Playwright Electron smoke.
Linux uses `xvfb-run -a`. It needs Postgres, Python, the Playwright Chromium
browser and Electron's GTK 3, NSS and ALSA libraries. On Ubuntu, install
Playwright system dependencies and `xvfb`. On Amazon Linux 2023, install
`xorg-x11-server-Xvfb`, `gtk3`, `nss` and `alsa-lib` with `dnf`.
The suite reuses the app's real API/catalogue harness. It first opens the
shell with the API stopped, then starts its isolated stack. It tests the
Origin header, persistent session cookie, handoff, viewer limit, catalogue
admission, navigation and the share action's write to the system clipboard.
It also opens a used link, then a valid link on the same callback route, and
proves that a new document signs in.
It reads the clipboard from the main process and awaits the result. It saves
screenshots under `.context/m5/`.
`MKC_API_PORT`, `MKC_APP_PORT`, `MKC_CATALOGUE_PORT` and `MKC_STRIPE_PORT`
move the complete stack when the default ports are busy. Rebuild after
changing ports because Expo bakes the API origin into the export.

Installs that never run Electron set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
The desktop CI partition caches the Electron download. The app image's build
context excludes the desktop bundle, release output and test runtime.

### Releases

[The release workflow](../../.github/workflows/desktop-release.yml) packages
macOS arm64 and x64 as DMG and ZIP, and Linux x64 as AppImage and DEB. It uses
`electron-builder.yml`; the Linux executable is `mokly`.

The app icon comes from `build/icon.svg`. `build/icons/` holds its renderings
at the freedesktop sizes from 16 to 512 px and the 1024 px master. macOS
packages the master, and electron-builder derives the `icns` sizes from it.
Linux packages the whole set.
After a change to the SVG, run `npm run icon:build --workspace @mokly-cloud/desktop`
from `ts/`. A logic test rejects a PNG that differs from its source.

Pull requests that change package inputs build for main-preview without release
credentials or publishing. The macOS package uses an ad-hoc signature with
hardened runtime and notarization disabled. Each runner extracts the arm64 ZIP
or Linux AppImage and runs `scripts/packaged-smoke.mjs` with Playwright. It
proves the asar bundle renders **Try again** when the API is unreachable.
Linux needs `xvfb-run`. Package artifacts are `desktop-macos` and
`desktop-linux`; launch evidence is `desktop-smoke-macos` and
`desktop-smoke-linux`, retained for 14 days.

A tag `desktop-v<version>` must match `package.json`. It builds for production,
signs and notarizes on macOS, and publishes one pre-release to
`mokly-ai/mokly-desktop`. That public release uses `v<version>`, which matches
the updater's release-page address. Both platform publishers run in sequence.
Manual dispatch from a release tag does the same; dispatch from a branch runs
preview packaging.

Release packaging builds into a fresh directory with publishing off, then
uses the pinned GitHub publisher through an append-only upload hook. It keeps
the publisher's two-hour limit. It fails on an existing asset name, a skipped
upload or any built file missing from the final GitHub asset list. The check
also requires the uploaded size and completed state. Published assets are
never replaced or deleted; `EP_GH_IGNORE_TIME` stays disabled. Delayed recovery
needs a new package version and a new matching `desktop-v<version>` tag.
Do not delete assets or rerun an old release to repair it.

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
  `startDesktop` owns startup, Dock activation and second-instance delivery.
- [Safe main-process diagnostics](./src/diagnostics.ts)
- [Updater](./src/updates.ts)
- [Build](./scripts/build.mjs) and [Electron smoke](./src/_tests_/desktop.spec.ts)
- [App icon source](./build/icon.svg) and [icon renderer](./scripts/icon.mjs)
- [Release inputs](./scripts/release-environment.py), [packaging](./scripts/package.mjs)
  and [packaged launch](./scripts/packaged-smoke.mjs)
- [Release asset checks](./scripts/release-assets.mjs) and
  [append-only publisher](./scripts/release-github.mjs)

### Related Docs

- [Desktop contract](../../docs/protocol/cloud/desktop-app.md)
- [App npm workspace](../app/README.md)
- [Repository verification](../../docs/protocol/cloud/repository-verification.md)
