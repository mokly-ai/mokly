# mokly-server HTTP delivery

This page is part of the [`mokly-server` README](./README.md) and holds its
HTTP delivery guidance.

## Documents and routes

`GraphDocuments` implements `dyn Documents`. It coalesces requests for the
same document. Public authored reads require both reached closure membership
and a fresh policy check under the
[public closure contract](../../docs/protocol/mokly-public-closure.md).
`ConfinedReader` opens each directory and the final regular file without
following symlinks. Routes never fall back to repository files. The built
viewer's browser manifest lists the only client modules served. The shared
shell declares the Browse brand SVG at `/mokly-viewer/client/brand.svg`, and
the asset loader serves the matching packaged icon for both Serve and static
output.

## Generated assets

Generated opaque assets follow the
[CSS assets contract](../../docs/protocol/mokly-imported-styles-assets.md).
`GraphDocuments::asset_request` reserves the capture of a route before
foreground worker admission, without IO. `GraphDocuments` keeps a weak entry
for each route, so concurrent requests of its generation join one capture.
A request that waits for a worker already holds its capture. The first
admitted request verifies the asset through `dyn AssetStreams` into an
unnamed temporary file. The other requests wait for that result and share it.
The first capture of a route in a generation computes the `ETag` of the
verified file, and later captures of that route reuse it.
A failure keeps its original type, so the CLI still requests a new generation
after an input change. Each response reads the shared file at its
own byte offset, with `read_at` on Unix and `seek_read` on Windows. The last
request or response that holds the capture closes the file, and no idle copy
stays. Worker parallelism bounds active captures, and the opened length bounds
each file. Live response files have no aggregate byte bound. The OS temporary
directory can use `tmpfs`, whose storage consumes memory outside process RSS
measurements.

## Authored files

An authored GET or HEAD opens the confined handle and compares its length and
bytes with the last capture of that route in the same generation. Equal bytes
reuse that capture and its `ETag`. Other bytes become a new capture in an
unnamed temporary file, with a new `ETag`. Each `GraphDocuments` keeps the
last capture of every authored route that it serves. A read that finds no
readable file drops the capture of its route. These captures have no
aggregate byte bound. The response streams from the capture without a
file-size limit, and HEAD sends no bytes. Serve delivers document and preview
HTML without frame probe injection.

## Cache headers

Generated stylesheets, generated assets, and authored assets carry a strong
SHA-256 `ETag` of their bytes and `Cache-Control: no-cache`, under the
[runtime routes](../../docs/protocol/mokly-runtime.md#routes). A matching
`If-None-Match` gets 304 without a body. Each `ETag` is computed once for each
version of a resource. `GraphDocuments` keeps each generated stylesheet that it
serves, with its `ETag`, for the rest of its generation. The files of a
comparison generation carry `Cache-Control: private, max-age=31536000, immutable`,
under the
[generation rule](../../docs/protocol/mokly-comparison-serving.md#generation-and-serving).
Every other response carries `Cache-Control: no-store`, generated documents,
the generation root, and the selection redirect included.

## JSON compression

Every JSON response carries `Vary: Accept-Encoding`, under the
[shell delivery routes](../../docs/protocol/mokly-shell-delivery.md#routes).
When the request accepts gzip, a JSON body goes out with
`Content-Encoding: gzip`. The gzip body decodes to the canonical bytes. Each
publication compresses each of its JSON files at most once, at a fast level,
on the first request that accepts gzip. Concurrent requests wait for that one
encoding and share its bytes. The bytes drop with their publication, after its
last response ends. A comparison generation also compresses each JSON file at
most once. It drops the gzip bytes with that file. These bytes do not count
against the comparison store bound. A temporary preview compresses its
JSON file on each request and keeps no compressed copy. An authored or
generated JSON asset keeps its gzip copy in a second temporary file, with its
own `ETag`. Compression runs on a blocking thread and takes no render worker.
A failed encoding sends the identity body. Error bodies always use the
identity encoding.

## Comparison generations

`MemoryComparisons` implements `dyn Comparisons`, the store of the
[selected comparison contract](../../docs/protocol/mokly-selected-comparisons.md).
Classification generations start with the removed details. Selected captures
find one screen, component, or variant in the retained review and copy only
its view closures; they hold no JSON. A variant selection captures only the
selected variant's documents. The selection route redirects to the root of the
captured generation, and a GET or HEAD of a retained root renews its idle
window with 204. Historical routes capture the removed entry from the same
pinned base. Captures preserve original document bytes. `FrozenResources`
retains document and resource hashes. It rejects changed public bytes or an
inconsistent document after cache eviction before a capture can install a
mixed generation. Its `comparison_capture` method returns `None`, so capture
creation and smaller budgets cannot bypass these checks through the wrapped
generation. It forwards `comparison_parallelism`, `capture_parallelism`,
`schedule_capture_window`, `schedule_comparison_tasks`, and
`schedule_comparison_stream` to the wrapped generation. Scheduled tasks still
call its checked reads. Its capture collector wraps the
`ComparisonEncoder` of the inner collector. So each capture worker checks the
original document bytes and the digests of the closure's resources before it
encodes a view. The collector forwards `remaining`, so the waiting views keep
the same byte bound. It keeps the default `None` of
`retained_comparison_input`, because a forward could bypass these checks or
need source IO. The contract owns the admission, retention, and capacity
limits.

## Temporary previews

Temporary renders follow the
[live controls contract](../../docs/protocol/mokly-component-controls.md),
which owns the `Host`, `Origin`, and token checks and the preview store
limits. They validate the installed revision, view, controls, and complete
props. The props check uses the prepared validators that each snapshot copies
from its generation's catalogue. They use the graph's shared prop render path
outside the HTTP event
loop. Body reads keep only the authorization token. Validation and render
admission take the current snapshot after the body arrives, so a stalled body
cannot retain a replaced snapshot or its comparison capture. The CLI supplies
the shared JavaScript runtime, so React entries use the same pool, cache,
renderer, PostCSS, and fragment keys as their saved views. `MemoryPreviews`
holds the preview bundles.
