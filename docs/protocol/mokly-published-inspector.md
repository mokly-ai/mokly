# Published Inspector And Overlay

## Delivery Status

Implemented for current HTML copies produced by repository preview and static
export. The cross-origin host activates the inspector through the
[frame adapter handshake](./mokly-frame-adapter.md#cross-origin-mount-and-handshake).
Same-origin local frames keep their parent-owned inspection path.

## Publication Boundary

The Browse document adapter injects the dependency-free inspector IIFE from
`__mokly/client/inspector.js` into **current published HTML copies only**, after
ownership and marker validation. It supplies an inert allowlisted map of
instance keys to range ids/parents and validated logical-link identities from
that document's accepted metadata, so `r-n` comments can be resolved without
reading a manifest. Bound this map to the
[wire protocol limits](./mokly-frame-adapter.md#wire-protocol-v1) and 262,144
UTF-8 bytes; oversized maps disable cross-origin inspection explicitly. No
private evidence or source text is embedded. Unowned files get no inspector or
map. Repository preview validates portable consumer resources before adaptation;
the complete export inventory validates the injected package resource afterward.

The inert `template[data-mokly-inspector]` contains JSON with `ranges` and
`links`, plus optional `error: "limit" | "unavailable"`. Range index `n` denotes
`r-n`; each tuple is `[instanceKey | null, parentIndex | null]`. Null keys denote
slots; parents refer only to earlier indices and must match actual nesting.
Distinct keys derive from these authenticated ranges, including empty pairs.
Links use `FrameNavigation` without `activation`, with at most 1,024 distinct
identities. Overflow publishes an explicit error map, never a truncated map.
Each accepted native link receives `data-mokly-inspector-link="n"`, indexing the
deduplicated `links` array. Consumer-authored inspector markers and link indices
are rejected. Both publication nodes are inserted into the head so body child
positions and authored selectors remain unchanged, including implicit heads.

## Overlay

On request the script draws the existing dimming mask and outlines in-frame;
host labels and keyboard-accessible instance lists use public catalogue titles
and returned boxes. Pick reuses Highlight components visuals. Do not clone or
restyle consumer content. No overlay exists without a highlight or pick request.
Overlay nodes are excluded from range/occlusion measurements and observers must
not create a redraw loop. Disposal removes all package-owned overlay nodes.

The in-frame SVG lives in a shadow root on a host after the body: consumer styles
cannot restyle its shapes, redraw mutations stay outside observation, and body
range/occlusion measurements exclude the host. Outgoing fields contain only
validated ASCII identities/control values and numeric geometry; serialized
character length therefore equals its UTF-8 byte length. Incoming strings still
require explicit UTF-8 measurement before parsing.

The host resets all presentation properties with inline important declarations,
then sets its fixed, transparent, pointer-inert layout. The shadow SVG resets
inherited presentation and explicitly remains pointer-inert before applying the
owned mask and outline attributes. Universal and element selectors, backgrounds,
box-model rules, display, color, and opacity from consumer CSS cannot repaint the
cutouts or hide the overlay.

## Delivery Constraints

Generated files and comparison snapshots stay byte-unmodified. Snapshots never
embed the script or negotiate a session. Local script-disabled frames retain
parent-owned highlighting even when published copies contain the inert script.
No React, server module, cookie, network request, or host-specific integration is
included in the IIFE. `scripts/package-check.mjs` enforces a **9 KiB (9,216
bytes) minified, uncompressed** script budget; the separately bounded
per-document inert metadata is not executable code and is excluded.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
- [Static export delivery](./mokly-export-delivery.md)
