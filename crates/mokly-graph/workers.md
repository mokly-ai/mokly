# mokly-graph render workers and background views

This page is part of the [`mokly-graph` README](./README.md). It holds the
render worker guidance of the crate. The first sections cover the comparison
tasks and streams on the render workers and the forwards that wrappers need.
The last sections cover the two paths of a Serve background view: the choice
of path, the render store lookup, the handoff, and the shared finish.

## Comparison tasks and streams

`schedule_comparison_tasks` runs a caller's `ComparisonTask` once for every
index on the generation's render workers. It returns when every index has run.
The caller sizes each of these calls by `comparison_parallelism`.

`schedule_comparison_stream` runs a `ComparisonTask` as one ordered stream. Its
`ComparisonConsumer` admits each index into a slot that the caller owns. The
calling thread consumes the finished indexes in index order. At most twice
`comparison_parallelism().max(1)` indexes are started and not yet consumed. Each
consumption lets one more index start. A `false` from `admit` ends the stream.
A `false` from `consume`, or a task panic, stops new admission and
consumption. The call still waits for every admitted task, and a task panic
then reaches the caller. A stream that starts on a worker of the same pool
prepares and consumes one index at a time.

In both operations, the caller keeps the results, the errors, and the
cancellation checks. `ThreadWorkers` carries the caller's tracing span,
subscriber, and `RenderClass` through one shared context for all worker
methods. So a background render keeps its class in every worker job, and
Serve can order the sidecar calls of that render. The trait
defaults have a capacity of one. They run the indexes in order on the caller,
and the stream default prepares and consumes one index at a time.

## Wrapper forwards

Wrappers forward `comparison_parallelism`, `schedule_comparison`,
`schedule_comparison_tasks`, and `schedule_comparison_stream` to their inner
generation. `RenderWorkers` wrappers forward `comparison_parallelism`,
`comparison`, `comparison_tasks`, and `comparison_stream` in the same way.
Without these forwards, the comparison runs one view at a time. A scheduled
task still calls the wrapper's own methods, so the wrapper's checks stay
active. `RenderKeys::build_with_workers` also runs one key job for each
exporting module through `comparison_tasks` on the shared render workers.
Without the `comparison_tasks` forward, the key calculation runs one module at
a time.

## Background paths

Serve renders each background view on one of two paths under the
[on-demand background rules](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
Before the view starts, Serve asks `RenderGeneration::can_prepare_root`. A
prepared generation answers from the route's immutable plan and entry alone.
An unknown route and a Markdown view answer `false`, and every other view gets
the answer of `Composer::can_prepare_root`. The check reads no cache, no render
store, and no build identity. It prepares no root, takes no lock, and calls no
worker. A view with the answer `false` takes the ordinary path,
`RenderGeneration::render`, which foreground renders also use. The `Session`
worker then opens the view's one `render.document` span and makes its one
counted cache read on the render workers. After a cache miss, it reads the
render store before it composes.

A view with the answer `true` takes the staged path,
`RenderGeneration::render_background`. A prepared generation runs
`check_cancelled` and opens the view's `render.document` span on the caller's
thread. `RenderCache::contains` checks for the document without a count, a
promotion, or a restore. Its trait default answers `true`, so a cache without
that check keeps every staged view on its worker. Only an eligible view whose
document the cache does not hold takes the store lookup of the next section.
A held document, a Markdown view, a view whose lookup allows no root, and a
view that `Composer::prepare_root` does not prepare make no
`background::Completion` call. They take no completion place, and the caller
keeps its worker until the view ends. Otherwise `prepare_root` requests the
own root fragment once, on the caller's thread, so its `render.fragment` span
stays inside the view's span. It gets the same `ComposeRequest` that
composition and `Composer::record_served` get from
`document_composition::request`. A failed root returns its composition error
at once, without a completion place.

## Store lookup

`Session::background_lookup` builds the optional `StoreKey` of the view once,
on the caller's thread, and returns a `DocumentLookup`. A view without a key,
because the generation has no render store or its build identity is unknown,
gets `DocumentLookup::Miss` without a key. It can prepare its root, and it has
no store outcome. A view with a key asks `DocumentStore::try_miss`. The answer
`true` is a definite miss that the store has already counted once, and the
view gets `DocumentLookup::Miss` with its key. Only a `Miss` lookup allows a
root. The attempt never calls `DocumentStore::load` after it, and the counted
miss stays after a root error or a cancellation.

The answer `false` gives `DocumentLookup::Read` with the key. The store may
hold the document, or it has a queued entry fault or a held lock. The view
then requests no root on the caller's thread. On the render workers, its job
makes the view's one counted cache read. After a cache miss, the job calls
`load` once with the kept key. A usable hit passes the view's `ComposeRequest`
to `Composer::record_served` and returns the stored document. Every other
outcome composes the view on that worker, without a handoff. The trait default
of `try_miss` answers `false`, so a store without the hint keeps every view
that has a key on its worker. The
[render store guidance](./cache.md#render-store) gives the other read and offer
rules.

## Handoff and completion

A successful root passes its byte charge to `Completion::handoff`: the
capacities of the prepared inputs, the fragment, and the kept key, and the job
and queue metadata, without JSON encoding. `handoff` is the only way into the
completion place. Every staged view, with or without a handoff, then runs in
one private `BackgroundJob` on the render workers, through
`RenderWorkers::document`. The job keeps one `BackgroundAttempt`, the prepared
root and the lookup, behind a one-shot lock and takes it once. A second take
returns `InternalError::PreparedRootConsumed` and renders nothing. The attempt
of an unprepared view holds no root. The job
passes the attempt to `Session::raw_prepared`, which makes the view's one
counted cache read and then reads the store or composes, inside the view's one
`render.document` span. The view passes this job, not the `Session`, to
`RenderWorkers::document`, because the `Session` worker opens a second
`render.document` span. A document that leaves the cache after the check takes
the ordinary store read and composition in that job. Link checks of the view
render inline in the same job through the ordinary `Session` path. They take
no completion place, and they get neither the lookup nor the root of the view.
The trait default of `can_prepare_root` answers `false`, and the default of
`render_background` only calls `render`. So a wrapper that does not forward
them takes no completion place, keeps its worker, and never hands off.

## Shared finish

Both paths finish every document, from the cache, the store, or a
composition, in the shared `Session::finish_artifact` of
[`src/session_render.rs`](./src/session_render.rs). It walks the public
closure, checks the links, inserts the document into the render cache, and
records its closure files. Last, it calls `offer_document`, which offers the
document to the render store only when its composition marked it fresh. A
successful composition with a store key marks its document fresh under that
key, the kept key of a lookup included. A cache or store hit marks nothing.
So a staged view that composes from a prepared root offers its document after
the same checks as an ordinary view, and a hit offers nothing.
