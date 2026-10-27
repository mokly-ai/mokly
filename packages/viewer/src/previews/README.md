# Previous versions of removed entries

These modules turn a removed page, Markdown document or screen into the version from the pinned
Changes baseline, for the shell of Serve, of a static build and of an embedded
`@mokly/viewer` alike. They implement the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md).

## Requests

`previewEndpoint` uses the catalogue's advertised `comparisonUrl` for a screen
and `previewMetadataPath(path)` for a page or document. Pages use the light
`snapshotDocumentPath`, and Markdown documents use each historical scheme.
Selection loads only the requested document scheme. Before it accepts either
kind, `requestPreview` recomputes the selected historical identity from the
metadata's baseline commit. This keeps a late response or Retry from replacing
an open historical record after the baseline changes. `renewPreview` extends a
live generation's retention before reusing it, exactly as comparisons do.
`advertisedPreviewPaths` describes the documented embedded fetch set for tests
and has no runtime consumer.

## Presentation

A loader takes one immutable generation URL and a typed, non-empty side set.
Removed previews configure only `before`, and comparisons configure `before`
and `after`. The side set also selects the stable unavailable copy, so callers
do not classify errors by message. A loader caches each accepted address,
shares in-flight work that was not aborted, and removes failures for Retry.
[`../shell/use_comparison_documents.ts`](../shell/use_comparison_documents.ts)
creates the `before` and `after` loaders of a comparison's generation. The
guard scrolls a same-document anchor into view by default. Comparison panes
pass a `reveal` hook instead, which moves their shared viewport.

The Frames And Lifecycle section of the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md)
defines the accepted responses, the document edits, and the read-only guard.
The Behavior section defines the stage states and the note for a viewport
without a captured view.

## Development

```bash
npm run build
cargo xtask check --suite viewer
```

### Key Code

- [`request.ts`](./request.ts) holds `previewEndpoint`, `requestPreview`, and
  `renewPreview`, which resolve, fetch, check, and renew the preview metadata
  of one removed entry.
- [`content.ts`](./content.ts) holds `screenContent` and `pageContent`, which
  derive the historical document addresses inside the accepted generation.
- [`presentation.ts`](./presentation.ts) holds
  `createSnapshotPresentationLoader`, the shared loader that fetches and
  prepares snapshot documents for previews and comparison panes.
- [`presentation_document.ts`](./presentation_document.ts) holds
  `presentSnapshotDocument`, which applies the base and refresh edits and
  serializes one document for `srcdoc`.
- [`snapshot_address.ts`](./snapshot_address.ts) checks a loader's generation
  and confines each address to the configured snapshot sides.
- [`read_only.ts`](./read_only.ts) holds `enforcePreviewReadOnly`, the guard
  that keeps a presented document readable but inert.
- [`presented_document.ts`](./presented_document.ts) holds
  `followPresentedDocument`, which finds a frame's viewer-owned `srcdoc`
  document as soon as it commits.
- [`descriptor.ts`](./descriptor.ts) holds `previewKey`, the identity of one
  preview request, and `readPreviewDescriptor`, which parses the
  `data-mokly-preview` attribute of a stage.
- [`copy.ts`](./copy.ts) holds `PREVIEW_UNAVAILABLE`, the unavailable copy and
  the Retry control of the shell.
- [`../shell/use_removed_preview.ts`](../shell/use_removed_preview.ts) is the
  route-owned controller that requests, renews, and discards a preview.
- [`../shell/previews.tsx`](../shell/previews.tsx) renders the loading,
  unavailable, and loaded stages with the device chrome of current screens.

Related boundaries: [the Browse client](../client/README.md), the
[shared shell](../shell/README.md), the
[selected comparison contract](../../../../docs/protocol/mokly-selected-comparisons.md),
the [comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md),
and the [comparison scrolling contract](../../../../docs/protocol/mokly-comparison-scrolling.md).
