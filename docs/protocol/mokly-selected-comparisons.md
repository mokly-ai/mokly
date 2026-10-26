# Selected live comparisons

A selected comparison compares one shown view in Serve on demand: the screen
or component entry the reader opened, at the selected viewport and colour
scheme, head against base. It reads only that entry's views and their
resources. It never renders the whole catalogue, reclassifies Changes, or
compares other entries; `build` and the background Changes calculation stay
exhaustive.

## Requests and evidence

The shell requests `/mokly-viewer/diffs/review.json?path=<path>` when a
reader selects a diff mode, where the path names the selected screen or
component entry, adding `refresh=1` for an explicit retry or refresh. The
path uses the [path grammar](./mokly-paths.md#segment-grammar); the server
derives every address. There is no `variant` parameter, because a component
variant is an entry, and no removed-entry parameter, because a removed
entry's previous version is delivered with its detail under the generation
that the index's `comparisonUrl` names, under
[removed previews](./mokly-removed-previews.md). Current browsing never
requests comparison documents; a static build uses its packaged
`comparisonUrl` without parameters. Removed component parents and variants
also request the advertised generation URL in every host, including Serve.
Their HEAD renewal and retry use that same URL.

The response redirects to
`/mokly-viewer/diffs/generations/selected-<uuid>/review.json`, an immutable
in-memory generation served with `no-store`, `nosniff`, and GET/HEAD parity.
Its documents resolve relative to that response URL and only from that
generation; unknown paths, traversal, encoded separators, and private data
are unavailable through this route. No comparison directory is written.

Changing viewport or colour scheme inside a comparison, or switching between
diff modes, first renews the loaded generation with a non-cached HEAD request
to its `review.json` URL. A successful response at that same URL extends the
server's retention and lets the shell reuse its loaded JSON before it
displays the requested panes. If the generation is missing or the response
resolves to a different generation, the shell fetches the stable endpoint
again, without `refresh=1`, and renders only after the replacement result is
ready. A removed component parent or variant reacquires its advertised URL
instead of the selected endpoint. It never reuses old document URLs after a failed renewal and never
depends on matching browser and server clocks.

Repeated view or mode switches share pending work and apply the latest axes
and mode when it completes. Navigating to a sibling entry keeps that mode,
requests the sibling's own result, keeps Props and highlighting in their
comparison states, and fences the earlier response. Current and navigation
cancel both renewal and comparison requests; late responses cannot replace
the current view. A new Serve revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve)
cancels pending comparisons, discards the cached selection, and returns an
active comparison to Current while it preserves the mounted catalogue; the
next explicit selection uses the new revision. Network and comparison
failures use the comparison failure state with explicit retry.

The server projects the completed background classification onto the
selected entry without reclassification. Both sides
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

The result is the review result v8 projected onto the selected entry: its
sides, `previousPath`, view states, ignored regions, rule and resource
evidence with owners, and direct reasons, under the
[comparison records](./mokly-component-comparison-records.md). A component
parent's response carries its own views and no variants. A variant's response
retains its component parent with only the selected variant in `variants`.
The parent record supplies the variant's evidence ownership. The generation
captures only the variant's documents. Catalogue-wide affected-consumer
evidence stays in the entry detail's workspace; the selected response omits
affected records and diagnostics. The response passes the v8 validator. A
missing entry fails without inventing records.

## Capture and lifetime

The generation holds the review JSON and the documents of both sides of every
available view of the selection, with the transitive resource closure of each
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
work cannot publish. Shutdown stops admission, aborts
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
beside the graph's 256 MiB render cache. An old capture held by in-flight work
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
comparison does not keep its generation alive; its next view or mode switch
renews or reacquires it before new panes load.
