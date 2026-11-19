# Sidecar Head Preload

This page expands the
[source root scheduling rules](./mokly-sidecar-root-scheduling.md#head-generation-preload).
After an edit, Serve describes the new head generation on one process. The
renders of that generation follow after the core prepares its render inputs.
A head preload restores the generation and installs its class maps on the
other idle head processes in that time, so that the renders find it there.

## Start And Candidates

When a `describe` request of the newest head generation succeeds on a head
process, the pool starts a head preload. The candidates of the preload are the
other head processes that are live at that moment. A process that starts
later is not a candidate. So a process that the return pass starts, or that
replaces a recycled or failed process, loads generations on demand.

Only Serve runs a head preload, on the background worker of the
[return pass](./mokly-sidecar-root-scheduling.md#background-return). A
return step comes first. Other commands run no preload.

Decision: the `describe` of the newest head generation starts the preload.
Rejected: the head `bundle`, because the class maps come after it, and the
core can still replace the generation. Rejected: a new request from the core,
because the pool already sees the `describe`.

Decision: the candidates are the head processes that are live at the
`describe`. Rejected: every later head process, because the return pass and a
recycle would then restore the generation in advance, and the preload would not
end.

## Preload Steps

The preload takes one idle candidate at a time. It sends the
`restoreGeneration` and `cssModules` calls that the process lacks, one call at
a time, in that order. It sends no `describe` and no `bindings`, so it runs no
consumer code. The first render on the process describes the generation and
installs the latest bindings table. The preload starts only while no request
waits. A call that Serve admitted counts as waiting until it reaches the pool
queue.

A request that waits always wins. The preload stops before its next call and
gives its process back. The first head request that finds no idle head process
waits for that process. In that time it starts no process and replaces no
process of another root. Every other request makes the choice that it makes
without the preload, so a request that can use an idle process runs at once.
A base request counts the preloading process as busy, under the warm head rule.
A return step that can start also stops the preload before its next call. The
preload continues with the same candidate when no request waits.

Decision: the preload evaluates nothing. Rejected: a `describe` in advance,
because each preloaded process then evaluated the new generation while the
previous one was still published, and so held two evaluated head generations
until the previous one was released. On a catalogue of 167 entries with four
sidecars, that raised the peak memory demand by 8% and made the bundle of
later edits slower.

Decision: the preload takes one process at a time. Rejected: every candidate
at once, because three sidecars and the parallel graph work of the core would
then share four CPUs in the time before the renders.

Decision: a call that Serve admitted counts as waiting before it reaches the
pool queue. Rejected: the pool queue alone, because Serve wakes the preload
when it admits a call, so the preload could start a call after the request
arrived.

Decision: the first head request without an idle head process waits for the
preloading process. Rejected: a start or a replacement of a process, because
that takes longer than the one call in flight. Rejected: a wait for every such
request, because a later request would then wait for a call on a process that
the first request takes.

## End

A candidate ends when it holds the current lifetime of the generation with
its class maps, when its process ends or leaves the head root, and when a
preload call fails. After a failed call, the pool keeps or
replaces the process as after a failed request. The failure reaches no output.
A later request that needs the same input reports its own failure.

The preload ends when a later head `bundle` succeeds, when the generation is
released, and when the pool stops. A failed reap that ends background return
also ends the preload, and no later `describe` starts one. Shutdown,
cancellation, and forced termination follow the
[cancellation rules](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts).
The preload starts no process. A process that it prepared holds the generation
and its class maps as if a request had loaded them, so the
[generation affinity](./mokly-sidecar-root-scheduling.md#generation-affinity)
rank counts it. The release of a generation reaches a preloaded process as it
reaches every other process that holds the generation.

Decision: a failed call keeps the rule of a failed request and stays silent.
Rejected: a diagnostic for each failure, because a preload failure changes no
result, and the render that needs the input reports a real failure.
