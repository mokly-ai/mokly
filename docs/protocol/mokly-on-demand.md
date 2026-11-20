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
request. A JavaScript fragment renders through the
[sidecar](./mokly-sidecar.md) under its deadlines; an HTML screen or component
renders without the sidecar. The finished document stays in the render cache
until an input changes or it leaves the cache under the
[cache bounds](./mokly-runtime.md#render-graph-and-cache). The next request for
a document that left the cache renders it again.

Concurrent requests for one document share one render. Foreground requests
take priority over background work: a background render that has not started
does not start while a foreground request is active, and a foreground render
that needs a sidecar does not wait behind queued background renders. A
foreground request that finds every worker busy with background views waits
until the first of them ends or [hands off](#background-work-and-replacement).
An active render is not interrupted. A failed
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
model.

## Background Work And Replacement

After readiness, Serve renders every view in the background, which fills the
render cache and the usage of every detail, then classifies Changes, which
renders the base side under the
[comparison contract](./mokly-comparison.md#sides). This background pass
holds its started views in two stages: the batch and the completion stage.
The bound of each stage is the smaller of the worker count and the
[sidecar capacity](./mokly-sidecar-memory.md#capacity), and at least one.
The worker count is the machine's core count, up to eight. Each view start and
each entry to the completion stage reads the current capacity. A lower reading
admits no further view to a full stage, and it stops no started view. A view
start takes no [claim](./mokly-sidecar-memory.md#claims). The next view starts
as soon as the batch has fewer views than its bound, and views start in
catalogue order: when several views wait for one free worker, the first in
catalogue order starts.

A view holds its batch place from its start until it hands off or ends. Only a
view of a JavaScript entry without saved slots enters the completion stage,
and only after the entry's own fragment returns without failure, from the
sidecar or from the render cache. That view holds a completion place while it
builds its document: its tree, its final checks, its bytes, and its cache
entry. Every other view takes no completion place: a view with an HTML
template or saved slots, a Markdown view, and a view whose document the cache
already holds. Such a view builds its document, or reads it from the cache,
while it keeps its batch place and its worker. A view whose own fragment fails
ends with that failure and takes no completion place. A render for a link
check of a view runs inside the render of that view and takes no other place
and no other worker.

A view in the completion stage hands off at most once, when it enters that
stage with a charge that fits. At the handoff, the view leaves the batch and
releases its worker. A later fragment and a render for a link check of the
view hand off no view. A view that does not hand off keeps its batch place and
its worker until it ends. Foreground and base renders use neither stage.

The charge counts the allocated bytes of the state that the view keeps at its
handoff, with its bookkeeping, against a transient budget of 4 MiB. The budget
is outside the [render cache bound](./mokly-runtime.md#render-graph-and-cache),
so a charge takes no cache room and removes no cached document. One budget and
one completion bound serve every pass of a Serve process, so the views of a
replaced pass that still hold a completion place count with the views of the
current pass. A charge never waits, and it ends when its view ends, also on
failure or cancellation. A view whose charge does not fit tries no second
charge: it keeps its batch place and its worker, and it completes inside the
completion bound.

A view that waits to enter the completion stage keeps its batch place and its
worker. It waits only for a completion place, never for foreground work or for
another worker. It blocks no shared fragment render or link check that another
completing view needs.

At a constant capacity, at most the worker count plus the completion bound of
renders hold a worker or a completion place at once. These are the foreground
renders, the background views that keep their worker, and the views that
handed off. A lower reading takes no worker or place from a render that holds
one. So the renders that an earlier bound admitted can keep this number above
the new limit until they end.

The stages change no document, usage, resource, warning, or diagnostic, and
they repeat no fragment request. Each view's build warnings and a failed
render's diagnostic report once, in
catalogue order, after every earlier view of the pass has ended; a failed
view's warnings come directly before its diagnostic. The pass publishes the
usage of its views together after its last view ends: a completion that
changes the index or a detail publishes one revision under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). Background
work is bounded, yields to foreground renders, and cannot publish after its
state is superseded by a watched change; a superseded result is discarded. A
stop or a replacement starts no further view of the superseded pass and
discards its unreported warnings and failures; a view that already renders
finishes under its deadlines, in either stage. Shutdown waits for the started
views of both stages. `--no-watch` runs this work once.

Decision: the batch is a sliding window. Fixed batches, which wait for their
slowest view before the next batch starts, were rejected, because one slow
view leaves the other workers idle. Decision: both stages are bounded by the
smaller of the worker count and the sidecar capacity. The worker count alone
and the pool size alone were rejected for the batch, because its views beyond
the capacity would wait for a sidecar while they hold workers that foreground
renders need. A larger completion bound was rejected, because it raises the
limit of the worker count plus the completion bound. More views that released
their worker would then keep document trees in memory at once. Keeping one
worker free for foreground requests was rejected, because it slows every pass.
Decision: a view start takes no claim. A claim for each started
view was rejected, because an HTML view would hold sidecar capacity that it
never uses, and the call order of sidecar admission already keeps foreground
priority. Decision: warnings and
failures report in catalogue order. Reporting each view when its render ends
was rejected, because the order of the lines would change between runs.

Decision: a view of a JavaScript entry without saved slots hands off after its
own fragment returns. A batch place for the whole render was rejected, because
the sidecars then wait while the batch completes its documents. A handoff for a
view with an HTML template or saved slots was rejected, because that view
builds part of its tree before or between its fragment calls, and a view that
hands off builds its whole tree inside the completion stage. Decision: the
handoff releases the worker. A worker for the completion stage was rejected,
because the next view would then wait for it, and the stages would not
overlap.

Decision: only a view whose own fragment returned without failure enters the
completion stage. A completion place for every view was rejected, because each
entry reads the current capacity. That reading adds work to each view without
such a fragment, and the worker that this view keeps already bounds it. Both
choices have the same limit of the worker count plus the completion bound.
With either choice, foreground renders can hold every worker while the views
that handed off hold every completion place. With this rule, background views
alone can build more documents at once than the completion bound.

Decision: a waiting view waits only for a completion place. A wait for
foreground work or for a worker was rejected, because a foreground render of
the same view can hold both while it waits for that view's render, and neither
would then finish.

Decision: a handoff charges the state that it keeps to its own budget of 4 MiB,
outside the render cache bound. An uncharged handoff was rejected, because the
views that hand off would keep memory outside every bound. A charge to the
render cache or to its transit reserve was rejected, because it removed cached
documents, which Changes classification then rendered again. A larger budget
was rejected, because it would raise the memory of the process.

Sidecar admission preserves foreground priority for each whole HTTP render.
Queued base calls wait until those requests finish their sidecar work. The
queued calls of started background views go after the other queued head calls,
such as the calls of HTTP renders. The later calls of a view in the completion
stage are such calls. So a batch view can wait behind them while it holds its
worker. A call of a started view does not wait for the end of an HTTP request.
Active calls finish under their deadlines.

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
