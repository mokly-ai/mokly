# On-demand Serve

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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
until an input changes or the byte bound evicts it; the next request for an
evicted document renders it again.

Concurrent requests for one document share one render. Foreground requests
take priority over background work: a background render that has not started
does not start while a foreground request is active, and a foreground render
that needs a sidecar does not wait behind queued background renders. A
foreground request that finds every worker busy with background renders waits
for the first of them to end; an active render is not interrupted. A failed
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
renders a bounded batch of views at a time: at most the smaller of the worker
count and the [sidecar pool size](./mokly-sidecar.md#lifecycle), and at least
one. The worker count is the machine's core count, up to eight. The next view
starts as soon as any view of the batch ends, and views start in catalogue
order: when several views wait for one free worker, the first in catalogue
order starts. Each view's build warnings and a failed render's diagnostic
report once, in catalogue order, after every earlier view of the pass has
ended; a failed view's warnings come directly before its diagnostic. The
pass publishes the
usage of its views together after its last view ends: a completion that
changes the index or a detail publishes one revision under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). Background
work is bounded, yields to foreground renders, and cannot publish after its
state is superseded by a watched change; a superseded result is discarded. A
stop or a replacement starts no further view of the superseded pass and
discards its unreported warnings and failures; a view that already renders
finishes under its deadlines. `--no-watch` runs this work once.

Decision: the batch is a sliding window. Fixed batches, which wait for their
slowest view before the next batch starts, were rejected, because one slow
view leaves the other workers idle. Decision: the batch is bounded by the
smaller of the worker count and the sidecar pool size. The worker count alone
was rejected, because with fewer sidecars its extra renders wait in the
sidecar queue beside foreground calls. Keeping one worker free for foreground
requests was rejected, because it slows every pass. Decision: warnings and
failures report in catalogue order. Reporting each view when its render ends
was rejected, because the order of the lines would change between runs.

Sidecar admission preserves foreground priority for each whole HTTP render.
Queued base calls wait until those requests finish their sidecar work. Active
calls finish under their deadlines. Both sides share the configured sidecar
pool size, including when the pool has one sidecar.

The event stream sends a comment after 15 seconds without a publication to
keep idle connections active during background work. These comments carry no
revision or data field. EventSource clients ignore comments under the
[SSE format](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes).
Shutdown ends the stream before its next comment.

A source or configuration change replaces the catalogue model and the moved
graph nodes together under the [watch contract](./mokly-watch.md); a failed
candidate keeps the last-good state. Replacement invalidates the cached
documents whose keys moved, every detail, and the comparison evidence; a
resource edit invalidates the documents that reference it. Replacement and
shutdown cancel active Git commands and wait for their process and pipe
closure before cleanup completes.

## Comparison Snapshots

No comparison generation is assembled until the reader selects a diff or opens a
removed entry. The [selected comparison contract](./mokly-selected-comparisons.md)
owns the request, the capture, the retention, and the limits for a current
screen or component. Removed component parents and variants use the advertised
generation root. Historical screens, pages, and documents use that generation
under the [removed previews contract](./mokly-removed-previews.md). The static
output of `build` carries one complete generation instead, under the
[comparison serving contract](./mokly-comparison-serving.md).
