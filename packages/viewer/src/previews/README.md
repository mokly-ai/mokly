# Previous versions of removed entries

These modules turn a removed page or screen into the version from the pinned
Changes baseline, for the served shell, a static export and an embedded
`@mokly/viewer` alike. They implement the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md).

`descriptor.ts` reads the stage host's `data-mokly-preview` attribute that
`shell/previews.tsx` renders. A damaged or unknown descriptor advertises
nothing, so the stage reports the unavailable state instead of requesting an
address the catalogue never published.

`request.ts` resolves that descriptor to one metadata address. Development uses
the stable selected endpoint (`route=` for a screen, `page=` for a page); static
delivery uses `comparisonUrl` for a screen and the catalogue's advertised
`preview.path` for a page, after checking that the path belongs to the
comparison's generation and to this exact route. A page's documents resolve
against the generation root, not the descriptor's own directory. Screen views
render only where the comparison says `removed`; any `afterPath` for that route
means a reused generation and is treated as unavailable. Before accepting
either kind, the request recomputes the selected historical identity from the
metadata's baseline commit. Legacy generation-backed selections must resolve
from the same immutable generation named by both the request and final response.
This keeps a late response or Retry from replacing an open historical record
after the baseline changes. `renewPreview`
extends a live generation's retention before reusing it, exactly as comparisons
do. `advertisedPreviewPaths` returns accepted metadata in `files` and the
historical document directory in `prefixes` so an embedded viewer can enforce
each kind of advertised path separately.

`presentation.ts` fetches each metadata-named document beneath that
generation's `snapshots/before/`, applies the comparison credential and
cancellation rules, and accepts only a successful `text/html` response within
64 MiB whose final URL is the requested address or its provider-normalized
extensionless form. It parses without scripting, removes consumer base and refresh
directives, prepends the single effective base, and serializes the preserved
doctype and other nodes for `srcdoc`. These edits affect only the in-memory
presentation; snapshot and comparison bytes do not change.

`copy.ts` owns the unavailable copy and Retry hook shared by the server render
and hydrated shell. `shell/previews.tsx` owns loading, retry and loaded states,
using the same device chrome components as current screens. A selected viewport
with no captured view keeps a note where its frame would be rather than an empty
stage; its `mbk-preview-note` and `mbk-preview-switch` classes match the design
catalogue, and the stylesheet hides the closing sentence while both viewports
are shown. `read_only.ts` guards every viewer-owned presentation. It cancels all
link and form activation, scrolls a same-document fragment itself without
applying `:target`, preserves Space for scrolling, and reapplies the accepted
`srcdoc` if the frame navigates away. `shell/use_removed_preview.ts` is the
route-owned controller: its first effect replaces the honest server-rendered
unavailable state with loading, requests on selection, fetches every document
needed for that viewport and scheme before reporting ready, renews before
reusing a live presentation, and discards work after route replacement or
unmount.

The controller and typed review validators are bundled once into the shared
`react-shell.js` hydration entry. Serve, static export and application-owned
`@mokly/viewer` roots therefore use the same React lifecycle without a second
Browse runtime.

```bash
npm run build
npx tsx --test tests/client_removed_previews.test.ts tests/removed_preview_shell.test.ts
npx playwright test tests/browser/removed_previews.spec.ts tests/browser/removed_preview_views.spec.ts tests/browser/removed_previews_static.spec.ts tests/browser/removed_previews_viewer.spec.ts
```

The [comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md)
reuses this pipeline for the Before and Current panes of a comparison, whose
loaders also accept `snapshots/after/`; the
[comparison pane scroll alignment plan](../../../../plans/comparison-pane-scroll-alignment.md)
delivers that generalization of `presentation.ts` and `request.ts` in its
Milestone 3 while removed previews keep accepting `snapshots/before/` only.

Related boundaries: [the Browse client](../client/README.md), the
[shared shell](../shell/README.md), the
[selected comparison contract](../../../../docs/protocol/mokly-selected-comparisons.md),
and the [comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md).
