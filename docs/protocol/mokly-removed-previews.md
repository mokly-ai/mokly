# Removed Content Previews

## Delivery Status

This contract is implemented. The typed capture, Serve generation lifecycle,
public descriptor, consumer export, and upload packaging land through Milestone
4 of the [removed content previews plan](../../plans/removed-content-previews.md),
and the shared shell, browser client, and `@mokly/viewer` render the previous
version through Milestone 5. Nothing here changes ordinary browsing, Added
entries, changed-screen comparisons, or removed component variants.

One delivery gap remains: the repository preview built by `scripts/preview/`
captures its shells before it packages page previews, so those shells advertise
no page descriptor and a removed page there shows the unavailable state. Its
removed screens are unaffected because they resolve through `comparisonUrl`.
Milestone 6 of the plan closes that gap.

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

Historical content is read-only. Scrolling, text selection, and same-document
anchors work. Forms cannot submit, and every link is inert: marked catalogue
links, portable relative links, and external links do nothing, so old links
cannot open current content or leave the preview. Historical documents keep
the existing script-disabled sandbox and the existing external-resource policy;
external HTTP(S) resources load as they did, without offline copies.

The preview is requested when the removed entry is selected, in development and
in static delivery alike. Ordinary browsing, All/Changes filtering, search,
navigation, and evidence updates never request historical bytes. While the
preview loads, the stage shows “Loading previous version…”; a failure shows
“Previous version unavailable” with a Retry control while the catalogue stays
usable. Current bytes, current fragments, or invented content never stand in
for missing history. Catalogues published without Changes have no removed
entries and therefore no previews.

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

## Public Descriptor

Catalogue v1 gains one optional, additive field on each removed entry:

```ts
interface RemovedEntry {
  entry: CatalogueRoutedEntry;
  ancestors: readonly { id: string; title: string }[];
  preview?: { kind: "screen" } | { kind: "page"; path: PublicPath };
}
```

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
Readers validate `kind`, require a confined `__mokly/diffs/__generations/**`
path for pages whose generation matches `comparisonUrl` and whose suffix is the
exact removed page route plus `.json`, tolerate the field's absence, and reject
it on current entries or when `comparisonUrl` is null.
When the readers learn the field, the shipped
[v1 fixture](./fixtures/catalogue-v1.json) must exercise both variants.

The embedded viewer loads previews only from advertised paths: `comparisonUrl`
for screens and `preview.path` for pages, resolved against the source origin
root for object and URL sources. It never discovers `/__mokly/diffs/review.json`,
runs Git, or derives a historical URL from a removed entry's current path. A
catalogue without the field, or with `comparisonUrl: null`, shows the unavailable
state without a request. Both frame adapters render previews in script-disabled
frames; the cross-origin adapter mounts historical documents without the
inspector handshake, so no inspection, marker, or navigation message is
exchanged for them.

## Frames And Lifecycle

Preview frames are the existing shell frames with the existing sandbox. The
parent enforces read-only behavior for same-origin documents by cancelling link
and form activation, including keyboard activation, popup targets, and download
attributes; cross-origin previews rely on the sandbox alone, which already
withholds forms, popups, downloads, and top navigation. Original historical
bytes are not transformed for presentation.

Navigation, evidence or source replacement, unmount, and viewport or scheme
changes fence late responses exactly as comparisons do: a preview response can
never replace another entry's stage. Back/Forward, direct old routes, reused
ids or routes, idle generation expiry, embedded controlled selection, and
several viewers on one page follow the selected-comparison rules. Saved
viewport and scheme choices are revalidated against the historical views
without inventing views.

## Acceptance

Regressions cover removed screens through the selected and complete comparison
paths in both output modes, removed pages with deleted assets and changed
historical CSS, historical page-v4 manifests, path traversal and symlinks,
current same-path files, malformed and mixed selections, coalescing, refresh,
invalidation, cancellation, shutdown, idle recovery, both frame adapters,
read-only enforcement, static delivery without renewal traffic, current-only
delivery with zero historical work, and old/new catalogue readers.
