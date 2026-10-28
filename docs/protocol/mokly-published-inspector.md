# Published Inspector And Overlay

## Publication Boundary

The static build injects the dependency-free inspector IIFE from
`mokly-viewer/client/inspector.js` into **the current documents it writes only**,
after marker validation. It supplies an inert allowlisted map of
instance keys to range ids/parents and validated logical-link identities from
that document's accepted metadata, so `r-n` regions can be resolved without
reading the catalogue; the inspector locates each range through the
`mokly-instance` and `mokly-slot` comment markers that served and built
documents keep under the [comparison contract](./mokly-comparison.md#markers). Bound this map to the
[wire protocol limits](./mokly-inspector-wire.md#wire-protocol-v2) and 262,144
UTF-8 bytes; oversized maps disable cross-origin inspection explicitly. No
private evidence or source text is embedded. Unowned files get no inspector or
map. The build validates consumer resources before injection, and its ownership
inventory lists the injected package resource afterward.

The inert `template[data-mokly-inspector]` contains JSON with `ranges` and
`links`, plus optional `error: "limit" | "unavailable"`. Range index `n` denotes
`r-n`; each tuple is `[instanceKey | null, parentIndex | null]`. Null keys denote
slots and a component page's root region under [range markers](#range-markers);
parents refer only to earlier indices and must match actual nesting.
Distinct keys derive from these authenticated ranges, including empty pairs.
Links use `FrameNavigation` without `activation`, with at most 1,024 distinct
identities. Overflow publishes an explicit error map, never a truncated map.
A logical link whose path, ASCII fragment, or target cannot satisfy the
[wire grammar](./mokly-inspector-wire.md#wire-protocol-v2) is omitted from this map. It keeps its portable fallback link. Other links and
instance ranges remain inspectable.
Each accepted native link receives `data-mokly-inspector-link="n"`, indexing the
deduplicated `links` array. Consumer-authored inspector markers and link indices
are rejected. Both publication nodes are inserted into the head so body child
positions and authored selectors remain unchanged, including implicit heads.

## Range Markers

The inspector and the same-origin adapter authenticate ranges from the same
markers. Range `r-n` is the region between a `mokly-instance` or `mokly-slot`
start marker with `id="r-n"` and the end marker of the same kind and id. Start
markers appear in range order, each inside the region of its parent tuple. An
instance marker belongs to a tuple with a key and carries that key as its
`instance` attribute; a slot marker belongs to a tuple without a key; an end
marker carries only `id`. The other attributes (`path`, `props`, `name`, and a
slot's `instance`) are not authenticated, and other comments are not markers.
A malformed marker, or a marker that disagrees with the map, makes inspection
fail with `invalid-boundary`.

On a component entry's document the core writes no marker for the root region
`r-0`. Its tuple is `[null, null]` at index 0, its range is the content of
`body`, and its owner is the entry, the page's root component. Every marked
region nests in it, so a top-level marked range names index 0 as its parent.
A slot always has a parent, so no other tuple is `[null, null]`. A screen has
no root region; content outside every region belongs to the screen.

## Overlay

On request the script draws the dimming mask and outlines of
[Highlight components](./mokly-component-explorer.md#highlight-components)
in-frame; host labels and keyboard-accessible instance lists use public
catalogue titles and returned boxes. Pick reuses Highlight components visuals.
Do not clone or restyle consumer content. No overlay exists without a highlight
or pick request. Range and occlusion measurements exclude the overlay. Disposal
removes all package-owned overlay nodes.

The overlay is fixed over the frame viewport and pointer-inert. Consumer CSS
cannot restyle its shapes: universal and element selectors, backgrounds, box-model
rules, display, color, and opacity from consumer CSS cannot repaint the cutouts
or hide the overlay. Outgoing fields contain only validated ASCII
identities/control values and numeric geometry.

## Delivery Constraints

Served documents and comparison snapshots stay byte-unmodified. Snapshots never
embed the script or negotiate a session. Local script-disabled frames retain
parent-owned highlighting even when published copies contain the inert script.
No React, server module, cookie, network request, or host-specific integration is
included in the IIFE. The built `client/inspector.js` stays within a
**9 KiB (9,216 bytes) minified, uncompressed** script budget. The budget
excludes the separately bounded per-document inert metadata, which is not
executable code.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Inspector handshake and wire protocol](./mokly-inspector-wire.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
- [Static delivery](./mokly-export-delivery.md)
