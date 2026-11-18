# Desktop Application

`apps/desktop` is the installed desktop surface of Mokly Cloud: an Electron
shell that ships the web application's export inside its package, serves it
from its own origin and adds the operating-system integration a browser tab
cannot give. It is the desktop half of the native phase in
[Product direction](../../product-direction.md). It ships for macOS and Linux
first; Windows is a later change.

The shell contains no product screens, no React Native and no second viewer.
Every page is the same export of [`apps/app`](./web-app.md) that the app image
serves, built with the same two baked origins; the shell adds the window, the
page's origin, the navigation policy, the scheme handoff and the updater, and
never reads the session cookie or the CSRF token. The product therefore opens
without the network, which local mode needs. Local mode lands in a later plan
after Mokly gains a serve contract for a host program, with the public
download page; until then the shell publishes pre-releases only.

Read [Web application](./web-app.md) for the export it serves,
[Authentication and sessions](./auth-sessions.md) and
[Authentication callbacks](./auth-callbacks.md) for the origin admission and
the sign-in handoff, [Catalogue hosting](./catalogue-hosting.md) and
[Viewer](./viewer.md) for the catalogue isolation the window preserves, and
[Repository layout](./repository-layout.md) for the npm workspace and pins.

## Packages And Pins

The npm workspace is `@mokly-cloud/desktop` under `apps/desktop`, installed from
the single `package-lock.json`. Its exact pins are in
[`apps/desktop/package.json`](../../../apps/desktop/package.json). `electron` 44.11.3
bundles Chromium 152 and Node 24.22.2.
A bump of `electron` records the Chromium major it bundles, and the
Electron smoke test in [desktop verification](./desktop-distribution.md#verification) is what proves the viewer on
that engine.

The web export is a build input, never a runtime download. The shell's build
runs the application's `build:web` and `verify:web` with
`EXPO_PUBLIC_MKC_API_ORIGIN` and `EXPO_PUBLIC_MKC_APP_ORIGIN` set to the target
environment's API origin and public app origin, takes
`MKC_CATALOGUE_BASE_DOMAIN` for the
[page policy](./desktop-bundle.md#origin-and-export), and records the three values
and the revision in a `build-config.json` inside the package with the shape
of the app image's build configuration. A packaged build reads no
environment override; an unpackaged development run takes
`MKC_DESKTOP_DIST` and `MKC_DESKTOP_BUILD_CONFIG` to point at a local export
and its configuration. Its optional `MKC_DESKTOP_CATALOGUE_SOURCE` accepts only
`http://*.localhost:<port>` for the local catalogue server. Packaged builds
ignore these three variables and use the app server's production CSP unchanged.

## Bundle And Origin

[Desktop bundle and origin](./desktop-bundle.md) defines the privileged
`mokly-app` scheme and the **desktop origin**, `mokly-app://desktop`, from
which the shell serves the export, its renderer settings and its window
lifecycle.

## Current Viewer Limit

The viewer route, the cloud chrome and the catalogue reads work in the shell,
but the viewer's `postMessageAdapter` accepts only an HTTP or HTTPS
host and rejects the desktop origin with `FrameError("origin")`. The
inspector that the CLI embeds in published screens also rejects that host.
Managed screen frames do not mount in the shell today. Initial
script-disabled HTML can still appear in a frame; the adapter and inspector
stay unavailable. The smoke test asserts
that failure, so a package fix requires a deliberate test update. No package
code is patched or wrapped. A change to the workspace viewer and frame probe
will enable frames, with that test update; existing screens must be published
again with a CLI that carries the change, so their embedded inspector also
accepts the desktop host.

## API And Catalogue Admission

The page is cross-site to the API and to every catalogue host, so three
server contracts admit the desktop origin beside the app origin when
`MKC_DESKTOP_CLIENT` is `true`; when it is absent or `false`, the desktop
origin is refused everywhere. Only exact `true` and `false` are accepted;
every other value stops startup with a typed configuration error. Both
servers share one admitted-origin set, and a shared fixture pins its desktop
origin literal.

- **Origin checks and CORS.** Every Origin check of
  [Authentication and sessions](./auth-sessions.md#csrf-origins-and-redirects),
  including public magic-link issue and the callbacks, accepts the app origin
  or the desktop origin. CORS permits credentials for exactly those two
  origins, echoes the matching one and sends `Vary: Origin`; it never reflects
  another origin.
- **Session cookie.** A session issued to an exchange whose Origin is the
  desktop origin carries `SameSite=None` in place of `Lax`, with every other
  attribute unchanged, because the desktop page's requests to the API are
  cross-site and a `Lax` cookie would never travel. Magic-link, preview and
  GitHub exchanges, rotation with `POST /v1/session`, and sign-out with
  `DELETE /v1/session` select `SameSite` from that request's Origin. The
  cookie lives only in the shell's own cookie store.
  A catalogue frame inside the window is the untrusted party: a mutation it
  attempts fails the Origin and CSRF checks, and a read it attempts is blocked
  by CORS before any byte reaches it.
- **Magic link.** A link requested with the desktop Origin is issued as
  `<app origin>/auth/email/callback?client=desktop#token=<secret>`; the query
  carries only `client`, and nothing else about links changes.
- **Catalogue hosts.** The catalogue server adds the desktop origin to
  `frame-ancestors` and to the CORS allowlist for the grant exchange, the
  confirmation read and the read-model requests, so catalogue reads, the access-grant cookie and plain catalogue frames work
  in the window. Only the window's own `POST /_access` sets the catalogue
  cookie, in the shell's cookie store. The system browser never holds it. The
  viewer rejects the desktop host before mounting its screen frames;
  see the [current viewer limit](#current-viewer-limit).

The local development servers set the flag, so an
unpackaged shell runs against the local stack; Chromium accepts the API's
`Secure` cookie from `http://localhost` there. The chart renders the flag for
every environment, and [Environments](../../ops/environment.md) records it.

## Navigation

Top-level navigation inside the window is allowed to the desktop origin and
to the three round-trip hosts that return to the product: `https://github.com`
for GitHub sign-in, connection and App installation, and
`https://checkout.stripe.com` and `https://billing.stripe.com` for billing.

A navigation or redirect whose target is on the public app origin is
rewritten: a path whose first segment belongs to the public site opens in the
system browser, and every other path loads `mokly-app://desktop` with the same
path, query and fragment in the window. The site segments are the inventory
that the site generates for the Worker, generated
into the shell as well, and a test holds the two copies equal. This rewrite
is how GitHub's callback, the App setup return and Stripe's return reach the
bundle: the GitHub App and Stripe keep the public origin as their return
address, and the shell cancels the redirect before any request reaches the
hosted server, so a code or state never leaves the window. The tab-scoped
GitHub flow record survives the round trip because the window is one browsing
context and the record belongs to the desktop origin.

Every `window.open` and popup is denied. Its target follows the same
public-origin rewrite and site-segment rule; a desktop product target loads
in the existing window. Other `http:` and `https:` targets open in the system
browser, including round-trip targets requested by a popup. Other schemes,
including `file:`, `smb:` and custom schemes, are dropped and never reach the
opener. Other top-level HTTP(S) navigation also opens in the system browser.

## Sign-In Handoff

Email sign-in sends a link, and an email client opens links in the system
browser, whose cookie store is not the shell's. The handoff moves the one-use
credential from that browser page into the shell through the `mokly` scheme,
which the app's Expo configuration already declares. Preview sign-in links stay
browser-only.

1. Inside the shell, the reader requests a link from `/sign-in` or
   `/sign-up`. The request carries the desktop Origin, so the API issues the
   desktop link form of the section above.
2. The browser opens the link. The entry removes the fragment and keeps the
   query, so the landing finds `client=desktop` in its address and the token
   in memory. Outside the shell it does not post the token; it renders the
   handoff state of
   [Authentication callbacks](./auth-callbacks.md#email-callback): the title
   `Finish signing in`, the one line
   `You requested this link from the Mokly app.`, the primary action
   **Open Mokly** and the secondary action **Continue in browser**. The page
   never triggers the scheme on its own.
3. **Open Mokly** opens `mokly://auth/email/callback#token=<secret>` in the
   same tab; the browser hands the address to the operating system and the
   page stays. **Continue in browser** posts the token as the ordinary
   landing does. The token is single use, so whichever action exchanges it
   first wins and the other reports `This link has already been used`.
4. The shell receives the address through the macOS `open-url` event or, on
   Linux, as an argument of the launch or of the second instance. It accepts
   exactly `mokly://auth/email/callback` with a fragment of one `token` whose
   value is 64 lowercase hexadecimal characters, the format the API issues.
   It creates or focuses the main window, loads `about:blank`, waits for that
   document, then loads
   `mokly-app://desktop/auth/email/callback#token=<secret>`. Every accepted
   handoff therefore starts a fresh callback document, even after a used or
   expired link left the window on the same route. The app entry captures the
   fragment before the router starts. The bundled landing exchanges the
   token with the desktop Origin and receives the desktop session cookie; it
   honours `client=desktop` only outside the shell. Any other scheme address
   is ignored. A token already received in this run is ignored. While the
   reset and landing exchange run, another token cannot navigate away from
   them. Reset navigation cannot release the guard. After the new landing
   commits, the main process records its callback POST's Electron request ID. Only that
   request's completion or failure, or navigation away from the landing,
   releases the guard. An older request or load failure cannot release a newer
   handoff. A reset or callback load failure warns and releases only its own
   attempt. Repeated
   **Open Mokly** presses therefore leave the shell in place.

The scheme is registered by the macOS bundle and by the `.deb` desktop entry.
An AppImage registers it only when the reader integrates the AppImage into the
desktop; **Continue in browser** is the recovery when nothing answers the
scheme. Another installed program can claim the same scheme on either
platform; the credential it could receive is single use, expires fifteen
minutes after issue, and grants nothing beyond one session, which the reader
can revoke from the Account pane. The handoff page renders no part of the
token as text.

GitHub sign-in, GitHub connection and App installation need no handoff: the
window navigates to GitHub and GitHub's return is rewritten into the bundle
by the navigation rule above.

## Distribution And Verification

[Desktop distribution and verification](./desktop-distribution.md) defines
packaging, the public update feed, release secrets and the tests of the
`cloud-desktop` suite.

## Local Mode

Local mode is the first version's purpose and lands in a later plan, after
Mokly gains a serve contract for a host program: start and stop, the local
address, the serving, ready and error states, and change events. The shell
starts the Mokly CLI for a chosen
checkout, hands the page the local address through one bridge method and adds
the loopback origin to the policy its handler sets. The viewer host accepts a
local source without a session, the branch switcher gains a Local entry and
Changes compares the local source with the published branch, so the product
works offline while the cloud controls that need the API show their error
states. The local server must admit the desktop origin as a frame ancestor
and for cross-origin reads, and serve the publication layout. Agent editing
is a separate phase with its own contract.
