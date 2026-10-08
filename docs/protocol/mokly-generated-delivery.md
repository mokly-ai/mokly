# Identity-Derived Generated Document Delivery

## Delivery Status

This contract defines identity-derived HTML addresses for v10 output and the
strict catalogue-v6 policy. The current viewer namespace is `mokly-viewer/`;
[the namespace contract](./mokly-viewer-namespace.md) defines its version gates.
Implementation and verification are tracked by
[Generated Output Simplification](../../plans/generated-output-simplification.md).

## Routes And Layout Signal

Entry identity is its file-derived path under [paths](./mokly-paths.md).
The shared helpers derive document and view names:

| Generated content           | Generated-root-relative path          |
| --------------------------- | ------------------------------------- |
| Page                        | `<path>/index.html`                   |
| Markdown document           | `<path>/index[.dark].html`            |
| Screen or component variant | `<path>/index.<viewport>[.dark].html` |

Variant paths include the parent and variant slug. Use cases and component
parents have shell pages at `/view/<path>/` but no generated document of their
own. Folder Overview entries use the folder's path. Compiled CSS and copied
CSS assets use `styles/` and `assets/`; Markdown copies use their derived
resource paths. The private manifest has one fixed name. The
[reserved HTML segments](./mokly-unified-output.md#one-owned-tree) remain enforced.

Public catalogue v6 contains no layout-prefix field. The viewer always uses
`GENERATED_DIRECTORY` from `@mokly/viewer/data` to derive current paths.
Only v6 is readable. Reject older and unknown versions before reading entries
or deriving URLs. Disk existence, host settings and payload metadata cannot
select another layout. Current generated files always use `/static/mokly-generated/`.

V5 records contain identity and view axes, not `route`, `documentPath` or
`fragmentPath` fields. Derive each current file from that identity and the
shared directory constant. Private v10/live-index stages derive the same addresses.
Complete public models and strictly scoped live models retain their separate
usage validation. Source changes still invalidate stale frame work and events.

## Public Paths And References

The current document URL is `/static/mokly-generated/<generated route>`;
export stores it at `static/mokly-generated/<generated route>`. Generated CSS
and assets use the same prefix with their generated-relative resource paths.
Authored closure resources remain under
`static/<catalogue-relative authored path>`. Use the single generation/closure
reference rule in [unified output](./mokly-unified-output.md#one-reference-rule).

Derive paths from the same shared helpers in shell frames, component stages,
geometry, inspection and navigation; do not construct a second route map.
Encode validated segments once, preserve query/fragment according to the
existing contract, and resolve artifact-relative paths at the source origin
root rather than the catalogue JSON directory or embedding application's URL.
The private manifest is never a frame/resource target, served path or export.

Comparison snapshots and removed previews resolve from the advertised immutable
`mokly-viewer/diffs/generations/<generation>/review.json`. Their generation-local
`snapshots/before/` and `snapshots/after/` paths remain identity-derived. They
are not current `/static/` paths and never acquire another generated prefix.
Transient component renders keep the distinct
`mokly-viewer/components/renders/` capability boundary. Export contains none
of the private live rendering, navigation, view-evidence or event endpoints.

## Frames And Reverse Mapping

Keep existing origin, session, pathname, encoding, traversal and authentication
checks. The shell derives the mounted entry/view URL; adapters validate its
current-file path under `/static/mokly-generated/`. Strip that fixed prefix once
before resolving the logical route through the catalogue's path helpers.
Retain a valid fragment separately. Authored closure URLs are resources, not
entry routes; temporary renders and historical generations use their existing
separate adapters. Do not accept an old prefixless current URL by treating a
missing field as permission for another layout.

Provider-normalized extensionless URLs remain supported under shared
normalization helpers and must identify the same derived document. This work
adds no new route validator or removes a mainline path check. The already
approved reserved first segments for raw generated HTML remain in
[unified output](./mokly-unified-output.md#one-owned-tree).

## Static Artifacts And Compatibility

Serve reads current generated files from the accepted in-memory generation and
only referenced authored closure files from their confined locations. Export
and publication use that same layout. Neither reads stale generated disk files
nor includes `static/mokly-generated/mokly-manifest.json`. Relative HTML/CSS
references behave the same on disk and through `/static/`.

Only v10 baselines provide comparison content. A pre-v10 base follows the exact
[earlier-baseline outcome](./mokly-generated-manifest.md#earlier-baseline-outcome);
it supplies no older-layout snapshots or removed-entry previews. Snapshot
publication uses its existing generation-local layout for accepted v10 content.

Current delivery uses catalogue v6, static delivery v5 and bootstrap v2.
Ownership v3 and upload v2 finalize the renamed paths under the
[namespace version gates](./mokly-viewer-namespace.md#version-matrix).
Receivers validate their supported formats before paths; they never rewrite
an old artifact into the current layout. The marker/transport gate and strict
viewer version gate protect current-only artifacts as well as comparisons.

The [combined format inventory](./mokly-format-versions.md) defines every
version and the rejection rules for both pre-merge parents.
