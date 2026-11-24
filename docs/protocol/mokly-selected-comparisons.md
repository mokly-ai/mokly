# Selected live comparisons

A selected comparison compares, in Serve on demand, each compared row that the
canvas shows, head against base, in the row's shown views. It reads only those
rows' views and their resources. It never renders the whole catalogue,
reclassifies Changes, or compares a row that the canvas does not show; `build`
and the background Changes calculation stay exhaustive.

On the canvas, a component's [section](./mokly-shell-canvas-stage.md#section)
is its variant set: a row for its own example and then a row for each saved
variant. Every other entry's section, such as a screen's, is one row with all
of its frames. Each row is its own catalogue entry with its own path. Each
compared row has its own selection, its own generation, its own renewal, its
own failure, and its own retry. A row compares when its shown views are
eligible under the
[screen controls](./mokly-changes-controls.md#screen-controls): a Changed
view, a Removed view of a component parent or variant, or an Unmodified view
whose usage holds a changed component that the row's own entry detail names.
A row without a comparison, such as an Added variant or an Unmodified row that
uses no changed component, sends no request and keeps its current frames.

## Requests and evidence

While a diff mode is selected in Serve, the shell requests one selection for
each compared row that the canvas shows:
`/mokly-viewer/diffs/selection?path=<path>`, where the path names the row's
own screen or component entry, adding `refresh=1` for an explicit retry or
refresh. It never requests a row that the canvas does not show: a row whose
frames the [Frames filter](./mokly-shell-canvas-stage.md#frames-filter) hides,
and in Side by side every row but the one of the compared frame. Decision: a
variant set requests one selection for each compared row, not one selection
for the whole set and not one for the selected entry alone. Each row is its
own entry and Serve captures one entry for each selection, so a set-wide
request would change the endpoint and the server's capture.

The path uses the [path grammar](./mokly-paths.md#segment-grammar); the server
derives every address. There is no `variant` parameter, because a component
variant is an entry, and no removed-entry parameter, because a removed entry's
previous version is delivered with its detail under the generation that the
index's `comparisonUrl` names, under
[removed previews](./mokly-removed-previews.md). Current browsing never
requests comparison documents. A static build requests no selection: it
resolves every compared row's documents against its packaged `comparisonUrl`.
Its shell checks the
[deployment file](./mokly-export-delivery.md#static-navigation) once for each
change, when it opens the comparison or changes the shown views or the mode,
not once for each row. Removed component parents and variants also use the
advertised generation root in every host, row by row, including Serve, where
each removed row reads that root while the current rows of its set use their
own selections. Their retry uses that root in every host, and their HEAD
renewal in Serve uses it too.

The response redirects to `/mokly-viewer/diffs/generations/selected-<uuid>/`,
the root of an immutable in-memory generation. The root answers 204 with no
body, `no-store`, `nosniff`, and GET/HEAD parity. The selection's documents
resolve relative to that root and only from that generation; unknown paths, traversal, encoded separators, and private data
are unavailable through this route. No comparison directory is written.

Serve uses live delivery, and a static build and a React host use pinned
delivery. In live delivery, each row renews its own generation. A switch
between diff modes first renews each loaded row's generation with its own
non-cached HEAD request to its root, before the row's new panes load. A
change of one row's shown views renews that row's generation alone. A
successful response at that same URL extends the server's retention and lets
the shell reuse the generation before it displays the row's requested panes.
If a row's generation is missing or the response resolves to a different
generation, the shell requests that row's selection again, without
`refresh=1`, and renders the row only after its replacement generation is
ready. The other rows keep their generations. A removed component parent or
variant reacquires its advertised root instead of the selection endpoint. The
shell never reuses old document URLs after a failed renewal and never depends
on matching browser and server clocks.

Only live delivery renews a generation. Pinned delivery reads a fixed
generation that no server expires, so it sends no renewal request for a
comparison or a removed preview.

Repeated view or mode switches share each row's pending work. Each row loads
its latest views when its own work completes. The canvas shows the latest mode
once the work of every compared row has completed, so its frames never show
two modes at once. Navigation between
the entries of one variant set keeps the mode, every row's generation, and
every row's pending work, because the canvas keeps the same rows. It also
keeps Props and highlighting in their comparison states. Current, and
navigation that opens another section on the canvas, cancel every row's
requests and renewals, and a late response for any row cannot replace the
current view. A row that leaves the canvas cancels its pending request. When
it shows again in Serve, the shell renews the row's generation before any of
the row's new panes load. A new Serve revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve) cancels
every row's pending comparison, discards every row's cached selection, and
returns an active comparison to Current while it preserves the mounted
catalogue; the next explicit selection uses the new revision.

A row whose request meets a network or comparison failure shows the
[comparison failure state](./mokly-comparison-panes.md#lifecycle), with Try
again, on its own frames, and the other rows still compare. Try again requests
that row's selection again with `refresh=1`. Refresh requests the selection of
every compared row again with `refresh=1`.

The server captures the selection's entry from the completed background
classification without reclassification. Both sides
are the views the render graph composed for that classification under the
[comparison contract](./mokly-comparison.md): the head from the working tree
and the base from the base commit's Git tree under
[Sides](./mokly-comparison.md#sides), compared under
[materiality](./mokly-comparison.md#materiality) and
[style ownership](./mokly-comparison.md#style-ownership). Base views use the
bounded capture or pinned-source fallback. Head views use the bounded render
cache and render again from the same inputs after eviction. The base
commit is the one the accepted Changes snapshot pinned. Missing or pending
Changes evidence produces the retryable comparison failure state; the server
never falls back to an exhaustive foreground build.

The selection returns no comparison record. The
[detail](./mokly-shell-delivery.md#entry-detail) of the selection's entry
carries its comparison facts: its `before` address, view states, ignored
regions, rule and resource evidence with owners, and direct reasons, under the
[comparison records](./mokly-component-comparison-records.md). A component
parent's generation captures the documents of its own views, and a variant's
generation only the variant's documents. The parent record still supplies
the variant's evidence ownership in the variant's detail. Catalogue-wide
affected-consumer evidence stays in the entry detail's workspace. A missing
entry fails without capturing documents.

## Capture and lifetime

The generation holds the documents of both sides of every available view of
the selection, with the transitive resource closure of each
document under the [public closure policy](./mokly-public-closure.md); the
before side of a paired moved entry is the paired base entry's views, named
by `previousPath`. The head side reads resources from the working tree and
the base side from Git blobs, under the
[resources](./mokly-comparison.md#resources) rule. Base documents keep the bytes
from the bounded base capture or pinned-source fallback; head documents keep
the bytes from the bounded render cache. Panes present them without script permission under
the [comparison pane contract](./mokly-comparison-panes.md).

Identical pending selections coalesce. Different selections serialize, with
at most 32 pending requests and a ten-second deadline from admission to
completion. A Git command that a cancellation stops is drained with its
pipes. A source or Changes replacement aborts outstanding work, and stale
work cannot publish. Aborted work on the kept base of the
[base lifetime rule](./mokly-base-preparation.md#cancellation) stops before
its next call to that base. A Git read, a sidecar call, or a render that
already runs on the kept base finishes, and the kept base stays usable for
later captures. Shutdown stops admission, aborts
outstanding work, and drains it before releasing the cache. Refresh
regenerates the selection and coalesces with a pending capture for the same
accepted inputs.

Keep each generation for 60 seconds of inactivity so that in-flight frames
and replaced documents stay coherent. Requests extend that retention.
Keep the classification generation's JSON while the current index names it,
including removed details and preview metadata. Its snapshot files still expire
after 60 idle seconds. A later removed preview or component parent or variant
view restores them from the accepted base capture or pinned-source fallback.
The current index's publication, an in-flight request, or a capture must still
own the classification. After its last owner exits, a missing snapshot returns 404 and starts no work, even
while the generation's cached JSON remains available. After replacement,
cached JSON and snapshots follow the idle rule too.
Each classification can retain a separate base capture of up to 256 MiB,
beside the graph's 256 MiB render cache. Serve keeps at most one base capture
between classifications. An old capture held by in-flight work
can overlap a new capture. These are separate bounds, not a process memory limit.
Count all retained delivery JSON and snapshots against the same store bounds. Bound
retained generations to 64 and 128 MiB, and each generation to 64 MiB.
Reject new captures that exceed capacity rather than removing documents still
within their retention window. When retained generations fill the store,
classification waits for capacity without rerendering or reclassifying. It
remains pending until capacity is free, or replacement or shutdown cancels it. Metadata larger than 64 MiB fails without retry.
Expired generations are collected
periodically and before a new capture. A failed refresh preserves the
earlier documents and does not poison later requests. An idle open
comparison does not keep a row's generation alive; the row's next view or mode
switch renews or reacquires it before the row's new panes load.
