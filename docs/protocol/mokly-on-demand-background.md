# On-demand Serve Background Pass

This page expands the
[background work](./mokly-on-demand.md#background-work-and-replacement) of
on-demand Serve. It defines how the background pass starts its views, looks up
their documents, and renders the other views in two stages: the batch and the
completion stage. It also defines the bounds of this work and how the pass
reports and stops.

## Window And Lookup

The pass starts its views in a window. The window holds the views of the
current pass from their start until they hand off or end, and at most the
worker count of them. The worker count is the machine's core count, up to
eight. A view start reads no capacity and takes no
[claim](./mokly-sidecar-memory.md#claims). The next view starts as soon as the
window has fewer views than the worker count. Views start in request order,
then in catalogue order. A view whose document a request asked for since the
previous rebuild starts first, the most recently requested first. The other
views follow in catalogue order. When several lookups wait for one free
worker, the first in this order starts. Decision: an open viewer's documents
start first, because its frames wait for them. A worker reserved for requests
was rejected, because it slows the pass and so the ready Changes.

Each view first looks up its document on a worker: one counted read of the
render cache and, after a cache miss, at most one read of the
[render store](./mokly-render-store.md#reads). A view that the cache or the
store serves finishes on that worker, with its closure walk, its link checks,
its usage, and its cache entry. That view requests no own fragment and takes no
batch or completion place. It needs no capacity reading for either stage. A
sidecar call of its link checks still takes a
[claim](./mokly-sidecar-memory.md#claims). Every other view misses its lookup,
whatever its entry kind, also after a rejected store entry or without a known
build identity. A view that misses releases its worker after its lookup, and it
waits for a batch place.

A view that waits for a batch place keeps its window place, so the window bound
also limits the waiting views of the current pass. The view holds no worker,
no document, tree, or fragment, and nothing that a foreground render of the
same view waits for. When a foreground render makes the usage of a view
`ready` or `unavailable` after the lookup of that view and before its render
starts, the view ends without a render.

Decision: the pass starts its views in a sliding window. Fixed batches, which
wait for their slowest view before the next batch starts, were rejected,
because one slow view leaves the other workers idle. Decision: the window is
bounded by the worker count alone, and a view looks up its document before it
reads the capacity. A capacity bound for every started view was rejected,
because a view that the cache or the render store serves needs no sidecar for
its document, and the bound then only delays that view. A check of the store
index before the lookup was rejected, because it cannot prove a hit, so every
view that it passes still needs the lookup.

Decision: a view that waits for a batch place releases its worker and keeps its
window place. Keeping the worker was rejected, because the views beyond the
capacity would then hold workers that foreground renders need. A wait that a
foreground render of the same view must wait for was rejected, because
foreground renders could then hold every worker while their views wait for
one, and none would finish. Releasing the window place was rejected, because
the window would then start more views while the waiting views grow without a
bound.

## Batch And Completion

A view whose lookup missed enters the batch before it renders. The bound of the
batch and the bound of the completion stage are the smaller of the worker count
and the [sidecar capacity](./mokly-sidecar-memory.md#capacity), and at least
one. Each entry to the batch and each entry to the completion stage reads the
current capacity. A lower reading admits no further view to a full stage, and
it stops no started view. An entry to the batch takes no claim. One batch bound
serves every pass of a Serve process, so the views of a replaced pass that
still render count with the views of the current pass. A view holds its batch
place from its entry until it hands off or ends. After its entry, the view
takes a worker again under the
[foreground priority rules](./mokly-on-demand.md#foreground-documents), and
then it renders.

Only a view of a JavaScript entry without saved slots enters the completion
stage, and only after the entry's own fragment returns without failure, from
the sidecar or from the render cache. That view holds a completion place while
it builds its document: its tree, its final checks, its bytes, and its cache
entry. Every other view takes no completion place: a view that its lookup
serves, a view with an HTML template or saved slots, and a Markdown view. Such
a view that renders builds its document while it keeps its batch place and its
worker. A view whose own fragment fails ends with that failure and takes no
completion place. A render for a link check of a view runs inside the lookup
or the render of that view and takes no other place and no other worker.

A view in the completion stage hands off at most once, when it enters that
stage with a charge that fits. At the handoff, the view leaves the window and
the batch, and it releases its worker. A later fragment and a render for a
link check of the view hand off no view. A view that does not hand off keeps
its batch place and its worker until it ends. Foreground and base renders take
no window, batch, or completion place.

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

Decision: both stages are bounded by the smaller of the worker count and the
sidecar capacity. The worker count alone and the pool size alone were rejected
for the batch, because its views beyond the capacity would wait for a sidecar
while they hold workers that foreground renders need. A larger completion bound
was rejected, because it raises the limit of the worker count plus the
completion bound. More views that released their worker would then keep
document trees in memory at once. Keeping one worker free for foreground
requests was rejected, because it slows every pass. Decision: a view start and
an entry to the batch take no claim. A claim for each started view or each view
in the batch was rejected, because an HTML view would hold sidecar capacity
that it never uses, and the call order of sidecar admission already keeps
foreground priority.

Decision: every view whose lookup missed enters the batch, whatever its entry
kind. A render without a batch place for a view without its own fragment was
rejected, because the components of that view can still call the sidecar.

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

Decision: a view that waits to enter the completion stage waits only for a
completion place. A wait for foreground work or for a worker was rejected,
because a foreground render of the same view can hold both while it waits for
that view's render, and neither would then finish.

Decision: a handoff charges the state that it keeps to its own budget of 4 MiB,
outside the render cache bound. An uncharged handoff was rejected, because the
views that hand off would keep memory outside every bound. A charge to the
render cache or to its transit reserve was rejected, because it removed cached
documents, which Changes classification then rendered again. A larger budget
was rejected, because it would raise the memory of the process.

## Bounds And Reports

At a constant capacity, at most the worker count plus the completion bound of
renders hold a worker or a completion place at once. These are the foreground
renders, the background views that hold a worker for their lookup or their
render, and the views that handed off. A view that waits for a batch place or
for a worker holds neither. A lower reading takes no worker or place from a
render that holds one. So the renders that an earlier bound admitted can keep
this number above the new limit until they end.

The window, the lookup, and the stages change no document, usage, resource,
warning, or diagnostic. Each view looks up its own document once, and the
stages repeat no fragment request. Each view's build warnings and a failed
render's diagnostic report once, in catalogue order, after every earlier view
of the pass has ended; a failed view's warnings come directly before its
diagnostic. The pass publishes the usage of its views together after its last
view ends: a completion that changes the index or a detail publishes one
revision under the
[Serve update rules](./mokly-shell-delivery.md#updates-in-serve). Background
work is bounded, yields to foreground renders, and cannot publish after its
state is superseded by a watched change; a superseded result is discarded. A
stop or a replacement starts no further view of the superseded pass, resumes
none of its views that wait, and discards its unreported warnings and failures;
a lookup or a render that already runs finishes under its deadlines, in either
stage. From its start until it ends, also while it waits, a view is Serve work
in flight under the [render store write rules](./mokly-render-store.md#writes).
Shutdown waits for every lookup and render that has started. `--no-watch` runs
this work once.

Decision: warnings and failures report in catalogue order. Reporting each view
when its render ends was rejected, because the order of the lines would change
between runs.
