# Sidecar Early Edit Preparation

This page expands the
[source root scheduling](./mokly-sidecar-root-scheduling.md) rules for a
watched Serve edit. The bundling process is the head process that ran the
`bundle` request of the newest head generation. Before another head process
renders that generation, it must restore it and install its class maps,
description, and bindings. Early preparation restores the generation,
installs its class maps, and describes it while the core still validates and
prepares the edited catalogue. So the first render on that process does not
wait for these steps.

## Start

Only Serve runs early preparation. It starts after a successful head
`bundle` request in the
[`serveEdit` capture mode](./mokly-sidecar-recipes.md#capture-modes). It runs
only after the first Changes publication of the session, the publication that
starts the first [return pass](./mokly-sidecar-root-scheduling.md#background-return).

Early preparation selects idle head processes other than the bundling
process. It runs on the background worker of the return pass. It prepares one
selected process at a time, and it sends one call at a time. Its generation
calls are the
`restoreGeneration`, `cssModules`, and `describe` calls of the newest head
generation that the process lacks, in that order. It sends `cssModules` only
after the core installs the class maps of the current lifetime. Class maps of
an earlier lifetime with the same generation id do not count. Early
preparation sends no `bindings` call. A preparation is complete when the
process holds the restored generation, its current class maps, and its
description.

Early preparation renders no document and writes no document or persistent
cache entry. It publishes no state. So a newer edit, a failed attempt, or a
stop cannot publish an early result.

Early preparation starts no process. It adds no timeout, retry, or sleep.
Each call keeps the deadline of its method. A failed call ends the early
preparation of its process. The pool then keeps or replaces the process as
after a failed request.

Decision: early preparation loads the newest head generation before its
renders. Rejected: no preparation before the renders, because the first
render on the other head process then waits for the whole preparation. The
[return warm-up](./mokly-sidecar-return-warmup.md#end) keeps its own rule that
a newer head generation ends it.

Decision: early preparation ends at `describe`. Rejected: an early `bindings`
call, because the first render installs the latest validated bindings at a
small cost, and a later table would replace an early one.

Decision: early preparation starts only after the first Changes publication.
Rejected: a start at the first `serveEdit` bundle, because an edit before the
first Changes result would then compete with the startup base work. So
`serve.ready` and the first Changes result keep their schedule.

## Admission

Early preparation sends a call only while all these conditions hold:

- No request waits in the pool queue.
- No Serve call waits for admission.
- Each live Serve claim belongs to a call that runs on a process. So no
  admitted call is still on its way to the pool queue.

A call that already runs on another process does not stop early preparation.
So early preparation can run beside the core's `describe` on the bundling
process.

Early calls hold no Serve claim. They are sidecar pool maintenance, so the
[render store](./mokly-render-store.md#writes) writer starts no new work
during one.

Decision: a running call does not stop early preparation, but an admitted
call on its way to the queue does. Rejected: the
[warm-up rule](./mokly-sidecar-return-warmup.md#warm-up-steps), which stops at
every live claim, because each Serve call holds a claim, so the core's own
`describe` would stop early preparation. Rejected: a stop only when a request
waits, because an admitted call could then find its process taken by an early
call. The warm-up keeps its rule.

## Process Choice

Early preparation never selects a process that holds a live PostCSS context
of the current attempt. A `processCss` call of the attempt must use the
process of its context under the
[source root worker rules](./mokly-sidecar-modules.md#source-root-workers).
So such a call never waits for an early call. When that context lives on the
only other head process, early preparation does not run for the edit.

Decision: such a process stays out of early preparation. Rejected: a stop
only while a call of that context waits or is admitted, because the next
`processCss` call could then wait for one early call.

## Loaded Head Generations

As its first wire steps, a selected process disposes each older head
generation that it holds, also one that is still live. The pool keeps the
recipe, the class maps, and the bindings of each live generation. So a later
request of a live older generation can restore it. A selected process holds
at most one loaded head generation until early preparation ends. The bundling
process is never selected, so this rule does not change it.

Decision: a selected process disposes its older head generations before the
early restore. Rejected: an early load beside them, because an attempt that
held two evaluated head generations on each process raised the peak memory
demand by 8%.

## Requests Of An Older Generation

Before Serve publishes the newer generation, a head request that names an
older head generation never takes a selected process that holds only the
newer generation. The request takes another process under the
[generation affinity](./mokly-sidecar-root-scheduling.md#generation-affinity)
rules, or it waits until another process is free. With two sidecars, that
process is the bundling process, which still holds the older generation. This
is the one case in which a request waits for a busy process that holds its
generation while another slot could run it.

Decision: such a request waits. Rejected: a load of the older generation on
the selected process, because that process would then hold two evaluated
head generations. Rejected: a disposal of the newer generation first, because
the request would then pay a whole preparation, and the edit would lose its
early preparation.

## End

Early preparation sends no more calls after each of these events:

- Serve publishes the state of its generation.
- Another head `bundle` request starts, in a later attempt or in the same
  attempt, also when that request then fails.
- The final release of its generation.
- The pool stops.
- A failed reap ends background return for the life of the pool.

Neither a publication nor a release waits for early preparation. A call in
flight keeps the existing stop and cancellation rules. When it returns after its lifetime ended, the process
disposes that lifetime before it takes another request, as after a release.

The inputs that early preparation installed stay on the process after it
ends. The first render of the generation on that process uses them. That
render installs each input that is still missing, and always the latest
bindings, on the ordinary path.

## Output

Each early call is a
[quiet call](./mokly-sidecar-return-warmup.md#warm-up-steps). The core's ordinary
`describe` supplies the evaluation output of the generation, so the terminal
shows it once. Early calls of a failed or
superseded attempt print nothing. A crash report of the process and output
from code that runs after a call returns stay visible, as for every quiet
call.

Decision: early calls are quiet. Rejected: visible early calls, because they
repeat the evaluation output, and a failed or superseded attempt could print
after its failure line.

## Diagnostics

The
[early preparation counts](./mokly-sidecar-timings.md#early-preparation-counts)
record started, adopted, and aborted early preparations. They also record the
waits of requests of an older generation.
