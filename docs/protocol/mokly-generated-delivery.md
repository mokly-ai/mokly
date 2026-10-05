# Identity-Derived Generated Document Delivery

## Delivery Status

This contract defines identity-derived HTML addresses for v8 output and the
strict catalogue-v4 policy. The current viewer namespace is `mokly-viewer/`;
[the namespace contract](./mokly-viewer-namespace.md) defines its version gates.
Implementation and verification are tracked by
[Generated Output Simplification](../../plans/generated-output-simplification.md).

## Routes And Layout Signal

Merged entry routes derive from kind and id. Authors do not supply routes.
Actual generated HTML has only these kind prefixes:

| Generated content                       | Generated-root-relative path             |
| --------------------------------------- | ---------------------------------------- |
| Page document                           | `pages/<id>.html`                        |
| Screen view, including a screen variant | `screens/<id>.<viewport>[.dark].html`    |
| Component variant view                  | `components/<id>.<viewport>[.dark].html` |

The shared kind/id helpers guarantee these prefixes. This is not a claim that
an arbitrary safe-relative-path grammar rejects every other prefix. The
`mokly-generated/` delivery prefix is outside the logical generated route.
An id can contain the text `mokly-generated`; for example,
`screens/mokly-generated.mobile.html` still starts with `screens/`. No new
substring or id-name prohibition applies.

Logical shell routes additionally include `user-flows/<id>.html`. A use case
has no generated HTML file of its own; a component parent likewise has no
views. The shell lives at `/view/<kind-derived entry route>`, while frames
load real page/view files. Compiled resources use `styles/` and `assets/`;
the private manifest has its own fixed name. They are not HTML entry routes.

Public catalogue v4 contains no layout-prefix field. The viewer always uses
`GENERATED_DIRECTORY` from `@mokly/viewer/data` to derive current paths.
Only v4 is readable. Reject older and unknown versions before reading entries
or deriving URLs. Disk existence, host settings and payload metadata cannot
select another layout. Current generated files always use `/static/mokly-generated/`.

V4 records contain identity and view axes, not `route`, `documentPath` or
`fragmentPath` fields. Derive each current file from that identity and the
shared directory constant. Private v8/live-index stages derive the same addresses.
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
before resolving the logical route through the catalogue's kind/id helpers.
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

Only v8 baselines provide comparison content. A pre-v8 base follows the exact
[earlier-baseline outcome](./mokly-generated-manifest.md#earlier-baseline-outcome);
it supplies no older-layout snapshots or removed-entry previews. Snapshot
publication uses its existing generation-local layout for accepted v8 content.

Current delivery uses catalogue v4, static delivery v4 and bootstrap v1.
Ownership v3 and upload v2 finalize the renamed paths under the
[namespace version gates](./mokly-viewer-namespace.md#version-matrix).
Receivers validate their supported formats before paths; they never rewrite
an old artifact into the current layout. The marker/transport gate and strict
viewer version gate protect current-only artifacts as well as comparisons.

The approved [path/output integration](./mokly-path-output-integration.md)
supersedes the current kind/id layout at integration. Its
[format inventory](./mokly-format-versions.md) defines manifest v9, catalogue v5,
review v6 and all other boundaries. Only v9 baseline content is readable after
that integration; the earlier-version product outcome remains unchanged.
