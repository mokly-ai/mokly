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
request through the render graph: the entry's source node, the fragment and
HTML component nodes it composes, the stylesheet bundle, and the composed
document, each computed only when its key is new. A JavaScript fragment
renders through the [sidecar](./mokly-sidecar.md) under its deadlines; an
HTML screen or component renders in Rust. The finished document enters the
render cache and stays there until an input changes or the byte bound evicts
it; the next request for an evicted document renders it again.

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
and resources stay in a separate memory store. Temporary documents never enter
the saved document cache or catalogue model. Their content-addressed fragments
may enter the bounded fragment cache.

## Background Work And Replacement

After readiness, Serve renders every view in the background in catalogue
order, which fills the render cache and the usage of every detail, then
classifies Changes, which renders the base side under the
[comparison contract](./mokly-comparison.md#sides). Every completed stage
publishes one revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve): the
index and the details are replaced in one step, the shell updates its
navigation, counts, and details in place, and the frames keep their
documents. Background work is bounded, yields to foreground renders, and
cannot publish after its state is superseded by a watched change; a
superseded result is discarded. `--no-watch` runs this work once.

A source or configuration change replaces the catalogue model and the moved
graph nodes together under the [watch contract](./mokly-watch.md); a failed
candidate keeps the last-good state. Replacement invalidates the cached
documents whose keys moved, every detail, and the comparison evidence; a
resource edit invalidates the documents that reference it. Git commands run
outside the HTTP event loop with their own cancellation; replacement and
shutdown cancel active commands and wait for their process and pipe closure
before cleanup completes.

## Comparison Snapshots

No comparison generation is assembled until the reader selects a diff or opens a removed
entry. The shell then requests `/mokly-viewer/diffs/review.json?path=<path>`
for the selected screen or component entry, with `refresh=1` for an explicit
retry, under the
[selected comparison contract](./mokly-selected-comparisons.md). Serve takes
the base views from the bounded capture or pinned-source fallback and the head
views from the bounded render cache. It renders evicted head views again from
the same inputs, treats missing or pending evidence as the
retryable failure, writes the review result v8 and the two snapshot trees into one
immutable in-memory generation, and redirects to
`/mokly-viewer/diffs/generations/<generation>/review.json`. Snapshot files
are the real bytes of both sides. Generation files are served with
`Cache-Control: no-store` and `X-Content-Type-Options: nosniff` and resolve
only from the generation's own file map.

Identical pending selections coalesce; different selections serialize, with
at most 32 pending requests and a ten-second admission-to-completion
deadline. A generation lives for 60 seconds after its last request; at most
64 generations and 128 MiB of snapshots are kept, each artifact at most
64 MiB, and a capture that exceeds the capacity is rejected rather than
evicting a generation inside its window. A watched change or a Changes
refresh changes the cache epoch, so stale work cannot publish, and an open
comparison returns to Current. The static output of `build` carries one
complete generation instead, under the
[comparison serving contract](./mokly-comparison-serving.md).

## Verification

Tests cover cold start with an unrelated failing render, identical bytes for
on-demand and background renders of one document, request coalescing,
sidecar failure and timeout, source and resource confinement, pending usage,
live prop isolation, replacement, superseded background results, comparison
generation retention, and shutdown with real processes. The large-fixture
browser benchmark checks real frame content, search, viewport and scheme
switches, a live prop edit, and Changes, cold and warm.
