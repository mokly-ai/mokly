# On-demand Serve

## Startup And Completeness

Serve validates the configuration, the catalogue model, the routes, the
hierarchy, the prop schemas, and the [source inventory](./mokly-source-protection.md#complete-source-inventory) before it listens.
Validation creates one immutable route set from the model's identities; a
request for a route outside that set is 404, and a new catalogue state
creates a new set. Serve does not render every document, classify Git
changes, or write anything before Browse is available. This applies with and
without watch.

The catalogue index describes the available views, not completed rendering.
A view's usage in its entry detail is `pending` until that view has rendered,
`ready` after it, and `unavailable` when its render failed; the shell never
shows a pending view as zero consumers. `build` is exhaustive: it renders
every view before it writes, so a built detail never carries a `pending`
view.

The scale target is command start to searchable navigation and a real selected
preview visible in under five seconds, cold and warm, on the large fixture of
the [timings contract](./mokly-timings.md). A listening socket or an empty
stub does not satisfy that target. No validation is skipped to meet it.

## Foreground Documents

A request for `/static/mokly-generated/<route>` renders the document on first
request, unless the [render store](./mokly-render-store.md) holds it. A
JavaScript fragment renders through the
[sidecar](./mokly-sidecar.md) under its deadlines; an HTML screen or component
renders without the sidecar. The finished document stays in the render cache
until an input changes or it leaves the cache under the
[cache bounds](./mokly-runtime.md#render-graph-and-cache). The next request for
a document that left the cache reads it from the render store or renders it again.

Concurrent requests for one document share one render. Foreground requests
take priority over background work: a background lookup or render that has
not started does not start while a foreground request is active, and a
foreground render that needs a sidecar does not wait behind queued background
renders. A foreground request that finds every worker busy with background
views waits until the first of them ends,
[hands off](./mokly-on-demand-background.md#batch-and-completion), or
[misses its lookup](./mokly-on-demand-background.md#window-and-lookup). An
active lookup or render is not interrupted. A failed
render answers 500, enters no cache, and makes no other route unavailable.
Its typed diagnostic goes to the selected CLI reporter on stderr; the HTTP
response carries the safe error envelope. A render that passes its deadline
fails the same way after the sidecar contract's one retry.

Stylesheet and asset routes answer from the same graph: a bundled stylesheet
from the stylesheet bundle node with its CSS content type, an imported asset
under the [imported styles contract](./mokly-imported-styles.md), and an
authored asset from the roots under the
[public closure policy](./mokly-public-closure.md). Resource validation
accepts a route whose node has not rendered yet. A document carries its
[build warnings](./mokly-build-warnings.md) beside its HTML. Serve reports
new warnings under the [attempt-scoped reporting rule](./mokly-build-warnings.md#watched-serve-generations),
including a view first rendered on demand. Repeated requests repeat no warning.

Live prop edits of the [controls contract](./mokly-component-controls.md)
render through this same path with the edited props. Their temporary documents
and resources never replace a saved document and never enter the catalogue
model or the render store.

## Background Work And Replacement

After readiness, Serve renders every view in the background, or reads it from
the render store, which fills the render cache and the usage of every detail,
then classifies Changes, which renders the base side under the
[comparison contract](./mokly-comparison.md#sides). The
[background pass](./mokly-on-demand-background.md) defines how this pass
starts, looks up, renders, reports, and stops its views.

No base work of a classification, its
[early renders](./mokly-base-preparation.md#shared-render-runtime) included,
starts before the background pass of its state ends.
Decision: base work waits for the background pass. Rejected: base preparation
or early renders during the pass, because the memory of head and base work
would then add up.

Sidecar admission preserves foreground priority for each whole HTTP render.
Queued base calls wait until those requests finish their sidecar work. While
those of a base capture or its early renders wait, they hold no render worker
that foreground renders use. The queued calls of started background views go
after the other queued head calls, such as the calls of HTTP renders. The
later calls of a view in the
[completion stage](./mokly-on-demand-background.md#batch-and-completion) are
such calls. So a batch view can wait behind them while it holds its worker. A
call of a started view does not wait for the end of an HTTP request. Active
calls finish under their deadlines.

Head and base calls share the
[sidecar capacity](./mokly-sidecar-memory.md#capacity), including a capacity
of one. Each admitted call holds a [claim](./mokly-sidecar-memory.md#claims)
on that capacity until the call ends.

Decision: each admitted call holds a claim. The pool size was rejected,
because calls that a default pool cannot start would wait in its queue ahead
of later foreground calls. A capacity reading alone was rejected, because
memory can fall before the call reaches the pool, with the same result.

Decision: the queued calls of started background views go after the other
queued head calls. Equal order was rejected, because a view that started
before memory fell, or while base calls held the sidecars, would then delay a
foreground render. A wait for the end of each HTTP request was rejected,
because that request can share the render of the view, and neither would then
finish.

Decision: a base capture and its early renders wait for admission without a
shared render worker. Rejected: a claim before each base job, because a claim
covers one call, not a whole job. Rejected: a separate pool for foreground
renders, because it changes how a foreground request waits for a busy worker.

Decision: a batch view can wait behind the later calls of the completion
stage. A batch place for each later call was rejected, because waiting batch
views and completing views would then wait for each other, and none would
finish. The wait is bounded: the completion bound limits those calls, each call
ends under its deadline, and foreground calls still go first.

The event stream sends a comment after 15 seconds without a publication to
keep idle connections active during background work. These comments carry no
revision or data field. EventSource clients ignore comments under the
[SSE format](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes).
Shutdown ends the stream before its next comment.

A source or configuration change replaces the catalogue model and the moved
graph nodes together under the [watch contract](./mokly-watch.md); a failed
candidate keeps the last-good state. Replacement invalidates the cached
documents whose keys moved, every detail, and the published comparison
evidence; a resource edit invalidates the documents that reference it. Replacement and
shutdown cancel active Git commands and wait for their process and pipe
closure before cleanup completes. A Git read of the kept base finishes after
a replacement, under the
[kept base cancellation rule](./mokly-base-preparation.md#cancellation).
Shutdown still cancels it.

## Comparison Snapshots

No comparison generation is assembled until the reader selects a diff or opens a
removed entry. The [selected comparison contract](./mokly-selected-comparisons.md)
owns the request, the capture, the retention, and the limits for a current
screen or component. Removed component parents and variants use the advertised
generation root. Historical screens, pages, and documents use that generation
under the [removed previews contract](./mokly-removed-previews.md). The static
output of `build` carries one complete generation instead, under the
[comparison serving contract](./mokly-comparison-serving.md).
