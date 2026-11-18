# Viewer Host

This is the package-host sub-contract of [Viewer](./viewer.md). It defines
what the cloud guarantees to the workspace `@mokly/viewer`
and what the reader sees when the package reports a version
failure. The reads the package cannot authenticate are in the
[private artifact limit](./viewer.md#private-artifact-limit), and the origin,
frame and access rules are in
[Catalogue isolation](./viewer.md#catalogue-isolation).

## Package Host

The host is the cloud boundary around the workspace package.
It is controlled: the route supplies the complete selection and writes every
`onSelectionChange` proposal back to the address. The package owns Browse,
Changes, its rail, frames and their loading, empty and unavailable
presentation. The cloud owns publication state, the access exchange, the
catalogue index and detail reads, routing and the chrome placed in the package
slots. Only a ready publication mounts a catalogue; every other
state shows one cloud-owned card in the stage beneath the same slot bar.

The host passes the package a complete selection: an optional entry path, the
optional snapshot identity of a removed record, the view, the viewport, the
preview scheme, the search text and the tags. The entry path names any
catalogue entry; a screen or component variant has its own path, so there is
no variant field. The snapshot identity is the package's opaque identity of
the one removed record the reader is looking at. An absent snapshot is
omitted, because the package refuses a selection with a key it does not know.
The mapping between the address and the package selection is lossless in both
directions. [Viewer address state](./viewer-address-state.md) defines the URL
grammar and the history rules, and [Viewer catalogue](./viewer-catalogue.md)
defines the index and the details. The package takes no root identifier, so
the host passes none.

The package draws its own top bar, rail and stage chrome around the cloud
slots, so its interface follows the app chrome. The host passes the app
chrome's resolved scheme as the package `theme`, never the package's `auto`,
so the package chrome and the cloud controls it holds always come from one
value. `theme` is independent of the selection's preview scheme, which chooses
the preview documents and stays the reader's address state; a change of
`theme` keeps the mounted runtime, frames and selection.

### Sources

The package takes an `index` source and a `detail` source, and the
host passes both as objects that it read itself, for public and private
catalogues alike. The host reads them from the paths that
[Viewer catalogue](./viewer-catalogue.md#fetch-and-version-gate) gives, and
it passes the index with `baseUrl` set to the root of the catalogue origin.
The package asks the `detail` source for one entry at a time,
by entry path, and adds the `snapshotId` of a removed record. The host answers
with the current or removed entry detail that it reads. Each
read omits credentials for a public catalogue, includes them for a private
catalogue only after its access exchange has been confirmed, and rejects
redirects to another origin and unsuccessful responses. A
private detail read that answers 401 runs the access exchange once more and
repeats the read once, because the catalogue cookie lives 300 seconds and
details load during navigation. Decision: the host reads the
index and the details itself rather than passing their URLs, because the
package reads a URL source without credentials. It does so for
a public catalogue too, so one credential policy covers both visibilities.

While the index read runs, the stage shows the same pending card as the
access exchange. A failed index read shows a cloud error card
with **Try again**, which repeats the access exchange of a private catalogue
and then the index read.

The host keeps one source, the index it read and its `detail` function, for
one publication origin and access policy, in memory only. The
source changes only when the publication origin or the access policy changes,
and the `postMessageAdapter({ frameOrigin: catalogueOrigin })` frame boundary
changes only with that origin; the package runtime remounts only when one of
them changes. A query-only Back that reconstructs the route keeps the same
source and its version failure.

Link the public `@mokly/viewer/styles.css` export once, and serve the font
bytes it declares unchanged beside it. The containing host maps Folio's
shared tokens only through `--mokly-accent`, `--mokly-accent-contrast` and
`--mokly-accent-soft`; package selectors, geometry and internal `--chrome-*`
variables are not extension points. The visible desktop rail spends the
package's one solid selection fill. At compact widths the closed rail leaves
no large solid accent visible; the cloud does not promote an unrelated action
merely to fill that budget. The app does not deep-import package rendering
code.

The package has no ready or loading callback, and the host does not
manufacture lifecycle events. Cloud consumes only the documented `onError`
codes: `catalogue`, `version`, `selection`, `frame`, `comparison` and
`markers`.

### Version Failure

The public readers check the version of the index and every detail.
They do not validate content. The
[reader contract](./mokly-artifact-compatibility.md#frame-boundary)
applies. They accept catalogue index 9 and entry detail 4 only, and reject any other
version before they use an entry or a path. On a rejected
version the package draws its own headline, without an action and without
host slots, and reports `onError({ code: "version", message, details })` with
that headline as `message` and the typed diagnostic as `details`.
The diagnostic names the boundary, `catalogue`, `detail` or
`live`, the version and the supported version.

The host latches every `version` error against the current source, whether
the index or a detail caused it. It stops rendering the package for that
source and renders the cloud stage card inside cloud chrome. Selection and
theme changes do not clear the failure. Ignore late errors from another
source. A new source clears the failure; **Reload** reloads the browser
document at the same complete URL.

**Named copy exception: Upstream viewer version failure.** The packaged
`mokly-viewer-namespace.md` contract gives every host one headline for a
version failure: **This catalogue needs a compatible viewer**. The card uses
that headline exactly, with no supporting sentence, and offers one action,
**Reload**, because a reload loads the app's current viewer.
This named exception to
[Product copy](./product-copy.md#upstream-viewer-version-failure) keeps the
upstream headline unchanged. Put optional `ViewerError.details` as plain text
in a closed **Details** disclosure; omit that disclosure when details are
absent. Do not invent an API request reference.

The sibling `product/viewer/standalone/version` depicts this card in both
viewports and schemes. The `product/viewer/standalone/error` screen
links to it with a catalogue-only `MockLink` below the artboard.
The drawing and the app use the same version-failure card.

For `code: "catalogue"`, keep the package's own unavailable state and its
**Try again**; do not latch a cloud version failure. A publication without
`mokly-viewer/index.json` fails the host's index read, not the version gate.
