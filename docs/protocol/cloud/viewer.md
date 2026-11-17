# Publication Viewer

The viewer is the application: once signed in with a project, the user is
always inside it, and one viewer serves standalone browsing and pull request
links. The app hosts the exact-pinned `@mokly/viewer` and fills its slots with
workspace and project switching, branch and pull request selection,
publication history, share, settings and the account menu; the package owns
Browse, Changes, search, screen rendering, comparisons, viewport and theme.
There is no separate project or workspace page: the viewer's slots carry
workspace, project and publication switching, so a list page outside the
viewer would duplicate them and take the reader out of the publication. See
[Navigation](./product-navigation.md) and [Product mockups](./product-mockups.md).
Canonical viewer addresses are `/:workspace/:project/publications/:publicationId`.
Branch and pull-request routes, share links and project rows use the current
slugs returned by the API. UUID permalinks and retired slugs replace the
address with its current spelling while preserving viewer query state.
Comments and approvals are deferred; their drafts remain in
[Comments](./screen-comments.md) and [Approvals](./approvals.md).

## Package Host

[Viewer host](./viewer-host.md) defines the cloud boundary around the pinned
package: the controlled selection, the resolved `theme`, the index and detail
sources and the frame boundary of each publication, the stylesheet and token
mapping, the consumed `onError` codes and the version failure.

## Private Artifact Limit

