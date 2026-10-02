# Removed Preview Frames And Lifecycle

## Delivery Status

Implemented. This document is split from
[Removed Content Previews](./mokly-removed-previews.md#frames-and-lifecycle)
and owns how the viewer fetches, validates, presents, and guards a historical
document once its preview metadata has been accepted. The
[path identity plan](../../plans/path-identity.md) changes none of these rules
beyond the path-derived snapshot names they reference.

## Frames And Lifecycle

Serve, static export, and embedded viewers with either adapter use one
presentation path. After preview metadata validates, the viewer fetches every
historical document needed by the selected viewport and scheme before reporting
ready. Its URL must be on the configured source origin beneath
`snapshots/before/` of the generation established by the accepted comparison or
page-preview response. The GET carries the mount's abort signal and uses the
comparison credential rule: `credentials: "omit"` for pinned delivery and
`credentials: "same-origin"` for live delivery. Comparison loaders also accept `snapshots/after/`; removed previews never do.

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

From document commit, and again after replacement and load, the parent installs
the guard before slow resources can leave links active. It finds links through the event's composed path; cancels every click, auxiliary
click, and Enter activation regardless of target or download attributes; and
cancels form submission. When a link has a nonempty fragment and its resolved
URL without that fragment equals the snapshot address, the guard scrolls the
matching target into view. Navigation remains cancelled, so `:target` does not
apply. Space keeps its scrolling default. If a later load is not the recorded
presentation document, the parent reapplies the accepted `srcdoc` and guard.

These edits exist only in memory; snapshot, artifact, comparison, and pane
bytes stay identical.

The served-then-loading sequence is an accepted first-paint tradeoff: while the
browser module downloads, the stage can briefly show the honest unavailable
state before the client starts a request and renders loading. The shell does not
use an inline script to hide that transition, so script-disabled delivery stays
truthful and the package keeps its external-module execution model.

Navigation, evidence or source replacement, unmount, and viewport or scheme
changes fence late responses exactly as comparisons do: a preview response can
never replace another entry's stage. Back/Forward, direct removed-entry URLs,
stale or unknown snapshot ids, idle generation expiry, embedded
controlled selection, and several viewers on one page follow the
selected-comparison rules. Saved
viewport and scheme choices are revalidated against the historical views
without inventing views.
