# Comparison Generation And Serving

## Generation And Serving

A comparison generation is an immutable set of files under
`mokly-viewer/diffs/generations/<generation>/`: `entries/<entry path>.json`,
the entry detail of each removed entry under
the [shell delivery contract](./mokly-shell-delivery.md#entry-detail); the
removed previews of the [removed previews contract](./mokly-removed-previews.md);
and the before and after snapshots with their transitive resources at the
paths of the [artifact path contract](./mokly-artifact-paths.md). It holds no
review file: the index and the entry details carry the comparison's public
facts under the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4).
A file of a generation never changes after it is written or captured. Generation files
carry no deployment id and no revision: a removed entry's detail carries its
`detailId` and `snapshotId` instead, so one comparison gives the same bytes in
every build and in every Serve process. The generation name hashes the files
as they are. Every generation route answers GET and HEAD with
`X-Content-Type-Options: nosniff`; snapshot documents are `text/html`. In
Serve the generation root, the URL that ends with `<generation>/`, answers GET
and HEAD with 204 and no body while the generation is retained. The files of a
generation never change, so Serve sends them with
`Cache-Control: private, max-age=31536000, immutable`. The root's 204 answer
stays `no-store`. A static build writes no file for the root, and its shell
never requests it.

The [catalogue index](./mokly-shell-delivery.md#catalogue-index) names the
generation: `comparisonUrl` is the artifact-root-relative path of its root,
or `null` while Changes is not ready, is unavailable, or is disabled. A selected-only generation of the
[on-demand contract](./mokly-on-demand.md) leaves it `null`, and a superseded
completion cannot set it. Serve keeps the advertised classification's JSON
files, the removed entries' details and previews, while the current index
names it. Its snapshot files expire after 60 idle seconds. Reading a
generation renews its idle retention. After replacement, cached JSON and
snapshots follow the same idle rule. Cached files do not keep an old base
capture. A missing snapshot can be restored only while the current index's
publication, an in-flight request, or a capture owns the classification.
Otherwise the snapshot route returns 404 and starts no work, even while the
generation's cached JSON remains available.
Delivery files count against the 128 MiB comparison store. Each classification
can also retain a separate base capture of up to 256 MiB, beside the 256 MiB
render cache. Serve keeps at most one base capture between classifications,
under the [base lifetime rule](./mokly-base-preparation.md#serve-base-lifetime).
An old capture held by in-flight work can overlap a new
classification's capture. These bounds are separate, not a process memory limit.
A route whose generation is gone returns 404
and never redirects or starts work. The shell derives every snapshot and
preview URL from the generation root and the entry's path; no descriptor and
no second pointer exists.

## Serve

Serve classifies Changes in the background after HTTP is ready and publishes
each status move as one state under
[updates in Serve](./mokly-shell-delivery.md#updates-in-serve): the index and
the details are replaced in one step, `revision` rises by one, and the event
stream carries the new revision as its message id. The classification's
generation holds the removed entries' details and previews and no snapshot.
No shell request waits for a comparison, and no comparison data or snapshot
is requested until a reviewer selects a diff mode or opens a removed entry.

The development shell requests a comparison on demand at
`/mokly-viewer/diffs/selection?path=<entry path>` under the
[selected comparison contract](./mokly-selected-comparisons.md), and a
removed entry's preview under the
[removed previews contract](./mokly-removed-previews.md). Removed component
parents and variants use the index's advertised generation in every host.
In Serve, they renew its root before loading another view or mode. A static
shell checks `mokly-viewer/deployment.json` before it opens a comparison,
changes its view or mode, or opens a removed entry. Serve has no deployment
file and performs no such request.
The selection endpoint redirects to the root of an immutable generation named
`selected-<uuid>`. Its snapshots hold the base and head bytes of the
classification that it projects. Snapshot URLs resolve relative to that root.
A selected generation captures the selected entry's documents from the
completed background classification without reclassification; the entry's
detail carries its view states and evidence. Before the shell changes an open
comparison's view or diff mode, it renews the generation with a HEAD request
to its root. A missing or replaced generation is reacquired for the same
selection before new panes load, and a retained generation keeps its
presented documents. Retention,
capacity, coalescing, cancellation, and the request bounds belong to the
selected comparison contract. A content change or a Changes status move
invalidates pending captures and discards the cached selection. Superseded
snapshots stay available briefly for in-flight requests. Shutdown stops
admission and drains active generation work before the server exits.

When a comparison route of Serve fails, the shell never shows Serve's message.
A comparison that fails shows the one comparison failure of the
[pane lifecycle](./mokly-comparison-panes.md#lifecycle), whatever the cause.
Decision: the shell owns the failure text and never shows Serve's message,
so that a failure reads the same in every host. A protocol list of Serve's
failure codes was rejected, because the shell reads none of them.

Replacing an unfinished classification cancels the base that it prepares: its
base capture, its
[early renders](./mokly-base-preparation.md#shared-render-runtime), its base
workers, its source reads, and its sidecar calls. A replaced classification
that reads the kept base stops before its next call to that base. A call that
already runs finishes, and the kept base stays usable, under the
[kept base cancellation rule](./mokly-base-preparation.md#cancellation).
Command shutdown cancels both current and base work, the kept base included.

## Base And Head Capture

A capture is a bounded store of one side's rendered views. A later read of a
kept view restores it without a render. Each preparation of a base side
captures it, in Serve, `build`, and `publish`. A Serve classification that
reuses the kept base captures nothing again. `build` and `publish` also
capture the head side once, during the build check. Changes, the output, and
the comparison output read that head capture. Each side's capture has its own
256 MiB bound beside the render cache.
Decision: the head reuses the base capture, so a build renders each head
document once. A larger render cache, bounded render batches, and a reordered
build were rejected. No fixed cache bound fits every catalogue, batches still
render each document several times, and a reorder changes the build's stage
order.
Decision: each side has its own bound. A shared bound was rejected, because the
head is captured first and could leave no room for the base.

Route order is the byte order of the view routes. A capture takes each view at
its turn in route order, whatever order the renders end in. At that turn, it
records the view's validation facts, warnings, and failure, and it keeps the
view while the view fits its bound. A view that waits for its turn never
changes which earlier views the capture keeps. Complete validation and capture
must use the same rendered input for each view. Capture must preserve
validation failures and warning order, including when another view fails
later. A failed validation publishes no partial capture. A capture skips a view
that does not fit at its turn. It still keeps a later view that fits. The
side's validation summary, stylesheets, and asset digests come before views in
the same bound. When they need more room, the capture drops its last kept views
first.

A capture renders its views in a sliding window. The limit of the window is the
smaller of the [worker count](./mokly-on-demand.md#background-work-and-replacement)
and the [sidecar capacity](./mokly-sidecar-memory.md#capacity), and the limit
is at least one view. The next view in route order starts as soon as the window
has room.
A worker encodes each view when its render ends. Encoded views that wait for
their turn share the room that the capture bound has left.
Decision: the window slides, and waiting views share the capture bound. Fixed
batches were rejected, because one slow view leaves the other workers idle
until its batch ends. A bound of twice the window on started views was
rejected, because one slow view then stops new starts. A larger window for
views that the render cache holds was rejected, because an eviction can make
such a view render again beyond the capacity.

A view that a capture does not keep, or that fails to restore, comes from its
side's source when a comparison or the output needs it. Base capture misses use
the pinned source. The source renders the view again only when neither tier of
the [render cache](./mokly-runtime.md#render-graph-and-cache) holds it. The
comparison and the output have the same bytes whichever views a capture keeps
or the render cache holds. Only the number of views that render again changes.

Decision: a capture does not try a skipped view again. Strict route order,
which keeps no view after the first skip, was rejected, because it keeps fewer
views for no change in output. A second pass, which renders each dropped view
that fits the final capacity, was rejected, because it adds renders when memory
is tight. The default [large fixture](./mokly-timings.md#scale-fixture) does not
need that pass, because each side keeps every view within about a third of the
bound.

## View Comparison Reuse

Serve keeps the view comparisons of one classification, its last accepted
classification, for the
[proven view reuse](./mokly-changes-serving.md#proven-view-reuse) of the next
classification. A classification is accepted when Serve has published its
`ready` state and no replacement or shutdown has cancelled the classification.
Each accepted classification replaces the kept comparisons with its own. A
failed, cancelled, or superseded classification leaves them unchanged. `build`
and `publish` keep no view comparison and compare every view.
Decision: only Serve keeps view comparisons, in memory. A cache on disk or one
shared across commands was rejected, because it adds persistent state beyond
one Serve process.
Decision: a failed or cancelled classification keeps the earlier comparisons.
Keeping them with the published Changes state was rejected, because an
`unavailable` state would drop them, and the next classification would compare
every view again.

Reuse never changes output. A classification that reuses comparisons
publishes the same bytes as a full comparison of the same inputs: the index,
the entry details, the generation files, and the snapshots. It reports the
same Changes, moved, and ignored-only counts, the same warnings, and the same
failure diagnostics. Reuse changes no cancellation, publication, or capture
rule of this page.

The kept comparisons hold no document, no document tree, no resource bytes,
and no usage. They keep no base capture, no render generation, and no base
cache lease alive. Serve compares every view in full when it keeps no
comparison. It also compares every view in full when the base commit, the
selected base reference, the adopted configuration, or an effective comparison
setting differs from that of the kept comparisons.

The kept comparisons and the comparisons that each running classification
collects share one fixed byte bound of at most 32 MiB. A cancelled
classification that still drains counts too. A comparison that several of them
share counts once. The collected comparisons never pass the bound. A
classification whose comparisons do not fit still publishes its complete
output. When Serve accepts it, Serve keeps no comparison, and the next
classification compares every view in full. This bound is separate from the
comparison store, the base captures, and the render cache.
Decision: the bound is a fixed byte count of at most 32 MiB, one eighth of the
render cache bound. A limit on the number of views was rejected, because it
does not bound bytes.
Decision: comparisons that do not fit are not kept at all. Keeping the views
that fit, or the earlier comparisons, was rejected, because Serve keeps either
every comparison of its last accepted classification or none.

## Build And Publish

`build` writes one complete comparison into the output directory unless
`--no-changes` is given: it resolves the merge base once, renders both
sides through the render graph, classifies every entry and view, and writes
the generation beside the index, whose `comparisonUrl` names it and whose
`changesStatus` is `ready`. A static host serves the generation as plain
files. The [static delivery contract](./mokly-export-delivery.md) owns the
hosting rules, and a generation URL is never rewritten to another generation.
The viewer fetches and validates snapshot documents under the generation and
presents them in script-disabled frames; it never loads them as frame URLs.

A base whose sources fail the current validation makes Changes unavailable:
the build completes with
`comparisonUrl: null`, `changesStatus: "unavailable"`, no generation, and the
diagnostics in the terminal. A repository that cannot resolve the base ref or
the merge base fails `build` and `publish` with `git-failed` under the
[terminal errors contract](./mokly-terminal-errors.md). A comparison that
fails for another reason fails
the build before its output transaction writes, so the output directory is
unchanged. A build with `--no-changes` writes no generation and no removed entry, and
its `changesStatus` is `disabled`.

`publish` builds into its own directory outside the repository and uploads the
generation with the rest of the output through the
[upload exchange](./mokly-upload-exchange.md). A published catalogue serves
one generation until the next publication replaces it. Refresh and retry in a
built or published catalogue fetch the same generation. Only a new build and
deployment changes the comparison; a tab that meets a different
`deploymentId` performs a full page load under the
[identity rule](./mokly-shell-delivery.md#identity).
