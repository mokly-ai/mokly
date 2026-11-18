# Early Base Preparation

This page expands the
[Serve base lifetime](./mokly-base-preparation.md#serve-base-lifetime). Early
preparation prepares the base side of Changes at cold start, while Serve still
renders the first current usage of the session. Current usage is the
[background pass](./mokly-on-demand.md#background-work-and-replacement) over
every view of the head. It settles when that pass has rendered every view.
`build` and `publish` prepare no base early.

## Start And Overlap

Serve can start early preparation once in a session, with the background pass
of the first head that it installs. So early preparation never starts before
readiness. Serve starts it only when that head needs a sidecar: its
configuration names a renderer or PostCSS, or it includes a module or a stories
source. A later head and a reference refresh start no early preparation, also
when the first head needed no sidecar.

Early preparation looks up its base by itself. It makes no Changes request,
reference check, or classification. Changes keeps the order of the
[background pass](./mokly-on-demand.md#background-work-and-replacement): its
reference checks, its reference poll, and its classification start only after
current usage settles.

Early preparation first runs the steps that identify the kind of the base: the
base lookup, the base reads, configuration, and discovery. The base reads can
use an existing extraction of the base commit. These steps run before any wait,
because only the configuration and the sources of the base show whether it
needs a sidecar. The kind of the head decides only whether early preparation
starts.

A base that needs a sidecar continues with extraction, dependency selection and
installation, validation with the base bundle, and graph preparation. It then
waits at the pause point, before capture, until current usage settles. An
HTML-only base waits as soon as its kind is known. After current usage
settles, the same preparation continues with its dependency selection,
validation, graph preparation, and capture. It repeats no earlier step.

No base captures while current usage renders. After current usage settles,
early preparation continues to its capture and tries the ordinary keep of the
[base lifetime rule](./mokly-base-preparation.md#serve-base-lifetime). The
comparison starts only after current usage settles, so it reads completed head
usage.

While current usage renders, the sidecar calls of early preparation before
capture use the
[early base lease](#early-base-lease). Other
sidecar calls use the ordinary
[sidecar admission](./mokly-on-demand.md#background-work-and-replacement):
capture after usage, and calls before capture when the pool gives no lease, as
in a pool of one slot or after a failed reap. Such calls wait until current
usage settles. After a failed reap of its lease, early preparation keeps the
work that it completed, and Serve starts no second preparation for it.

Early preparation publishes no Changes status and names no
[comparison step](./mokly-terminal-steps.md#comparison-steps). Changes
publishes the status moves of the
[Changes status rule](./mokly-changes.md#changes-in-serve) and names its steps
only after current usage settles. A base step that early preparation runs
publishes no `preparing` and names no step of its own.

Decision: Serve prepares early only at cold start, and only when the first
head needs a sidecar. Rejected: early preparation for each head, because an
edit normally reuses the kept base, so early work only adds load to its usage.
Rejected: early preparation for a head that needs no sidecar, because its base
likely needs none either, and an HTML-only base has no bundle.
Rejected: a Changes request during usage, because its reference poll,
classification, and status work add load to usage. Rejected: the kind of the
head as the kind of the base, because the two can differ.

Decision: a base that needs a sidecar overlaps every step before capture, and
no base captures during usage. Rejected: early capture of a base that needs a
sidecar, because its capture jobs would hold the render workers that usage and
HTTP renders need while the jobs wait for sidecar admission. Rejected: only the
steps before the first sidecar call, because the base bundle and graph
preparation would then not overlap usage.

Decision: an HTML-only base waits as soon as its kind is known, and the same
preparation continues after usage. Rejected: early capture of an HTML-only
base, because its capture renders would share the render workers with usage.
An HTML-only capture render does not wait for HTTP renders, as a usage render
does. Rejected: early dependency selection, validation, and graph preparation
of an HTML-only base, because without a base bundle they would save little
time. Rejected: a new preparation after usage, because it would repeat the
steps that identified the kind.

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

When the classification after current usage reaches base preparation, Changes
takes the early outcome once. The outcome counts only when it has the key of
the [kept base](./mokly-base-preparation.md#serve-base-lifetime) that the
classification selects. While early preparation still runs, the classification
waits for it and prepares no base of its own. The cancellation of the
classification ends that wait at once.

The outcome is a kept base, a captured base that Serve does not keep, or an
error:

- The classification reuses a kept base only through the ordinary key and
  freshness checks. A failed check releases it, and Serve prepares a new base
  once.
- The classification compares with a captured base that Serve does not keep.
  It captures that base no second time.
- An error stands. Its outcome follows the
  [historical runtime outcomes](./mokly-base-preparation.md#shared-render-runtime).
  So a timeout of an early sidecar call makes Changes unavailable.

An early outcome is stale when its dependency selection used other dependency
directories than the head uses after current usage. Serve checks this before
the capture of a base that waits at the pause point. An HTML-only base selects
its dependencies only after usage, so its outcome is never stale. Serve
discards a stale outcome and its warnings. Serve then prepares a new base once,
as after a failed freshness check.

When the classification selects another key, for example because the base
moved during usage, Serve rejects the early outcome. It cancels early
preparation and waits until it ends before it prepares the new base. When the
early base lookup fails before it has a key, early preparation keeps no base,
and the classification prepares its base as usual.

Early preparation holds its warnings and its
[cache directory line](./mokly-terminal-cache.md#cache-directory). Changes
reports them once, with an outcome that it takes. A stale or rejected outcome
reports neither. Serve adds no other preparation after an early error or after
a base that it does not keep.

When early base work gives the same outcome as base work after usage, the
published Changes state is the same. It carries the same Changes content,
warnings, and diagnostics, and its generation files and snapshots have the
same bytes. Under the load of usage, an early sidecar call can time out where
a call after usage would not, and Changes is then unavailable.

Decision: an outcome with its key passes to the classification once. Rejected:
the kept base slot as the only handover, because an unkept base and an error
cannot enter the slot. Changes would then prepare that base again. Rejected:
an early outcome without the key check after usage, because the base can move
during usage.

Decision: the dependency directories decide whether an early outcome is stale.
Rejected: a handover without that check, because dependency selection reads
head usage, which can still grow during usage. Rejected: a new preparation
after an early error that is not stale, because it repeats the work for the
same inputs. A timeout keeps the one retry of the
[sidecar deadline rule](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts).

Decision: warnings and the cache directory line wait for the handover.
Rejected: output at once, because Changes output would then start during
usage. A stale or rejected outcome would also report warnings of a base that
Changes never uses.

## Lifetime

One startup owner in Serve holds early preparation from its start until it
ends. That owner is apart from current usage and from Changes. A new head and
the stop of Serve cancel early preparation. A cancelled preparation starts no
further step. A sidecar call that already runs finishes under its deadline,
and the preparation drains until that call ends.

The background pass of a new head starts at once and does not wait for the
drain. A classification that reaches base preparation during the drain waits
until the drain ends. Its own cancellation ends that wait at once, and the
startup owner still waits for the drain. The stop of Serve cancels early
preparation and waits until it ends.

When Changes takes an outcome, the classification owns it under the
[cancellation rule](./mokly-base-preparation.md#cancellation). A kept base
detaches as that rule says.

Early preparation adds no bound and changes none. The capture bounds of
[comparison serving](./mokly-comparison-serving.md#base-and-head-capture), the
[sidecar pool bound](./mokly-sidecar-modules.md#source-root-workers), and the
[cache bounds](./mokly-base-cache.md) stay in force.

Decision: one startup owner, apart from usage and Changes, holds early
preparation. Rejected: a drain before the next background pass, because an
edit would then wait for a running base call, such as a bundle.
