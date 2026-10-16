# Comparison Generation And Serving

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Generation And Serving

A comparison generation is an immutable set of files under
`mokly-viewer/diffs/generations/<generation>/`: `review.json`, the
[review result v8](./mokly-comparison.md#review-result-v8-and-snapshot-v4);
`snapshot.json`, the catalogue change snapshot v4 in static output;
`entries/<entry path>.json`, the entry detail v1 of each removed entry under
the [shell delivery contract](./mokly-shell-delivery.md#entry-detail); the
removed previews of the [removed previews contract](./mokly-removed-previews.md);
and the before and after snapshots with their transitive resources at the
paths of the [artifact path contract](./mokly-artifact-paths.md). A file of a
generation never changes after it is written or captured. Generation files
carry no deployment id and no revision: a removed entry's detail carries the
generation and its `snapshotId` instead, so one comparison gives the same
bytes in every build and in every Serve process. Every generation route
answers GET and HEAD with `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; snapshot documents are `text/html`.

The [catalogue index](./mokly-shell-delivery.md#catalogue-index) names the
generation: `comparisonUrl` is the artifact-root-relative path of its
`review.json`, or `null` while Changes is not ready, is unavailable, or is
disabled. A selected-only generation of the
[on-demand contract](./mokly-on-demand.md) leaves it `null`, and a superseded
completion cannot set it. Only reading a generation renews its retention;
publishing the pointer does not. A route whose generation is gone returns 404
and never redirects or starts work. The shell derives every snapshot and
preview URL from that response URL and the entry's path; no descriptor and no
second pointer exists.

## Serve

Serve classifies Changes in the background after HTTP is ready and publishes
each status move as one state under
[updates in Serve](./mokly-shell-delivery.md#updates-in-serve): the index and
the details are replaced in one step, `revision` rises by one, and the event
stream carries the new revision as its message id. The classification's
generation holds `review.json` and the removed entries' details and no
snapshot. No shell request waits for a comparison, and no comparison data or
snapshot is requested until a reviewer selects a diff mode or opens a removed
entry.

The development shell requests a comparison on demand at
`/mokly-viewer/diffs/review.json?path=<entry path>` under the
[selected comparison contract](./mokly-selected-comparisons.md), and a
removed page's or document's preview under the
[removed previews contract](./mokly-removed-previews.md). The response
redirects to an immutable generation named `selected-<uuid>`, whose files are
captured in memory from the render cache and the base-side render; snapshot
URLs resolve relative to that response URL. A selected generation projects the
completed background classification onto the selected entry; it renders
nothing again and reclassifies nothing. Before the shell changes an open
comparison's view or diff mode, it renews the generation with a HEAD request.
A missing or replaced generation is reacquired for the same selection before
new panes load, and a retained result reuses its loaded JSON. Retention,
capacity, coalescing, cancellation, and the request bounds belong to the
selected comparison contract. A content change or a Changes status move
invalidates pending captures and discards the cached selection. Superseded
snapshots stay available briefly for in-flight requests. Shutdown stops
admission and drains active generation work before the server exits.

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
