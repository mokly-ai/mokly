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
take priority over background work: a background render yields between
documents, and a foreground render that needs a sidecar does not wait behind
queued background renders. A failed render answers 500, enters no cache,
and makes no other route unavailable. Its typed diagnostic goes to the
selected CLI reporter on stderr; the HTTP response carries the safe error envelope. A render
that passes its deadline fails the same way after the sidecar contract's one
retry.

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

After readiness, Serve renders every view in the background in catalogue
order, which fills the render cache and the usage of every detail, then
classifies Changes, which renders the base side under the
[comparison contract](./mokly-comparison.md#sides). A completion that changes
the index or a detail publishes one revision under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). Background work is bounded, yields to foreground renders, and
cannot publish after its state is superseded by a watched change; a
superseded result is discarded. `--no-watch` runs this work once.

Sidecar admission preserves foreground priority for each whole HTTP render.
Queued base calls wait until those requests finish their sidecar work. Active
calls finish under their deadlines. Both sides share the configured worker
bound, including when the pool has one worker.

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
generation URL. Historical screens, pages, and documents use that generation
under the [removed previews contract](./mokly-removed-previews.md). The static
output of `build` carries one complete generation instead, under the
[comparison serving contract](./mokly-comparison-serving.md).
