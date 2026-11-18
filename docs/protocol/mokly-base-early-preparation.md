# Early Base Preparation

This page expands the
[Serve base lifetime](./mokly-base-preparation.md#serve-base-lifetime). Early
preparation prepares the base side of Changes while Serve still renders the
current usage of the head. Current usage is the
[background pass](./mokly-on-demand.md#background-work-and-replacement) over
every view of the head. It settles when that pass has rendered every view.
`build` and `publish` prepare no base early.

## Start And Overlap

Serve starts early preparation with the background pass of each head
generation, so early preparation never starts before readiness. Serve starts
none while it keeps a base with the key of that head. The classification after
usage then follows the kept base rules, with every freshness check.

Early preparation runs every base step before capture: the base lookup, base
reads, extraction, dependency selection and installation, configuration,
discovery, validation with the base bundle, and graph preparation. A base that
needs a sidecar then waits at the pause point, before capture, until current
usage settles. An HTML-only base needs no sidecar, so it can also capture
during usage. The comparison starts only after current usage settles, so it
reads completed head usage.

While current usage renders, the sidecar calls of early preparation before
capture use the
[early base lease](#early-base-lease). Other
sidecar calls use the ordinary
[sidecar admission](./mokly-on-demand.md#background-work-and-replacement):
capture after usage, and calls before capture when the pool gives no lease, as
in a pool of one slot or after a failed reap. Such calls wait until current
usage settles. After a failed reap of its lease, early preparation keeps the
work that it completed, and Serve starts no second preparation for it.
Changes runs from the start of early preparation. So the
[comparison step label](./mokly-terminal-steps.md#comparison-steps) names its
steps while usage renders. Status moves follow the
[Changes status rule](./mokly-changes.md#changes-in-serve) during usage too, so
`preparing` can publish while usage renders. Serve publishes `ready` or
`unavailable` only after current usage settles.

Decision: overlap every base step before capture, and capture an HTML-only
base early. Rejected: early capture of a base that needs a sidecar, because its
capture jobs would hold the render workers that usage and HTTP renders need
while the jobs wait for sidecar admission. Rejected: only the steps before the
first sidecar call, because the base bundle and graph preparation would then
not overlap usage.

## Early Base Lease

An early base lease gives the early base preparation of Serve one slot
while current usage renders. The lease holds that slot for the base sidecar
calls of one preparation, from its first sidecar call through graph
preparation. Stylesheet calls are included. Capture takes no early lease. A
pool has at most one early base lease at a time. A first sidecar call after
current usage settles takes no lease and uses ordinary admission.

The lease takes its slot in one step, while no HTTP render holds its lease.
The slot holds an idle process that is not the
[warm head process](./mokly-sidecar-root-scheduling.md#roots-and-the-warm-head-process),
or it is empty. While no such slot exists, the preparation waits outside the
queue of waiting requests, so it delays no head request. A pool of one slot
gives no lease: early preparation makes its first sidecar call only after
current usage settles.

No other request takes the process of the lease between its calls. Before each
call, the lease waits while an HTTP render holds its lease. A call that already
runs finishes under its deadline.

When the slot holds a process of another root, the lease ends that process and
waits until it exits and is reaped. Only then does it start its base process.
The lease ends at the pause point of its preparation, before capture. It ends
earlier when its preparation fails or is cancelled. At its end, the lease stops
its base process, waits until that process is reaped, and leaves the slot
empty. The next request that takes the slot starts a process as usual. A failed
reap follows the failed reap rules under
[background return](./mokly-sidecar-root-scheduling.md#background-return).

Decision: one lease keeps one slot from the first early call through graph
preparation. Rejected: an admission for each call, because head requests could
take the base process between calls, and each later call would switch roots
again. Decision: the lease waits for each reap. Rejected: a start after the
kill signal alone, because the root switches that early work adds could then
run more processes than the pool size, which bounds memory. Decision: the
lease never takes the warm head process, and a pool of one slot defers early
sidecar calls. Rejected: the warm head rule of other base requests, because
current usage renders on the warm head process, and it is the only process of
a pool of one slot.

## Handover

When current usage settles, the classification takes the early outcome once.
A base that Serve keeps follows the kept base rules. Each other outcome is a
base that waits at the pause point, a captured base that Serve does not keep,
or an error. Such an outcome is stale when its dependency selection used other
dependency directories than the head uses after current usage. Serve checks
this before the capture of a base that waits at the pause point.

An outcome that is not stale passes to the classification once, with its
warnings. A base that waits at the pause point continues with its capture. The
classification compares with a captured base that Serve does not keep, and it
captures that base no second time. An error stands. Its outcome follows the
[historical runtime outcomes](./mokly-base-preparation.md#shared-render-runtime).
So a timeout of an early sidecar call makes Changes unavailable.

Serve discards a stale outcome and its warnings. The classification then
prepares a new base once, as after a failed freshness check. Serve adds no
other preparation after an early error or after a base that it does not keep.

When early base work gives the same outcome as base work after usage, the
published Changes state is the same. It carries the same Changes content,
warnings, and diagnostics, and its generation files and snapshots have the
same bytes. Under the load of usage, an early sidecar call can time out where
a call after usage would not, and Changes is then unavailable.

Decision: the dependency directories decide whether an early outcome is stale.
Rejected: a handover without that check, because dependency selection reads
head usage, which can still grow during usage. Rejected: a new preparation
after an early error that is not stale, because it repeats the work for the
same inputs. A timeout keeps the one retry of the
[sidecar deadline rule](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts).

## Lifetime

The head generation that starts early preparation owns it until the handover.
A new head, a moved merge base, and shutdown cancel it. After the handover, the
classification owns it under the
[cancellation rule](./mokly-base-preparation.md#cancellation). A cancelled
preparation starts no further step. A sidecar call that already runs finishes
under its deadline, and the preparation drains until that call ends.

Serve runs or drains at most one early preparation at a time. When a new head
or a moved merge base cancels a preparation that still drains, the next
preparation waits until the drain ends. A newer request replaces a request that
waits. The background pass of a new head starts at once and does not wait for
the drain. Shutdown cancels the waiting request and the running or draining
preparation, and it waits until that preparation ends.

Early preparation adds no bound and changes none. The capture bounds of
[comparison serving](./mokly-comparison-serving.md#base-and-head-capture), the
[sidecar pool bound](./mokly-sidecar-modules.md#source-root-workers), and the
[cache bounds](./mokly-base-cache.md) stay in force.

Decision: one owner keeps the running or draining preparation and the newest
waiting request. Rejected: a wait for the drain before the next background
pass, because an edit during early preparation would then wait for a running
base call, such as a bundle. Rejected: a set of draining preparations, because
rapid edits could then hold many preparations at once.
