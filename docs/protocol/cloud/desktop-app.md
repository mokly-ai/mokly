# Desktop Application

`packages/desktop` is the installed desktop surface of Mokly Cloud: an Electron
shell that ships the web application's export inside its package, serves it
from its own origin and adds the operating-system integration a browser tab
cannot give. It is the desktop half of the native phase in
[Product direction](../../product-direction.md). It ships for macOS and Linux
first; Windows is a later change.

The shell contains no product screens, no React Native and no second viewer.
Every page is the same export of [`packages/app`](./web-app.md) that the app image
serves, built with the same two baked origins; the shell adds the window, the
page's origin, the navigation policy, the scheme handoff and the updater, and
never reads the session cookie or the CSRF token. The product therefore opens
without the network, which local mode needs. Local mode lands in a later plan
after Mokly gains a serve contract for a host program, with the public
download page; until then the shell publishes pre-releases only.

Read [Web application](./web-app.md) for the export it serves,
[Desktop sign-in](./desktop-sign-in.md) for the screens of browser sign-in,
[Authentication and sessions](./auth-sessions.md) and
[Authentication callbacks](./auth-callbacks.md) for the origin admission, the
desktop grant and its landing, [Catalogue hosting](./catalogue-hosting.md) and
[Viewer](./viewer.md) for the catalogue isolation the window preserves, and
[Repository layout](./repository-layout.md) for the npm workspace and pins.

## Packages And Pins

