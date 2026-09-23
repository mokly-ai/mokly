# Generated Document Delivery Across Viewer Layouts

## Delivery Status

Approved target in [Generated Output Simplification](../../plans/generated-output-simplification.md).
This owns URL addressing for [catalogue read models](./mokly-catalogue.md),
[viewer frames](./mokly-frame-adapter.md), [static export](./mokly-export-delivery.md)
and [publication](./mokly-publication.md). It does not change logical route
strings, the v1 public-catalogue version or historical snapshot URLs.

## Layout Signal

The public `CatalogueReadModel` adds the optional literal field
`generatedPathPrefix?: ".generated"`. Every new v6 Serve, export or published
catalogue **must** set it to `.generated`; absence means the legacy
single-directory layout, for existing published v1 catalogues. No other value,
including `""` or `/`, is valid. Neither the viewer nor a host infers the
prefix from a route, origin, file existence or current application version.
The viewer's public catalogue decoder accepts exactly these two forms and
rejects unknown non-literal values. Embedded Serve shell data and the
SSR/hydration descriptor carry the same field, omitting it for an older
source. A private v6 manifest or live-index-1 generation sets
`.generated` in its shell data; a historical v2–v5 manifest omits the field.
The field is delivery metadata, not a route component or a Git tracking mode.
Switching layout is a content/source change: remount frame sessions and
reject stale responses from the previous source, even if a route string matches.

The logical route remains `<route>.html`, with the existing validated
route grammar. Project it to a public artifact path as follows:

| Source layout         | Current document path       | Authored closure path                  |
| --------------------- | --------------------------- | -------------------------------------- |
| v6 (`.generated`)     | `static/.generated/<route>` | `static/<catalogue-relative path>`     |
| legacy (field absent) | `static/<route>`            | existing legacy `static/<public path>` |

The public catalogue's non-null `fragmentPath` and `documentPath` are
artifact-root-relative **full paths** (including `static/`); v6 paths include
the prefix, legacy paths do not. Producers construct them from the selected
layout and manifest routes; public read-model validation recomputes each
expected path from the entry/variant/viewport and that catalogue's prefix.
The `route`/variant route fields themselves never contain `.generated/`.
Null stays null for an unavailable current view. Removed-entry `preview.path`,
comparison generation URLs, and temporary component-render URLs retain their
own separately validated namespaces; do not prefix them with `.generated`.

## Frames And Reverse Mapping

For a public model, the viewer uses its validated `fragmentPath` or
`documentPath` directly, encodes each validated segment once and prepends
`/` (or resolves it at that source's configured origin). For private
manifest/live-index stages, which carry logical routes instead of public
paths, append the validated logical route to `/static/.generated/` for v6 or
`/static/` for legacy, as selected by the shell's layout field. The component
stage, geometry/inspection and
same-origin and postMessage adapters use the **same source layout** rather
than independently concatenating `/static/${route}`. The frame mount carries
the selected layout and expected logical document route along with its URL;
an absent mount prefix is legacy. The built-in adapter accepts a current
HTML URL only when its decoded, normalized pathname is exactly
`/static/.generated/<expected route>` for v6 or `/static/<expected route>`
for legacy on the configured origin, with the existing hash, query, encoding,
no-traversal and frame-authentication rules.
Never silently accept a legacy URL for a v6 mount or vice versa. The private
temporary-render adapter retains its distinct `__mokly/components/renders/`
path policy and must not adopt current-document URLs.

When an iframe loads or navigates, first verify its origin and decoded
pathname against the active layout and current-document prefix; strip that
prefix exactly once to obtain the logical route and validate it against the
active catalogue's registered document/fragment routes. Retain a valid
fragment separately. Use this logical route for shell navigation, selected
comparisons, geometry/range authentication and links; never pass a
`static/` or `.generated/` path to the logical router. Reject cross-layout,
unknown, traversal, encoded-separator, or non-HTML navigation. Authored
closure URLs are resources, not frame routes. Source replacement invalidates
in-flight mounts and events before adopting the next layout. This rule also
applies when `@mokly/viewer` is hosted independently by a cloud product.

## Static Artifacts And Compatibility

Serve delivers in-memory v6 documents under `/static/.generated/<route>`;
export and publication place those compiled documents under
`static/.generated/<route>` and copy only manifest `assetClosure` resources
under `static/<catalogue-relative path>`. Relative HTML/CSS references resolve
as they do on disk. No unreferenced file under `static/` becomes public by
directory scan. Export's optional comparison snapshots are separate from the
current tree and may retain their historical layout. The upload archive
contains the **same** static layout and optional catalogue field, with no
new upload schema; the receiver validates artifact inventory and paths but
does not rewrite them to the receiver's current layout. An older archive or
published catalogue with the field absent remains viewable under
`/static/<route>` by the newer viewer. The legacy fallback is read-only
compatibility: new publications always advertise and use `.generated`.
