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
carry no deployment id and no revision: a removed entry's detail carries the
generation and its `snapshotId` instead, so one comparison gives the same
bytes in every build and in every Serve process. Every generation route
answers GET and HEAD with `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; snapshot documents are `text/html`. In
Serve the generation root, the URL that ends with `<generation>/`, answers GET
and HEAD with 204 and no body while the generation is retained. A static
build writes no file for the root, and its shell never requests it.

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
render cache. An old capture held by in-flight work can overlap a new
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
In Serve, they renew its root before loading another view or mode.
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

Complete base validation and capture must use the same rendered input for each
view. Capture must preserve validation failures and warning order, including
when another view fails later. A failed validation publishes no partial capture.

Replacing an unfinished classification cancels its base capture, its base
workers, its source reads, and its sidecar calls. Command shutdown cancels
both current and base work.

## Base And Head Capture

A capture is a bounded store of one side's rendered views. A later read of a
kept view does not render the view again. Each classification captures its
base side in Serve, `build`, and `publish`. `build` and `publish` also capture
the head side. The [render cache rules](./mokly-runtime.md#render-graph-and-cache)
give the bound of each side.

Route order is the byte order of the view routes. A capture keeps views in
route order while they fit its bound. It skips a view that does not fit when
that view arrives. It still keeps a later view that fits. The side's validation
summary, stylesheets, and asset digests come before views in the same bound.
When they need more room, the capture drops its last kept views first.

A view that a capture does not keep comes from its side's source when a
comparison or the output needs it. The source renders the view again unless
the render cache still holds it. The comparison and the output have the same
bytes whichever views a capture keeps. Only the number of views that render
again changes.

Decision: a capture does not try a skipped view again. Strict route order,
which keeps no view after the first skip, was rejected, because it keeps fewer
views for no change in output. A second pass, which renders each dropped view
that fits the final capacity, was rejected, because it adds renders when memory
is tight. The default [large fixture](./mokly-timings.md#scale-fixture) does not
need that pass, because each side keeps every view within about a third of the
bound.

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
