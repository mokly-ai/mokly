# mokly-server background work

This page is part of the [`mokly-server` README](./README.md). It holds the
background work guidance of the crate: the usage pass and its window, the
lookup and the miss of each view with their bounds and budget, and the ready
state and Changes work that the passes publish.

## Usage pass

`UsagePass` and `ChangesPass` run the background work of the
[on-demand Serve contract](../../docs/protocol/mokly-on-demand.md): current
usage first, then Changes classification against one pinned merge base. They
yield to foreground requests, publish changed evidence in one revision, and
cannot publish into a replacement. `UsagePass` keeps a sliding window bounded
by `Work::parallelism`, the fixed worker count. Its `Stages` read the injected
`dyn BackgroundCapacity` at each batch entry and each completion entry, so the
same pass can admit more misses when capacity recovers. The composition root
supplies its current capacity.

A pass first starts the views whose documents a request asked for since the
previous rebuild, the most recent first, and then the other views in catalogue
order, under the
[window rule](../../docs/protocol/mokly-on-demand-background.md#window-and-lookup).
`SharedPublication::delivery` records each GET or HEAD of a document route of
the current catalogue. A repeated request moves its route to the front, so the
record holds each route at most once. A rebuild hands this record to its own
pass. It then starts an empty record for the next rebuild. The handed record
keeps only the routes that the new catalogue declares.
`Publications::background_priority` gives their catalogue positions to the
pass. The pass reports each view's warnings and failure once, in catalogue
order, after every view before it in catalogue order ends. A view whose usage
the snapshot already records ends at once, without a render.

`Workers` admits queued background jobs one at a time, in the order that they
queued, whenever no foreground request is active. It runs each lookup and each
resumed render in `RenderClass::Background`, so the sidecar calls of that view
go after the other waiting head calls.

## Lookup and miss

`UsagePass::fill_window` starts each view with its own `Dispatch`, through
`Window::start_dispatched` and `Work::background`. A view start reads no
capacity, takes no claim, and does not lock the per-route usage state.
`Workers::background_render` takes one `WriteActivity` lease and one worker
permit, and then runs the lookup in a blocking job through
`Documents::background_read`. `GraphDocuments::read_background` holds the
route's usage lock during the graph lookup, and it does no work when that
usage is already settled. A complete result settles the usage, and the view
ends with its warnings.

A miss releases the worker permit and the usage lock. It keeps a handle to the
route's usage lock, not the lock, and it keeps its window place. A declined
lookup, the `Ok(None)` default of `Documents::background_read`, becomes a miss
that renders through `Documents::background`. The miss waits for a batch place
from `Stages`, and then for a worker permit again under the same foreground
priority. Each miss gets its own root eligibility. An eligible miss gets a
`Stage`, which takes its worker permit and its batch place. Any other miss
keeps both until it ends. The resumed blocking job calls
`BackgroundMiss::complete`, which takes the usage lock again. When foreground
work settled that usage in the meantime, ready or unavailable, it returns no
warnings and renders nothing. Otherwise it completes the miss, with the `Stage`
as the `Completion` of an eligible miss.

After the own root fragment of an eligible miss returns, its `Stage` also owns
the view's completion place and, when the charge fits, its transient charge.
The completion bound limits these misses while they build their documents. An
eligible miss leaves the window's bound when it
[hands off](../../docs/protocol/mokly-on-demand-background.md#batch-and-completion).
Its `Stage` then releases the worker permit and the batch place, and wakes the
`Dispatch` of the view. The `Window`
starts the next view, and it still reports in catalogue order. Each pass has
its own `Window`, so the window bound counts only the views of the current
pass. The batch bound and the completion bound of `Stages` have the same size,
and they serve every pass of the `UsagePass`. So the views of a replaced
generation keep their batch and completion places, and the bounds count them
with the views of the current pass. Every other miss takes no completion place
and builds its document under its worker permit and its batch place.

A replaced view that has not handed off keeps its worker permit until it ends,
and its active sidecar call keeps its claim. New starts can overlap such views
only within the free workers and the sidecar capacity. HTTP requests share
these worker permits, so the permits and the completion bound give the
[limit of the worker count plus the completion bound](../../docs/protocol/mokly-on-demand-background.md#bounds-and-reports).
A cancelled pass drops its views that wait for a batch place or a worker, so
they never resume. `Workers::stop` takes every worker permit and then drains
the background jobs that released theirs.

The lease starts before the first wait for a worker permit, and one count of
`work_active` starts with the lookup job. The lookup job returns both with its
result, and the resumed job takes them over, so a miss keeps them while it
waits for a batch place and a worker. After a handoff or a cancellation of the async caller, the blocking job
that runs keeps them until it ends. The resumed job first releases the miss,
the `Stage` resources, its worker permit, and its batch place. It then
releases the lease, and last its count. So `Workers::stop` also waits for a job
that has already released its worker permit, and it returns only after the
lease ends.

`Stages` also owns one fixed transient budget of 4 MiB for the
[handoff charges](../../docs/protocol/mokly-on-demand-background.md#batch-and-completion)
of every pass. A handoff takes its charge from this budget without waiting,
and the charge takes no room in the render cache. A charge that does not fit
only enters the completion place, so the view keeps its worker and its batch
place and tries no second charge. The `Stage` returns its charge when its view ends, also on
failure, cancellation, or a panic.

## Ready state and Changes

Ready state installs the generation root, the base commit, Changes
membership, moved paths, removed records, and per-view states, ignore ids, and
evidence in one revision. Included details carry
classification reasons and their base side even without a workspace.
Workspace lists stay absent until all
consumer usage is proven. One unavailable view keeps every Used by list absent
until the next generation. Failed views publish unavailable usage without
inventing empty consumers. `mokly-model` projects every status from retained
model inputs. `mokly-compare` owns Changes membership, eligibility,
workspaces, input changes, and removed metadata. Serve uses those shared
functions and the shared snapshot route builders. Watched Serve polls `HEAD`
and the base ref once per second. `ChangesPass` takes the render store's
`WriteActivity`. Each reference probe takes its lease before its blocking job
is queued, and the blocking job owns it, also after a cancellation of the
async owner. A probe that finds moved refs keeps its lease through the queued
refresh until the refreshed classification ends. An unchanged probe releases
its lease before the next idle wait. A changed merge base reuses the accepted
current graph. A tip change with the same merge base keeps the published
state. HTTP worker leases keep foreground priority for the whole request, and
the CLI shares those leases with base-side sidecar admission.