The app reads the catalogue index and every entry detail itself, with the
catalogue cookie for a private catalogue, and passes them to the package as
objects, as [Viewer host](./viewer-host.md#sources) defines.
The pinned viewer sends its own reads with `credentials: "omit"`, and its root
React API has no transport for them. These reads are the documents of a pinned
comparison, which its Side by side, Overlay and Difference modes present,
and documents of a removed entry's previous version. For a private catalogue
they answer 401 even after the access exchange succeeds.

Public catalogues, including their comparisons and previous versions, are
supported, and so is the current content of a private catalogue in the app.
Private comparisons and previous versions stay unavailable in the embedded
viewer. The standalone shell sends same-origin cookies, but needs a cookie
in its own browser store. Embedded comparisons and previous versions wait for
a published viewer that documents a transport for every package-owned read.
Cloud must not patch the package, replace global `fetch`, deep-import
internals or expose private files.

On the documented `comparison` error for a private publication, the host
covers the stage with a `stageOverlay` message that says comparisons of
private publications are unavailable. The message has no action and stays
until the selection changes. The package's own controls stay
usable around it. A previous version that fails to load stays in the package's
own unavailable state with its Retry, because the package reports no host
error for that read.

Decision: neither this overlay nor the blocked-cookie message of
[Catalogue isolation](#catalogue-isolation) offers the catalogue in a new tab.
The standalone shell needs its own catalogue cookie. A browser that refused
the app's cookie has none for that tab either.

## Slot Inventory

[Viewer chrome](./viewer-chrome.md) defines the two package slots, six cloud
actions, compact More menu, overlay ownership, focus handoff and publication
context.
The empty stage and a build card's plan refusal share its
[workspace-role read rule](./viewer-chrome.md#workspace-role) through
one function, `workspaceRole()`, so the two cannot disagree about who is an
owner.

## Address And History

[Viewer address state](./viewer-address-state.md) defines publication and alias
resolution, every selection query key, validation, panels, settings and browser
history, including that an unavailable current-only screen list means unknown
membership, never an empty catalogue.

The switcher and Share follow API cursors in returned order through at most
20 pages of 50 rows: 1,000 rows per list. Share uses all loaded screen items
for its choices and screen-link validation. When a capped list does not
contain the selected screen, Share keeps the publication-level link and leaves
viewer selection unchanged. It adds no visible notice or new UI state.

A failed publication opens as its own details, never as an absent catalogue:
one heading naming the branch and one sentence of recovery chosen from the
persisted failure classification, in the reviewer's terms. The developer's half
— paths, versions, validation names — stays in the check run and the CLI, per
[Product copy](./product-copy.md).

A pull request's waiting card is
**No publication yet** with “Publishing starts when this pull request’s check
runs.” and Choose another branch. The
[reference stage order](./viewer-builds.md#references-without-a-ready-publication)
selects it only while the plan allows publishing and the project cannot
build. When publishing is refused, that same order selects the Team card,
including for an open pull request from the project's repository, under its
workspace-role rule.
[Viewer builds](./viewer-builds.md#reference-cards) owns the closed and fork
card copy. The [lifecycle](./cloud-builds.md#availability-and-eligibility)
allows an already queued or running build to publish after its pull request
closes; it refuses new builds for the closed pull request.

## Catalogue Isolation

The API supplies a validated catalogue URL on a per-publication subdomain of
the configured catalogue origin, which is the host's catalogue origin. The app
reads the catalogue index and entry details from that origin, and the package
renders each screen in a frame sourced from it.
Publication HTML never comes from the app or API origin. Screen frames use
`sandbox="allow-scripts allow-same-origin"`, a descriptive title and
`referrerpolicy="no-referrer"`; same-origin permission is safe only because the
catalogue host differs from the app and every other publication. Do not allow
top navigation, popups, downloads or forms by default. External actions that
need these capabilities belong in app chrome or a separately authorized flow.
The app's Content Security Policy names the catalogue domain, which is the
wildcard `*.<catalogue domain>` of
[Catalogue hosting](./catalogue-hosting.md#origins-and-routes): `frame-src` for
the screen frames the package mounts and `connect-src` for the grant exchange,
the confirmation read, the read-model requests and the comparison and
removed-preview documents the package fetches. The pinned viewer renders those
documents in script-disabled `srcdoc` frames at the app origin, where they
inherit the app's policy, so `img-src`, `font-src` and `style-src` name the
catalogue domain too, for the images, fonts and stylesheets the documents load
from their publication's host, and `style-src` keeps the `'unsafe-inline'`
their generated inline styles need. The policy adds no script source and no
other host; a resource either kind of document loads from anywhere else stays
blocked, as it is in the catalogue's own frames. The catalogue domain is the
`MKC_CATALOGUE_BASE_DOMAIN` release input, recorded at build time beside the
origins baked into the bundle; the static server accepts no second runtime
setting for it. The final app header, including `frame-ancestors 'none'`, is
the one below; the desktop shell sets the same policy for its pages, with
`'self'` as the desktop origin:

```text
default-src 'self'; frame-src 'self' <app origin> <API origin> https://*.<catalogue domain>; connect-src 'self' <app origin> <API origin> https://*.<catalogue domain>; img-src 'self' data: https://*.<catalogue domain>; font-src 'self' https://*.<catalogue domain>; style-src 'self' 'unsafe-inline' https://*.<catalogue domain>; frame-ancestors 'none'
```

Catalogue responses restrict their own
`frame-ancestors` to `'self'`, the exact app origin and, when admitted, the
desktop origin. Self-framing is needed
only for the package's standalone shell to render documents from that same
publication origin; it does not let one publication frame another. CORS
separately allows only the exact app origin and admitted desktop origin for
cross-origin read-model requests. Hosting
defines the final headers.

For a private catalogue, obtain a short-lived, one-use access grant through the
authorized API; exchange it at that publication's host for a host-only secure
HttpOnly cookie before mounting. Only that exchange, the app's `POST /_access`,
sets the catalogue cookie. Where the browser refuses it, no other tab or page
of the catalogue host has it either. Confirm the exchange by reading the
catalogue root from that host once: a browser that refuses the cookie answers
exactly as an expired one does, and only that confirmation tells a retry that
will work from one that cannot. Readiness belongs to the exact project,
publication, access mode and attempt being rendered: navigation immediately
returns to the granting state, and a previous or late grant result cannot
mount a new source. A public catalogue skips the exchange entirely, and the
app reads its index and details without credentials. Never pass
the app session to the catalogue origin or use a wildcard-domain
authentication cookie. Only after private confirmation does the app read
`mokly-viewer/index.json` and the entry details with credentials, and it
renews the exchange as the [host sources](./viewer-host.md#sources) define.
A refused or expired grant exchange stays in the retryable
access state. A browser that refuses the cookie gets a final message with no
action, because nothing inside the app can give that browser the cookie.
The [private artifact limit](#private-artifact-limit) records
why it offers no new tab.

## Frame Access

The package's frame adapter is the only code that looks inside a screen frame.
Cloud uses public `postMessageAdapter`, which talks to the
Mokly-owned frame probe script embedded in published screens over postMessage
with an exact origin, a per-mount session nonce and bounded message shapes.
The app never injects scripts into publication HTML, inspects the frame DOM,
or invents a URL convention for preselection. It sets
`sandbox="allow-same-origin allow-scripts"`, adds `mokly-host`, and accepts
messages only from the exact frame origin with its per-mount nonce.
User-authored HTML is untrusted even after a valid handshake; every write
revalidates server-side.

## Native Surfaces

The viewer is DOM code: a non-web build never mounts the package in a React
Native tree. The desktop shell of [Desktop application](./desktop-app.md)
serves the export from its own origin, which the catalogue hosts admit for
CORS and framing. The cloud chrome, read model, grant exchange and catalogue
cookie work in the shell. The pinned viewer's `postMessageAdapter` accepts
only an HTTP or HTTPS host, and the inspector that the CLI embeds in published
screens also rejects any other host. Screen frames therefore do not mount in
the shell. Initial script-disabled HTML can be visible while the package
reports its frame error; the adapter and inspector stay unavailable. The shell
adds no viewer code or package workaround. An upstream release and separate
pin bump will enable frames. Publish screens again with the new CLI so their
embedded inspector accepts the desktop host.
Future iOS and Android surfaces open the web viewer route in a WebView with
native chrome. The WebView receives the same access-grant cookie exchange as
the browser and never the app session. No mobile host, bundle or native
Browse/Changes implementation ships in this scope; the web route, slots and URL
contract are the boundary a later native header drives.

## Mockup Representation

[Viewer chrome](./viewer-chrome.md#mockup-representation) and
[viewer inventory](./product-mockups-viewer.md) define both viewport/scheme
mockups, cloud overlays and failure drawings. The ready stage is a static
depiction composed of `@mokly/ui` parts, with a sample screen in its frames.
