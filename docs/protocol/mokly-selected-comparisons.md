# Selected live comparisons

A live comparison reads only the selected screen or component variant and its
resources. It never compiles the consumer, checks unrelated output, reclassifies
the catalogue, or snapshots other entries; exhaustive commands remain unchanged.

## Delivery Status

Implemented with entries selected by path and review result v6. Removed pages
and Markdown documents use the shared selected-preview boundary.

## Requests and evidence

The live browser requests `/mokly-viewer/diffs/review.json?path=<path>`, where the
path names the selected screen or component variant entry, adding `refresh=1`
for an explicit retry or refresh, or `page=<path>` for a removed page's or
document's [preview](./mokly-removed-previews.md). Both values use the
[path grammar](./mokly-paths.md#segment-grammar); the server derives file
names. There is no `variant` parameter because a component variant is an
entry. Current browsing never requests
snapshots; static delivery uses its packaged comparison URL without parameters.
Changing viewport or color scheme inside a comparison, or switching between diff
modes, first renews a loaded live generation with a non-cached HEAD request to its
immutable `review.json` URL.
A successful response at that same URL extends the server's retention and lets
the browser reuse its loaded JSON before displaying the requested panes. If the
generation is missing or the response resolves to a different generation, fetch
the stable selected endpoint again, without `refresh=1`, and render only after
the replacement result is ready. Do not reuse old snapshot URLs after failed
renewal or depend on matching browser/server expiry clocks. Static delivery
reuses its packaged result without renewal requests.

Repeated view or mode switches share pending work and apply the latest axes and
mode when it completes. Navigating to a sibling component variant retains that
mode, requests the sibling's own result, keeps Props and highlighting in their
comparison states, and fences the previous response.
Current and navigation cancel both renewal and capture requests; late responses
cannot replace the current view. Background [evidence updates](./mokly-live-evidence.md)
also cancel pending comparisons, discard their cached selection and return an
active comparison to Current while preserving the mounted catalogue. The next
explicit comparison uses the newly accepted evidence. Network and capture
failures use the existing comparison failure state and explicit retry.

The live server uses the accepted complete manifest and background Changes
snapshot. Background classification retains the pinned branch-point commit,
the [baseline catalogue descriptor](./mokly-baseline-addressing.md#comparison-namespaces)
for route/resource addressing across historical catalogue roots,
changed paths, and SHA-256 digests of current generated views and resources it
reads. Those digests are private IPC data, not published comparison fields.
Every current selected document requires a digest. Capturing a known input with
different bytes fails instead of combining old evidence with new output. Missing
or pending evidence produces the existing retryable comparison failure state;
it never falls back to an exhaustive foreground build.

Project the complete [review result v6](./mokly-changes-serving.md#comparison-engine)
onto the selected entry: a screen, or a component variant entry addressed by
its path. Keep its entry sides, `previousPath`, view states, ignored regions
and direct change reasons. Recompute the selected screen ignored-impact
aggregate. Catalogue-wide
affected-consumer evidence remains in the shell inspector; the selected
response omits those cross-entry records. Screen-only catalogues apply the same
policy as complete comparisons to the requested screen only. The response
passes the v6 result validator. Missing entries fail without inventing
comparison records.

## Capture and lifetime

Capture every available view of the selection and only its transitive resource
closure. Copy accepted v9 before/after documents byte-for-byte to paths from
`snapshotViewPath` in the
[artifact path contract](./mokly-artifact-paths.md); the before side of a paired
moved entry is the paired baseline entry's views, named by `previousPath`.
Baseline reads use the pinned
Git commit and bounded batches of regular files. Current reads retain the public
file and source-confinement rules. Resource hints not read by classification are
validated and captured on demand. Panes present those documents without script
permission under the [comparison pane contract](./mokly-comparison-panes.md).

The stable request redirects to
`/mokly-viewer/diffs/generations/selected-<uuid>/review.json`. JSON and snapshot
files belong to that immutable generation, are served with `no-store` and
`nosniff`, and resolve only from its captured file map. These in-memory generations
create no comparison output directories. HEAD returns the same headers without
a body. Unknown paths, traversal, encoded separators and private metadata are
unavailable through this route.

Identical pending selections coalesce. Different selections serialize, with at
most 32 pending requests and a ten-second admission-to-completion deadline.
Git cancellation drains the process and its pipes. A source/Changes invalidation
aborts outstanding capture and changes the cache epoch; stale work cannot publish.
Shutdown stops admission, aborts outstanding work and drains it before releasing
the cache. Refresh regenerates the selected snapshot; it coalesces with an already
pending capture for the same accepted source snapshot.

Retain each generation for 60 seconds of inactivity so in-flight frames and
replaced snapshots stay coherent. Requests extend that retention. Bound retained
artifacts to 64 generations and 128 MiB, and each artifact to 64 MiB. Reject new
captures that exceed capacity rather than removing snapshots still within their
retention window. Expired entries are collected periodically and before new
capture. A failed refresh preserves previous snapshots and does not poison later
requests. An idle open comparison does not keep its snapshots alive; its next
view or mode switch renews or reacquires them before loading new panes.

## Verification

Regressions must prove that selection avoids unrelated output reads and renderer
work, includes only the chosen entry, and keeps the existing before/after bytes.
Cover screen-only and component catalogues, removed and added sides,
themes/viewports, asset isolation, input mutation, malformed requests,
coalescing, refresh, invalidation, cancellation, shutdown and retry. Advance
the server clock to prove that idle screen and component variant comparisons
recover after snapshot collection, without failed pane
requests. Cover HEAD retention extension, repeated switches during renewal,
abandoned renewals, retry and static delivery's absence of renewal traffic.
Measure real browser comparison readiness on the large fixture
separately from startup and background Changes; a JSON response alone is not a
visible comparison.
