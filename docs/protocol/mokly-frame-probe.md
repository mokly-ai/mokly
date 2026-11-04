# Frame Probe

The frame probe is the in-frame script of the cross-origin
[frame adapter](./mokly-frame-adapter.md). The
[frame package](./mokly-frame-package.md) builds it. Decision: the script and
all its published names use the name frame probe, not inspector, which stays
the name of the shell's inspector panel.

## Publication Boundary

The static build injects the dependency-free frame probe IIFE from
`mokly-viewer/client/frame-probe.js` into **the current documents it writes only**,
after marker validation. It supplies an inert allowlisted map of
instance keys to range ids/parents and validated logical-link identities from
that document's accepted metadata, so `r-n` regions can be resolved without
reading the catalogue; the frame probe locates each range through the
`mokly-instance` and `mokly-slot` comment markers that served and built
documents keep under the [comparison contract](./mokly-comparison.md#markers). Bound this map to the
[wire protocol limits](./mokly-frame-probe-wire.md#wire-protocol-v3) and 262,144
UTF-8 bytes; oversized maps disable cross-origin inspection explicitly. No
private evidence or source text is embedded. Unowned files get no frame probe
or map. The build validates consumer resources before injection, and its
ownership inventory lists the injected package resource afterward.

The inert `template[data-mokly-frame-probe]` contains JSON with `ranges` and
`links`, plus optional `error: "limit" | "unavailable"`. Range index `n` denotes
`r-n`; each tuple is `[instanceKey | null, parentIndex | null]`. Null keys denote
slots and a component page's root region under [range markers](#range-markers);
parents refer only to earlier indices and must match actual nesting.
Distinct keys derive from these authenticated ranges, including empty pairs.
Links use `FrameNavigation` without `activation`, with at most 1,024 distinct
identities. Overflow publishes an explicit error map, never a truncated map.
A logical link whose path, ASCII fragment, or target cannot satisfy the
[wire grammar](./mokly-frame-probe-wire.md#wire-protocol-v3) is omitted from this map. It keeps its portable fallback link. Other links and
instance ranges remain inspectable.
Each accepted native link receives `data-mokly-frame-probe-link="n"`, indexing
the deduplicated `links` array. Consumer-authored frame probe markers and link
indices are rejected. Both publication nodes are inserted into the head so body
child positions and authored selectors remain unchanged, including implicit
heads.

## Range Markers

The frame probe and the same-origin adapter authenticate ranges from the same
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

## Presentation

The script draws nothing in the preview document: no mask, no outline, and no
label. It reports instance boundaries, geometry notifications, hovers, and
picks, under the [wire protocol](./mokly-frame-probe-wire.md#wire-protocol-v3).
The shell draws the
[Highlight components](./mokly-component-explorer.md#highlight-components)
visuals from the reported boxes, for highlights and picks alike, as the
[frame adapter contract](./mokly-frame-adapter.md) requires. Host labels and
keyboard-accessible instance lists use public catalogue titles. Do not clone
or restyle consumer content.

Outgoing fields contain only validated ASCII identities/control values and
numeric geometry.

## Delivery Constraints

Served documents and comparison snapshots stay byte-unmodified. Snapshots never
embed the script or negotiate a session. Local script-disabled frames keep the
same-origin adapter's inspection even when published copies contain the inert
script.
No React, server module, cookie, network request, or host-specific integration is
included in the IIFE. The built `client/frame-probe.js` stays within a
**9 KiB (9,216 bytes) minified, uncompressed** script budget. The budget
excludes the separately bounded per-document inert metadata, which is not
executable code.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Frame package](./mokly-frame-package.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
- [Static delivery](./mokly-export-delivery.md)
