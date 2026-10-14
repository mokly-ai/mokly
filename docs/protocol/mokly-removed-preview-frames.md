# Removed Preview Frames And Lifecycle

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Frames And Lifecycle

Serve, the static build, and embedded viewers with either adapter use one
presentation path. After the removed entry's detail validates, the viewer
fetches every historical document needed by the selected viewport and scheme
before reporting ready. Its URL must be on the configured source origin
beneath the before-side directory of the generation that the index's
`comparisonUrl` names and the detail's `generation` confirms. The GET carries
the mount's abort signal and the credential rule of the
[comparison pane contract](./mokly-comparison-panes.md). Comparison loaders
also accept the after side; removed previews never do.

Accept a response only when its final URL is the requested document address
or that address with only its final `.html` suffix removed. An `index.html`
document also accepts its containing directory with or without a trailing
slash. These provider-normalized forms keep the same origin and no query or
fragment; the status must be OK; its `Content-Type` MIME essence is
`text/html`; and the body exposed by Fetch is at most 64 MiB (67,108,864
bytes). MIME parameters are allowed. Count the body instead of trusting
`Content-Length`; cancellation stops that read. Any other redirect or an
origin change fails the URL check. A fetch, validation, read, parse, or
presentation failure renders the “Previous version unavailable” state with
Retry. Cancellation after unmount or replacement is silent, and late work
cannot change the replacement stage.

Parse the body as an inert HTML document. Preserve document-level comments
before and after the document element in their parsed order. Resolve the
first `<base href>` in document order against the document address, falling
back to that address when there is no such element or its value is
unresolvable. Remove every consumer `<base>` and every `<meta>` whose
`http-equiv`, after trimming ASCII whitespace, equals `refresh` under ASCII
case-insensitive comparison. Prepend exactly one `<base href>` for the
effective base as `head`'s first child, including for an implicit head.
Serialize the source doctype's name, public identifier, and system identifier
before the document element, or preserve its absence, so the markup stays
faithful. A `srcdoc` document always renders in no-quirks mode, so a version
that relied on quirks or limited-quirks rendering may differ from its original
presentation; this is accepted. Otherwise serialize parsed nodes without
mutation; do not rewrite resource attributes, links, text, or styles.

The viewer assigns that serialization to `srcdoc`, never `src`, on a frame
with exactly `sandbox="allow-same-origin"`. The presented document therefore
has the viewer origin while scripts, forms, popups, downloads, and top
navigation stay disabled. The frame carries `data-mokly-preview-source` with
the requested document address, which is also the fallback effective base
regardless of any provider-normalized final URL. A `srcdoc` document inherits
the embedding document's Content Security Policy; an embedded host must allow
the artifact origin and historical inline styles for resources the document
needs.

From document commit, and again after replacement and load, the parent
installs the guard before slow resources can leave links active. It finds
links through the event's composed path; cancels every click, auxiliary
click, and Enter activation regardless of target or download attributes; and
cancels form submission. When a link has a nonempty fragment and its resolved
URL without that fragment equals the document address, the guard scrolls the
matching target into view. Navigation stays cancelled, so `:target` does not
apply. Space keeps its scrolling default. If a later load is not the recorded
presentation document, the parent reapplies the accepted `srcdoc` and guard.

These edits exist only in memory; the generation's bytes stay identical.

Navigation, revision or source replacement, unmount, and viewport or scheme
changes fence late responses exactly as comparisons do: a preview response
can never replace another entry's stage. Back/Forward, direct removed-entry
URLs, stale or unknown snapshot ids, a replaced generation, embedded
controlled selection, and several viewers on one page follow the
[fences](./mokly-shell-delivery.md#fetch-and-fences) of the shell delivery
contract and the pane [lifecycle](./mokly-comparison-panes.md#lifecycle).
Saved viewport and scheme choices are revalidated against the historical
views without inventing views.