The npm workspace is `@mokly-cloud/desktop` under `packages/desktop`, installed from
the single `package-lock.json`. Its exact pins are in
[`packages/desktop/package.json`](../../../packages/desktop/package.json). `electron` 44.11.3
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
which the shell serves the export, its renderer settings, its window
lifecycle and the [Mac window](./desktop-bundle.md#mac-window).

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
  including public magic-link issue, the callbacks and the desktop grant
  exchange, accepts the app origin or the desktop origin. CORS permits
  credentials for exactly those two origins, echoes the matching one and sends
  `Vary: Origin`; it never reflects another origin.
- **Session cookie.** A session issued to an exchange whose Origin is the
  desktop origin carries `SameSite=None` in place of `Lax`, with every other
  attribute unchanged, because the desktop page's requests to the API are
  cross-site and a `Lax` cookie would never travel. Desktop grant, magic-link,
  preview and GitHub exchanges, rotation with `POST /v1/session`, and sign-out
  with `DELETE /v1/session` select `SameSite` from that request's Origin. The
  cookie lives only in the shell's own cookie store.
  A catalogue frame inside the window is the untrusted party: a mutation it
  attempts fails the Origin and CSRF checks, and a read it attempts is blocked
  by CORS before any byte reaches it.
- **Catalogue hosts.** The catalogue server adds the desktop origin to
  `frame-ancestors` and to the CORS allowlist for the catalogue grant
  exchange, the confirmation read and the read-model requests, so catalogue
  reads, the access-grant cookie and plain catalogue frames work in the
  window. Only the window's own `POST /_access` sets the catalogue
  cookie, in the shell's cookie store. The system browser never holds it. The
  viewer rejects the desktop host before mounting its screen frames;
  see the [current viewer limit](#current-viewer-limit).

The local development servers set the flag, so an
unpackaged shell runs against the local stack; Chromium accepts the API's
`Secure` cookie from `http://localhost` there. The chart renders the flag for
every environment, and [Environments](../../ops/environment.md) records it.

## Navigation

Top-level navigation inside the window is allowed only to the desktop
origin. No third-party page loads in the window, GitHub's and Stripe's
included, because the window cannot use the browser's sign-ins, as
[Sign-in](#sign-in) and [Billing](#billing) explain.

A navigation or redirect whose target is on the public app origin is
rewritten: a path whose first segment belongs to the public site opens in the
system browser, and every other path loads `mokly-app://desktop` with the same
path, query and fragment in the window. The site segments are the inventory
that the site generates for the Worker, generated
into the shell as well, and a test holds the two copies equal. The shell
cancels the navigation or redirect before any request reaches the hosted
server.

Every `window.open` and popup is denied. A popup whose target is on the
public app origin opens in the system browser, whatever its path, so the
pages that the app opens for [sign-in](#sign-in) and [web setup](#web-setup)
reach the browser's session. A screen link that the viewer opens as a popup to
the public app origin therefore opens in the system browser too. A popup whose
target is on the desktop origin loads in the existing window. Other `http:`
and `https:` targets open in the system browser. Other schemes, including `file:`, `smb:` and custom
schemes, are dropped and never reach the opener. Other top-level HTTP(S)
navigation also opens in the system browser.

## Sign-In

The app signs in through a Mokly page in the system browser, not in its
window, because the window cannot use the browser's sign-ins: its GitHub
session, saved passwords, passkeys and password-manager extensions. GitHub's
**Continue with Google** and **Continue with Apple** also leave the window, so
those sign-ins never return to it. Relaying GitHub's return into the window
was rejected, because a reader already signed in on the web would still pass
GitHub, and an installation would need two returns.

Inside the shell, `/sign-in` and `/sign-up` show the entry screen of
[Desktop sign-in](./desktop-sign-in.md), with no email form and no GitHub
action. Its action keeps a verifier in the window and opens
`/connect/desktop` in the browser. That page signs the browser in with any
method, and after **Open Mokly** it requests a one-use
[desktop grant](./auth-sessions.md#desktop-grants) bound to the verifier's
challenge. The grant returns through the [sign-in handoff](#sign-in-handoff),
and the [desktop landing](./auth-callbacks.md#desktop-callback) exchanges it
with the verifier for the window's own session.

## Sign-In Handoff

The grant reaches the shell through the `mokly` scheme, which the app's Expo
configuration declares. The scheme was chosen over a loopback listener or
polling for the browser's approval, because the scheme already exists and a
polled approval can be phished.

The shell receives the address through the macOS `open-url` event or, on
Linux, as an argument of the launch or of the second instance. It accepts
exactly `mokly://auth/desktop/callback` with a fragment of one `grant` whose
value is 64 lowercase hexadecimal characters, the format the API issues. Any
other scheme address is ignored. The shell creates or focuses the main window,
loads `about:blank`, waits for that document, then loads
`mokly-app://desktop/auth/desktop/callback#grant=<grant>`. Every accepted
handoff therefore starts a fresh landing document, even after an expired
grant left the window on the same route. The app entry captures the fragment
before the router starts, and the landing exchanges the grant with the desktop
Origin and receives the desktop session cookie.

A grant already received in this run is ignored, so repeated **Open Mokly**
presses, which deliver the same grant, leave the shell in place. While the
reset and the landing's exchange run, another grant cannot navigate away from
them, and reset navigation cannot release that guard. After the new landing
commits, the shell watches that landing's own grant exchange request. Only
that request's completion or failure, or navigation away from the landing,
releases the guard. An older request or load failure cannot release a newer
handoff. A reset or landing load failure warns and releases only its own
attempt.

The scheme is registered by the macOS bundle and by the `.deb` desktop entry.
An AppImage registers it only when the reader integrates the AppImage into the
desktop, so an AppImage that is not integrated cannot receive the grant. The
reader integrates the AppImage or installs the `.deb` instead. Another
installed program can claim the same scheme on either platform. The grant it
could receive is single use, expires at most five minutes after issue, and is
useless without the verifier, which never leaves the window.

## Web Setup

In the shell, each action that starts a GitHub trip opens its own page on the
web instead: **Connect GitHub** in the account pane, **Add GitHub account** in
the GitHub accounts pane, and **Install on GitHub** and **Continue on GitHub**
on the install screen. The action opens its route on the public app origin as
a popup, which the shell opens in the system browser: `/settings/account`,
`/:workspace/-/settings/github`, or the install screen's own address. In the
window each action keeps its label and carries the external glyph in place of
its own glyph, because it leaves the app. The reader finishes the action on
the web, where it applies to the account that the browser is signed in to.

Setup opens on the web for the same reason as sign-in. Keeping connection and
installation bound to the window's session through a relay of GitHub's return
was rejected, because it needs a second return mechanism beside the grant.

In the shell, the app reads the session and the GitHub connection and
installations of the open screen again whenever its window gets focus, so a
connection or an installation finished on the web appears without a reload.

## Billing

In the shell, **Upgrade to Team**, **Manage billing** and
**Update payment method** open Stripe's pages in the system browser. The
window's session asks the API for the Stripe session, so the payment applies
to the window's workspace. Each action carries the external glyph, and its
control returns to rest once the browser opens the page. Stripe returns to the
Billing pane on the public app origin in the browser. The window reads the
Billing pane again on focus, as [Checkout and Portal](./billing-subscriptions.md#checkout-and-portal) says.

Decision: Stripe opens in the browser, where saved cards, Apple Pay and Google
Pay work. Stripe in the window was rejected, because the window has none of
them. The Billing pane on the web was rejected, because its payment would
apply to the browser's account, which can differ from the window's.

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
