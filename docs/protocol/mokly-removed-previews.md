# Removed Content Previews

## Delivery Status

The [removed content previews plan](../../plans/removed-content-previews.md)
delivered typed capture, the Serve generation lifecycle, consumer export,
repository preview, upload packaging, and the shared shell and viewer. The
[viewer-owned historical previews plan](../../plans/viewer-owned-historical-previews.md)
defines the host-independent presentation below. Nothing here changes ordinary
browsing, Added entries, changed-screen comparisons, or removed component
variants.
The public catalogue fixture migration described below was planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestone 7. The current fixture and reader use v2.

The note for a selected viewport with no captured historical view is fixed
here and depicted by the design catalogue's
[no-captured-view screen](./mokly-shell-design.md#design-mockups).

## Behavior

Opening a removed screen or registered page shows the version from the pinned
Changes baseline: the same branch-point commit that produced its Changes row,
in committed or [derived](./mokly-derived-baselines.md) mode. The heading keeps
its Removed badge, breadcrumbs keep the textual baseline ancestry, and Details
keeps its historical metadata. A quiet label above the stage reads “Showing
previous version.” No Current selector, comparison band, refresh control, Props
editing, current inspector bindings, or current usage/comment markers appear.

A removed page renders its historical document in the plain document pane. A
removed screen renders its historical mobile and desktop frames; Light and Dark
choices follow the historical views that exist. A saved scheme without a
historical view falls back to Light with the existing light-only note. Removed
screens stay outside comparison modes; incoming comparison URLs are declined as
today. Removed component variants keep their existing comparison behavior.

A selected viewport with no captured historical view shows a note where its
frame would be, never a blank stage. The note reads “No previous mobile version
was captured. Switch to Desktop to see it.”, exchanging the two viewport names
for the desktop case. A preview carrying no views at all is unavailable
instead, so the viewport the note names always holds a view. Selecting both
viewports already puts that view on the stage beside the note, so only the
first sentence is shown there. The note carries the `mbk-preview-note` class and
its closing sentence the `mbk-preview-switch` class, the classes the design
catalogue's stage stylesheet owns, and the second sentence is hidden rather
than rewritten while both viewports are selected.

Historical content is read-only in every host, including a viewer embedded
across origins. Scrolling, text selection, and same-document anchors work, but
the guard scrolls to anchors without changing the document URL, so `:target`
styling does not apply. Forms cannot submit, and every link is inert: marked
catalogue links, portable relative links, and external links do nothing, so old
links cannot open current content or leave the preview. Historical documents
keep the script-disabled sandbox and existing external-resource policy;
external HTTP(S) resources load as they did, without offline copies.

The preview is requested when the removed entry is selected, in development and
in static delivery alike. Ordinary browsing, All/Changes filtering, search,
navigation, and evidence updates never request historical bytes. A served or
packaged shell arrives holding “Previous version unavailable” without a Retry
control, because a shell whose browser client never runs cannot honour that
action. The client's first update replaces that with “Loading previous
version…” and then with the previous version. A client-side failure returns to
“Previous version unavailable” with Retry while the catalogue stays usable.
Current bytes, current fragments, or invented content never stand in for
missing history. Catalogues published without Changes have no removed entries
and therefore no previews.

## Screens Reuse The Comparison

A removed screen's previous views are the `before` views of its existing
comparison. The comparison engine already captures every baseline fragment as
`snapshots/before/<route>` with its transitive resources, the selected endpoint
accepts a before-only route, and Changes-enabled exports package those files
under the generation root. The shell requests the selected comparison exactly as
for a changed screen, using the stable endpoint in development and
`comparisonUrl` in static delivery, then renders each view's `beforePath`.
Only views whose `state` is `removed` render; a response with an `afterPath`
for that route is a stale or reused generation and is treated as unavailable.
Review JSON, snapshot bytes, retention, renewal by HEAD, coalescing, capacity,
cancellation, invalidation, and shutdown follow the
[selected comparison contract](./mokly-selected-comparisons.md) unchanged.

## Page Previews

Pages have no comparison records, so a removed page adds a page selection to
the same generation lifecycle. The stable request is
`/__mokly/diffs/review.json?page=<encoded-catalogue-route>`, optionally with
`refresh=1`. `page` is exclusive with `route` and `variant`; combining them,
repeating it, or naming a route that is not a selected removed page fails with
the existing malformed-request or missing-selection responses. The response
redirects to `/__mokly/diffs/__generations/selected-<uuid>/preview.json`, an
immutable generation served with `no-store` and `nosniff`, GET/HEAD parity, and
the existing file-map confinement:

```ts
interface RemovedPagePreview {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  route: string;
  documentPath: string; // snapshots/before/<route> below the generation root
}
```

Resolve `documentPath` against the generation root: the directory of the
redirected `preview.json` in development, or the directory of `comparisonUrl`
in static delivery.

Capture reads the page's single historical document and its transitive local
closure through the pinned `BaselineReader` with the same Git asset reader,
regular-file, bounded-batch, source-exclusion, reserved-file, and size rules as
screen snapshots. Root-absolute, protocol-relative, and unsupported-scheme
resource URLs fail capture. A current file at the same path never replaces a
deleted or changed historical byte. The page and its route must belong to the
accepted removed-entry snapshot of the generation being served; a snapshot from
another generation is rejected before capture. No baseline is rebuilt during an
HTTP request; unprepared derived evidence returns the existing retryable
failure. Page generations share the selected queue, 32-request bound, ten-second
deadline, 60-second idle retention, 64 MiB artifact and 128 MiB capacity bounds,
epoch invalidation, and shutdown draining.

Changes-enabled export, publish packaging, and repository preview capture every
removed page preview from the single pinned baseline before installation and
write it beside the comparison:

```text
__mokly/diffs/__generations/<generation>/review.json
__mokly/diffs/__generations/<generation>/pages/<route>.json
__mokly/diffs/__generations/<generation>/snapshots/before/<route>
```

`pages/<route>.json` is the same `RemovedPagePreview` shape; `<route>` keeps
its `.html` suffix. Its files enter the generation content identity, ownership
inventory, reference validation, deployment hash, and upload archive. A preview
whose closure is incomplete fails the export transactionally, as an incomplete
screen snapshot does. Current-only delivery writes no historical files and
removes a previous artifact's historical files when replacing it.
Repository preview validates these files with the same typed descriptor builder
as consumer export, then adds the resulting descriptor only to its captured
static shell metadata. The development server it captured remains unchanged.

## Public Descriptor

Catalogue v1 gains one optional, additive field on each removed entry:

```ts
interface RemovedEntry {
  entry: CatalogueRoutedEntry;
  ancestors: readonly { id: string; title: string }[];
  snapshotId?: string;
  preview?: { kind: "screen" } | { kind: "page"; path: PublicPath };
}
```

`snapshotId` is the opaque baseline/generation identity defined by the
[catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions).
It selects this exact removed record even when current content has the same
stable entry id. It is a selection key, not an authorization capability, and
does not name or grant access to preview bytes.

`preview.kind: "screen"` states that the removed screen's comparison `before`
views are its preview; the viewer resolves them from `comparisonUrl`.
`preview.path` is the packaged `pages/<route>.json` path relative to the
artifact root, only when that file is published in the same generation as
`comparisonUrl`. Serve leaves `preview` absent for pages, because live page
generations are selected through the stable endpoint rather than a
catalogue-wide pointer, and the local shell keeps its private data. Removed
entries keep null `fragmentPath` and `documentPath`; historical HTML is never
disguised as current output. The descriptor contains no baseline metadata,
source paths, or commit identifiers beyond those already public in review JSON.
Readers validate each published `snapshotId` as a unique lowercase 64-hex
identity. They tolerate its absence for older inputs and may derive it from an
immutable `comparisonUrl` generation; an explicitly published baseline-backed
identity remains valid before a generation exists or while `comparisonUrl` is
null. Preview validation is separate: readers validate `preview.kind`, require
a confined `__mokly/diffs/__generations/**` page path whose generation matches
`comparisonUrl` and whose suffix is the exact removed page route plus `.json`,
tolerate `preview` being absent, and reject a preview on current entries or when
`comparisonUrl` is null.
The shipped [v2 fixture](./fixtures/catalogue-v2.json) exercises both preview
variants; the v1 fixture is no longer shipped.

The embedded viewer first resolves the selected snapshot and historical route,
then loads preview metadata only from advertised paths:
`comparisonUrl` for screens and `preview.path` for pages, resolved against the
source origin root for object and URL sources. Validated metadata may then name
a historical document only on that source origin beneath the advertised
generation's `snapshots/before/` directory. It never discovers
`/__mokly/diffs/review.json`, runs Git, or derives a historical URL from a
removed entry's current path. A catalogue without the field, or with
`comparisonUrl: null`, shows the unavailable state without a request. Neither
frame adapter mounts a preview frame. Previews are viewer-owned documents, so
no adapter handshake or inspection, marker, or navigation message exists for
them.

Serve and static artifacts include the preview controller and comparison
validator once in `__mokly/client/react-shell.js`. Application-owned
`@mokly/viewer` roots use the same React components and request lifecycle.

## Frames And Lifecycle

Serve, static export, and embedded viewers with either adapter use one
presentation path. After preview metadata validates, the viewer fetches every
historical document needed by the selected viewport and scheme before reporting
ready. Its URL must be on the configured source origin beneath
`snapshots/before/` of the generation established by the accepted comparison or
page-preview response. The GET carries the mount's abort signal and uses the
comparison credential rule: `credentials: "omit"` for pinned delivery and
`credentials: "same-origin"` for live delivery.

Accept a response only when its final URL is the requested snapshot address
or that address with only its final `.html` suffix removed, the
provider-normalized form a static host may redirect to, with the same origin
and no query or fragment; its status is OK; its `Content-Type` MIME essence is
`text/html`; and the body exposed by Fetch is at most 64 MiB (67,108,864
bytes). MIME parameters are allowed. Count the body instead of trusting
`Content-Length`; cancellation stops that read. Any other redirect or an
origin change fails the URL check. A current fetch,
validation, read, parse, or presentation failure renders the existing
“Previous version unavailable” state with Retry. Cancellation after unmount or
replacement is silent, and late work cannot change the replacement stage.

Parse the body as an inert HTML document. Preserve document-level comments
before and after the document element in their parsed order. Resolve the first
`<base href>` in document order against the snapshot address, falling back to
that address when there is no such element or its value is unresolvable. Remove every consumer
`<base>` and every `<meta>` whose `http-equiv`, after trimming ASCII whitespace,
equals `refresh` under ASCII case-insensitive comparison. Prepend exactly one
`<base href>` for the effective base as `head`'s first child, including for an
implicit head. Serialize the source doctype's name, public identifier, and
system identifier before the document element, or preserve its absence, so the
markup stays faithful. A `srcdoc` document always renders in no-quirks mode,
so a previous version that relied on quirks or limited-quirks rendering may
differ from its original presentation; this is accepted. Otherwise serialize
parsed nodes without mutation; do not rewrite resource attributes, links,
text, or styles.

The viewer assigns that serialization to `srcdoc`, never `src`, on a frame with
exactly `sandbox="allow-same-origin"`. The presented document therefore has the
viewer origin while scripts, forms, popups, downloads, and top navigation stay
disabled. The frame carries `data-mokly-preview-source` with the requested snapshot
address, which is also the fallback effective base regardless of any
provider-normalized final URL. A `srcdoc` document inherits the embedding document's Content Security
Policy; an embedded host must allow the artifact origin and historical inline
styles for resources the previous version needs.

On each load, the parent installs the guard in the viewer-owned document. It
finds links through the event's composed path; cancels every click, auxiliary
click, and Enter activation regardless of target or download attributes; and
cancels form submission. When a link has a nonempty fragment and its resolved
URL without that fragment equals the snapshot address, the guard scrolls the
matching target into view. Navigation remains cancelled, so `:target` does not
apply. Space keeps its scrolling default. If a later load is not the recorded
presentation document, the parent reapplies the accepted `srcdoc` and guard.

These edits exist only in the in-memory presentation. Captured snapshot files,
packaged artifacts, comparison bytes, and comparison-pane documents stay
byte-identical.

The served-then-loading sequence is an accepted first-paint tradeoff: while the
browser module downloads, the stage can briefly show the honest unavailable
state before the client starts a request and renders loading. The shell does not
use an inline script to hide that transition, so script-disabled delivery stays
truthful and the package keeps its external-module execution model.

Navigation, evidence or source replacement, unmount, and viewport or scheme
changes fence late responses exactly as comparisons do: a preview response can
never replace another entry's stage. Back/Forward, direct old routes, reused
ids or routes, stale or unknown snapshot ids, idle generation expiry, embedded controlled selection, and
several viewers on one page follow the selected-comparison rules. Saved
viewport and scheme choices are revalidated against the historical views
without inventing views.

## Acceptance

Regressions cover removed screens through the selected and complete comparison
paths in both output modes, same-id current/history pairs, removed pages with deleted assets and changed
historical CSS, historical page-v4 manifests, path traversal and symlinks,
current same-path files, malformed and mixed selections, coalescing, refresh,
invalidation, cancellation, shutdown, idle recovery, both frame adapters,
read-only enforcement, static delivery without renewal traffic, current-only
delivery with zero historical work, and old/new catalogue readers. Embedded
viewer coverage proves both adapters keep plain external and relative links
inert. Presentation coverage accepts a final URL that only drops the `.html` suffix;
rejects other redirects, origin changes, non-HTML and oversized documents;
removes meta refresh; folds the first consumer base into the effective base;
preserves doctypes while quirks and standards documents both render in
no-quirks mode; owns same-document anchor scrolling; restores presentation
after frame navigation; and loads historical resources in an embedded host
with a strict Content Security Policy.
