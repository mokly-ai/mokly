# mokly-graph render workers and background views

This page is part of the [`mokly-graph` README](./README.md). It holds the
render worker guidance of the crate. The first sections cover the comparison
tasks and streams on the render workers and the forwards that wrappers need.
The last sections cover a Serve background view: its lookup on the render
workers, the completion of a miss, and the shared finish.

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

`RenderWorkers` wrappers also forward `background` to their inner workers.
Without that forward, the trait default runs the lookup of a Serve background
view on the calling thread instead of the render pool. A wrapper with its own
checks, such as a cancellation check, runs them before it forwards.

## Background lookup

Serve reads each background view under the
[background pass rules](../../docs/protocol/mokly-on-demand-background.md).
It calls `RenderGeneration::read_background`. A prepared generation opens the
view's one `render.document` span and passes a private `BackgroundWorker` to
`RenderWorkers::background`, so the lookup runs on the render workers.
`ThreadWorkers` runs it on its pool with the caller's `WorkerContext`. The
lookup runs `check_cancelled` and then `Session::raw_lookup`: one counted cache
read and, after a cache miss, the `StoreKey` of the route and at most one
`DocumentStore::load`. The worker computes the key during the lookup, not
before it. A usable store hit passes the view's `ComposeRequest` to
`Composer::record_served`. A cache or store hit then runs the shared finish on
the same worker and returns `BackgroundRead::Complete`. A hit requests no own
root and takes no `Completion`. The
[render store guidance](./cache.md#render-store) gives the other read and offer
rules.

Every other outcome returns `BackgroundRead::Miss` with a private miss. The
miss keeps the session, the route, the optional `StoreKey`, the root
eligibility, and the view's span. It keeps no artifact, tree, fragment, or
lock. `Session::background_root_eligible` gives the eligibility from the
route's immutable plan and entry: an unknown route and a Markdown view answer
`false`, and every other view gets the answer of `Composer::can_prepare_root`.
The trait default of `read_background` returns `Ok(None)` and declines the
lookup. Serve then queues the view as ordinary work under a fresh batch place,
with no `Completion`. A default must not run a full render inside the
worker-count window, because that render can call a sidecar. So a wrapper that
does not forward `read_background` takes no completion place and never hands
off.

## Miss completion

Serve calls `BackgroundMiss::complete` once, on a worker that it takes again
after the batch entry of the miss. It passes a `Completion` only for an
eligible miss. The miss runs `check_cancelled` and enters its kept span again,
so the view keeps one `render.document` span across both phases. With a
`Completion`, an eligible miss requests its own root fragment once through
`Composer::prepare_root`, so its `render.fragment` span stays inside the view's
span. It gets the same `ComposeRequest` that composition
and `Composer::record_served` get from `document_composition::request`. A
failed root returns its composition error at once, without a completion place.
A successful root passes its byte charge to `Completion::handoff`: the
capacities of the prepared inputs, the fragment, the kept key, and the route,
the sizes of the miss and its job, and the queue metadata, without JSON
encoding. `handoff` is the only way into the completion place.

Every miss then runs in one private job on the render workers, through
`RenderWorkers::document`. The job keeps one attempt, the prepared root and the
key, behind a one-shot lock and takes it once. A second take returns
`InternalError::PreparedRootConsumed` and renders nothing. The job calls
`Session::compose_miss`, which composes without another cache read, identity
sample, or store load. A successful composition with a key marks its document
fresh under that key. The view passes this job, not the `Session`, to
`RenderWorkers::document`, because the `Session` worker opens a second
`render.document` span. Link checks of the view render inline through the
ordinary `Session` path. They take no completion place, and they get neither
the miss nor its root.

## Shared finish

Every document, from the cache, the store, or a composition, finishes in the
shared `Session::finish_artifact` of
[`src/session_render.rs`](./src/session_render.rs). It walks the public
closure, checks the links, inserts the document into the render cache, and
records its closure files. Last, it calls `offer_document`, which offers the
document to the render store only when its composition marked it fresh. A
cache or store hit marks nothing. So a background miss offers its document
after the same checks as an ordinary render, and a hit offers nothing.
