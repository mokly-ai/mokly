# mokly-server background work

This page is part of the [`mokly-server` README](./README.md). It holds the
background work guidance of the crate: the usage pass and its window, the
ordinary and staged paths of each view with their bounds and budget, and the
ready state and Changes work that the passes publish.

## Usage pass

`UsagePass` and `ChangesPass` run the background work of the
[on-demand Serve contract](../../docs/protocol/mokly-on-demand.md): current
usage first, then Changes classification against one pinned merge base. They
yield to foreground requests, publish changed evidence in one revision, and
cannot publish into a replacement. `UsagePass` keeps a sliding window bounded
by its injected `dyn BackgroundCapacity`. It reads the bound before each
view starts, so the same pass can grow when capacity recovers.
It starts views in catalogue order and reports each
view's warnings and failure once, in catalogue order, after every earlier
render ends. The
composition root supplies its current capacity. `Workers` admits queued background renders
one at a time, in request order, whenever no foreground request is active.
It runs each background document render in `RenderClass::Background`, so the
sidecar calls of that render go after the other waiting head calls.

## Ordinary and staged views

Before each view starts, `UsagePass` asks `Documents::can_prepare_root`
whether the view can prepare its own root fragment. The answer depends only on
immutable catalogue metadata. The check reads no cache, prepares no root,
performs no IO, takes no claim, and does not lock the per-route usage state. A
view with the answer `false` takes the ordinary path: `Window::start` and
`Work::background`, with no `Stage`. It keeps its window place and its worker
permit until its render ends. A view with the answer `true` takes the staged
path: `Stages::view`, `Window::start_staged`, and `Work::background_staged`.
Each view gets its own answer, so one catalogue can use both paths.

A staged view leaves the window's bound when it
[hands off](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement)
after its own root fragment returns. The `Window` then starts the next view,
and it still reports in catalogue order. Each pass has its own `Window`, so the
window bound counts only the views of the current pass. One `Stages` bound of
the same size limits the views whose own root fragment returned without
failure, while they build their documents. It serves every pass of the
`UsagePass`, so the views of a replaced generation keep their completion
places, and the bound counts them with the views of the current pass. Every
other view takes no completion place and reads or builds its document under its
worker permit. A staged view whose document the render cache holds, or the
render store may hold, is such a view, because the graph makes no handoff for
it.

A replaced view that has not handed off keeps its worker permit until it ends,
and its active sidecar call keeps its claim. New starts can overlap such views
only within the free workers and the sidecar capacity. HTTP requests share
these worker permits, so the permits and the `Stages` bound give the
[limit of the worker count plus the completion bound](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement).
The `Stage` of a staged view owns its worker permit. After its own root
fragment returns, the `Stage` also owns the view's completion place and, when
the charge fits, its transient charge. A handoff releases the worker.
`Workers::stop` takes every worker permit and then drains the background jobs
that released theirs. The `Documents::can_prepare_root` default answers
`false`, so an adapter that keeps it puts every view on the ordinary path. An
adapter that answers `true` but keeps the default `background_staged` keeps
the original background call. Its view takes no completion place and keeps its
worker for the whole call.

`Stages` also owns one fixed transient budget of 4 MiB for the
[handoff charges](../../docs/protocol/mokly-on-demand.md#background-work-and-replacement)
of every pass. A handoff takes its charge from this budget without waiting,
and the charge takes no room in the render cache. A charge that does not fit
only enters the completion place, so the view keeps its worker and tries no
second charge. The `Stage` returns its charge when its view ends, also on
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
