# Previous versions of removed entries

These modules turn a removed page, Markdown document or screen into the version from the pinned
Changes baseline, for the shell of Serve, of a static build and of an embedded
`@mokly/viewer` alike. They implement the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md).

`descriptor.ts` reads the stage host's `data-mokly-preview` attribute that
[`../shell/previews.tsx`](../shell/previews.tsx) renders. A damaged or unknown
descriptor advertises
nothing, so the stage reports the unavailable state instead of requesting an
address the catalogue never published.

[`request.ts`](./request.ts) resolves that descriptor to one metadata address
inside the comparison generation that the catalogue's `comparisonUrl` names:
the removed entry's detail, `entries/{path}.json`, for a screen, and
`previewMetadataPath(path)` for a page or document. Serve, static delivery,
and embedded hosts use the same addresses. A missing
advertisement makes the preview unavailable without a request. Pages use the light `snapshotDocumentPath`; Markdown documents use
each historical scheme. `content.ts` derives these paths, and selection loads
only the requested document scheme, with a light fallback.
Screen documents use `snapshotViewPath("before", ...)` only for the removed
detail's views whose state is `removed`; the detail carries no stored
before/after paths. Before accepting a screen, the request compares the
detail's `snapshotId` with the selected one. Before accepting a page or
document, it recomputes the selected historical identity from the metadata's
baseline commit. A generation-backed selection
must resolve from the immutable generation named by request and final response.
This keeps a late response or Retry from replacing an open historical record
after the baseline changes. `renewPreview`
extends a live generation's retention before reusing it, exactly as comparisons
do. `advertisedPreviewPaths` returns accepted metadata in `files` and the
comparison generation's `snapshots/before/` and `snapshots/after/` directories
in `prefixes` through the shared `snapshotSidePath` builder. This internal
helper has no runtime consumer: it models the
documented embedded fetch set for tests, while each presentation loader enforces
its own generation and side boundaries. Page and document preview metadata uses version 3.

`presentation.ts` owns the shared snapshot-presentation loader.
`createSnapshotPresentationLoader(generationAddress, sides, delivery,
environment)` takes one immutable generation URL and a typed, non-empty side
set.
Removed previews configure only `before`; comparisons configure `before` and
`after`. The side set also selects the stable unavailable copy, so callers do
not classify errors by message. A loader confines every address beneath an
allowed `snapshots/<side>/` subtree, applies the comparison credential and
cancellation rules, caches each accepted address, shares non-aborted in-flight
work and removes failures for Retry. It accepts only a successful `text/html`
response within 64 MiB whose final URL is the requested address or its
provider-normalized extensionless form; an `index.html` document also accepts
its containing directory with or without a trailing slash. It parses without scripting, removes
consumer base and refresh directives, prepends the single effective base, and
serializes the preserved doctype and other nodes for `srcdoc`. These edits
affect only the in-memory presentation; snapshot and comparison bytes do not
change.

[`copy.ts`](./copy.ts) owns the unavailable copy and Retry hook of the shell.
[`shell/previews.tsx`](../shell/previews.tsx)
owns loading, retry and loaded states,
using the same device chrome components as current screens. A selected viewport
with no captured view keeps a note where its frame would be rather than an empty
stage; its `mbk-preview-note` and `mbk-preview-switch` classes match the design
catalogue, and the stylesheet hides the closing sentence while both viewports
are shown. `presented_document.ts` recognises a frame's viewer-owned `srcdoc`
document from the moment it commits and follows its replacements: it inspects
the frame on attach, on every `load`, and one animation frame after the current
window's `pagehide`, so slow resources that hold back `load` never delay the
guard. `read_only.ts` guards every viewer-owned presentation from that commit.
It cancels all link and form activation, shows a same-document fragment itself
without applying `:target` (scrolling it into view for removed previews, or
through the caller's `reveal` hook, which comparison panes use to reveal inner
regions and then their page viewport), preserves Space for scrolling, and
reapplies the accepted `srcdoc` if the frame navigates away.
[`../shell/use_removed_preview.ts`](../shell/use_removed_preview.ts) is the
route-owned controller: it starts in the loading state, requests on selection,
fetches every document
needed for that viewport and scheme before reporting ready, renews before
reusing a live presentation, and discards work after route replacement or
unmount.

The controller and the typed detail and metadata readers are bundled once into
the standalone shell, `dist/browser/shell.js`. Serve, `build` and
application-owned `@mokly/viewer` roots therefore use the same React lifecycle
without a second Browse runtime.

```bash
npm run build
cargo xtask check --suite viewer
```

The [comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md)
reuses this pipeline for the Before and Current panes of a comparison:
[`../shell/use_comparison_documents.ts`](../shell/use_comparison_documents.ts)
creates a `before` and `after` loader for
the accepted comparison's immutable generation and presents every selected pane
document before the comparison is ready. Removed previews keep accepting
`snapshots/before/` only.

Related boundaries: [the Browse client](../client/README.md), the
[shared shell](../shell/README.md), the
[selected comparison contract](../../../../docs/protocol/mokly-selected-comparisons.md),
the [comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md),
and the [comparison scrolling contract](../../../../docs/protocol/mokly-comparison-scrolling.md).
