# Viewer SSR, Hydration And Host Independence

## Delivery Status

Implemented by the [viewer library plan](../../plans/mokly-viewer-library.md)
and the [React Browse shell plan](../../plans/react-browse-shell.md): one
server-rendered, hydrated shell serves Serve, export, and React hosts. This
document owns the `@mokly/viewer/server` entry, hydration in every delivery
mode, the inspector-script exception, and the viewer's host-independence and
network boundary; the [embeddable viewer contract](./mokly-viewer.md) owns the
props, selection, events, slots, and shell state that tree renders.

## Server Rendering

The Node-only `@mokly/viewer/server` entry exports `renderViewer` for Serve and
export. It synchronously accepts a validated object source, its base URL and
initial selection/slots, plus a required stable `viewerId`, and returns the
server-rendered shell tree as HTML;
URL/fetcher sources and browser handles/effects are not accepted during SSR.
`viewerId` contains 1–64 ASCII letters, digits, hyphens or underscores, starts
with a letter or digit, and is unique among viewer roots in the host document.
The host passes the identical value to `renderViewer` and `MoklyViewer` when it
hydrates that output. Package-owned DOM IDs and fragment/ARIA references are
prefixed through a boundary-preserving encoding of this value: distinct valid
viewer IDs cannot collide even when one contains text used by a dynamic local
control ID. The exact generated DOM ID bytes are internal. Host slot descendants
remain untouched. Thus two independently rendered viewers can be safely
composed and hydrated in one document without relying on React's per-render
identifier sequence.
CLI-owned context supplies the existing route, live capabilities or static
delivery descriptor through its server integration. That context already
contains accepted data; it bypasses public-source decoding. Serve validates
each serialized public revision once and shares it across shell requests;
asset delivery never decodes the catalogue. The browser graph never imports
this entry.

## First Paint And Hydration

First paint is real: the server output is the complete shell with real anchors
for every route, so direct URLs, refresh and JavaScript-disabled use show the
correct screen before any script runs. Serve and export then load
the documented standalone hydration entry, which bundles React and hydrates
that tree in place. React hosts render `MoklyViewer` with their own React and
hydrate it the same way. **Exported catalogues ship React and hydrate**; the
former rule that exported browsers contain no React is withdrawn so that one
shell implementation serves every delivery mode. An SSR-only unhydrated export
remains possible because first paint does not depend on hydration, but it is
not a supported mode.

One exception stands: the in-frame inspector script defined by the
[frame adapter contract](./mokly-frame-adapter.md) stays a React-free IIFE
under its 9,216-byte budget. It runs inside consumer documents, not the shell,
and no shell dependency may enter it.

## Host Independence

The viewer knows no cloud tenant, auth, comment model, deployment provider or
host route layout. Marker content is host-owned; hosts own surrounding product
UI and data. Viewer network
activity is limited to its configured source and validated public resources or
pinned comparisons from it: historical `before` documents for a removed entry,
plus permitted `before` and `after` pane documents when a
comparison is selected; it adds no analytics, discovery, remote fonts, or
background comparison requests. Existing authored external fragment resources retain
export's resource policy. Serve owns its existing private update/control
transport outside this public fetch boundary. No cookies or ambient credentials
are read/written, and no `window.top` access occurs. Embedding never commandeers
an ancestor router; standalone Serve/export retain their current URL lifecycle.

## Related Docs

- [Embeddable Mokly viewer](./mokly-viewer.md)
- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Static export delivery](./mokly-export-delivery.md)
