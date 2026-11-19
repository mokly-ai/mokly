# Sidecar Source Root Scheduling

This page expands the
[source root workers](./mokly-sidecar-modules.md#source-root-workers). A
process serves one source root, and all roots share the configured pool
bound. These rules choose the process that changes root. They also let Serve
return idle base processes to the head root after base work. Last, they rank
the idle processes of one root by the generation that a request names.

## Roots And The Warm Head Process

The launch root of the pool, the working repository, is the head root. Every
other source root is a base root. A head request and a base request are
requests in those roots. The newest head generation is the generation of the
last successful `bundle` in the head root. The warm head process is the
process that bundled that generation. After a successful render of that
generation, the warm head process is the process that rendered it last.

A base request takes the warm head process only when no other idle process
and no empty slot is available to it. So base work still uses every slot
while the other slots are busy. A pool of one slot has no other slot, so a
base request replaces its only process.

Decision: the warm head process never makes a base request wait. Rejected: a
wait for another process, because base work would then run on one process
fewer. With two sidecars, the sidecar calls of base capture could take twice
as long.

## Background Return

After Serve publishes the result of a Changes classification, also an
unavailable result, it starts one return pass. The pass begins when the
publication is complete. A classification that a watched change replaces
starts no pass. Only a Serve publication starts a pass. Other commands start
none. After a failed reap ends background return, no publication starts a
pass.

Each base process is a candidate of the pass until the pass replaces it or a
later base request removes its slot. The pass replaces idle candidates with
new processes in the head root. It takes one process at a time, and only
while no base request waits. A one-slot pool returns its only process too.

Decision: the publication starts the pass. Rejected: a pass whenever no base
call runs or waits, because sequential base calls leave short gaps. A pass in
such a gap would replace the process that the next base call needs.

For each process, the pass ends the old process and waits until it exits and
is reaped. Only then does it start the new process, so the two processes
never run at the same time. The new process completes its hello and loads
generations on demand, as after a recycle. A failed start or hello leaves the
slot empty. The next request that takes the slot then starts a process as
usual.

Decision: the pass waits for the reaping. Rejected: a start after the kill
signal alone, because the old and the new process could then run together
beyond the pool size. Decision: the new process loads no head generation in
advance. Rejected: a replay of the newest head generation, because it adds CPU
work and keeps more evaluated code in memory.

When the pass cannot confirm that a process that it ended has exited, it takes
only that slot out of use. The pool keeps owning that process, so the stop
rules still end it. It starts no process in that slot while that process may
still run. A request whose live PostCSS context belongs to that slot fails at
once with `sidecar-unavailable`, which names the PostCSS context worker. The
other slots continue to serve requests. When no usable slot remains, as in a
pool of one slot, the pool stops, and later sidecar requests fail as after a
cancellation.

The first such failure also ends background return for the life of the pool.
The pass drops its other candidates, and later publications start no pass.
Requests still switch roots on demand, and the warm head rule still applies.

Serve reports each failed step of the pass once on stderr, as a sidecar
diagnostic with the error text. When the step ends background return, Serve
then adds this diagnostic line:

```text
[mokly/warning] Background sidecar preparation is disabled. Restart Serve.
```

The timing records of that step keep error status.

Decision: a failed reap takes only its slot out of use. Rejected: a stop of
the whole pool, because one unconfirmed process would then end every
JavaScript render of the session. Rejected: a new process in that slot,
because it could run beside the old process beyond the pool size.

Decision: the first failed reap ends background return for the life of the
pool, so background work can cost at most one slot. Rejected: a pass that
goes on after it, because one cause that fails every reap could then retire
every idle base slot in one pass. Rejected: an end of the current pass only,
because the same cause could then retire one more slot at each publication.

## Handover And Stop

These rules apply to a waiting request that can use the slot. A request whose
live PostCSS context belongs to another slot cannot use this slot, so it keeps
waiting for that other slot while that slot is in use.

When such a request waits after the pass reaps the old process, the request
takes the empty slot. The pass then starts no process in that slot. A head
request that waits during the hello of the new process takes that process
after the hello. A base request that waits during the hello takes the slot
after the pass ends and reaps the new process.

Neither the publication of Changes nor the release of a generation or a
PostCSS context waits for the pass. The
[cancellation rules](./mokly-sidecar-lifecycle.md#cancellation-and-timeouts)
define how shutdown, cancellation, and forced termination stop the pass.

## Later Base Work

Base work can continue after the publication. For example, a view that the
[kept capture](./mokly-base-preparation.md#serve-base-lifetime) does not hold
renders again through the kept base. Such a request takes a process under the
rules above, so it can replace a head process again.

A base request that takes a slot after the pass begins removes that slot from
the pass. A request that took its slot before the pass began removes nothing,
because no replacement was pending then. The pass does not come back to a
removed slot, also when its process is idle again between base calls. The
pass continues with its other candidates.

While the pass has candidates, a base request prefers an idle process of its
root outside the pass to an idle candidate. So sequential base calls keep
using one process, and the other candidates still return.

The next publication starts a new pass. When the earlier pass has not ended,
the new pass takes its place, and its candidates replace those of the earlier
pass. So the new pass can return a slot that the earlier pass lost. One pass
runs at a time.

Decision: a later base request removes only its own slot from the pass.
Rejected: a pass that only pauses while a base request waits, because it
could replace a process between sequential base calls. Rejected: a pass that
ends at the first later base request, because untouched base processes would
stay on the base root.

Decision: while the pass has candidates, base work prefers processes outside
the pass. Rejected: the queue order alone, because sequential base calls would
then take a new candidate on each call and keep it on the base root.

Decision: the pass covers every idle base process. Rejected: one base process
kept in advance for the views that the kept capture does not hold, because it
needs a record of capture completeness and leaves less head capacity.

## Generation Affinity

These rules rank the idle processes of the root of a request. They apply to
each request that names a generation: `cssModules`, `describe`, `bindings`,
and the four render methods. A request that names no generation, such as
`processCss` or a base `bundle`, keeps the queue order. A head `bundle` uses
the [head bundle rank](#head-bundle-affinity). The queue order puts the
process that has been idle longest first. The PostCSS context rule of the
[source root workers](./mokly-sidecar-modules.md#source-root-workers) still
applies before every other rule.

A process holds a generation only while it has loaded the current lifetime of
that generation. The current lifetime is the one that the last `bundle` call of
the generation started, until its final release. An older or a released
lifetime of the same generation does not count.

The inputs of a generation are its class maps, its description, and its latest
bindings table. A process holds an input only when it received that input for
the current lifetime. A request needs the inputs that must come before it on a
process. A `cssModules` request needs no input. A `describe` request needs the
class maps. A `bindings` request needs the class maps and the description. A
render request needs all three inputs.

The request takes the first idle process of the best rank. The ranks are, best
first:

1. A process that holds the generation and each input that the request needs.
2. Another process that holds the generation.
3. A process that does not hold the generation.

Processes of one rank keep the queue order. When no idle process of the root
holds the generation, for example because the pool holds no lifetime of it,
the request keeps the queue order.

The rank orders the processes inside each group that the rules above prefer.
So while the pass has candidates, a base request still prefers an idle process
of its root outside the pass to every candidate. An idle process of the root
still comes before an empty slot, and an empty slot before a process of
another root. The warm head rule still applies.

The rank considers idle processes only. A request never waits for a busy
process that holds its generation while another slot can run the request. So
concurrent independent requests still
[spread across sidecars](./mokly-sidecar.md#transport), and sequential
requests of one generation can reuse one process. The rank starts no process
and keeps no state of its own.

Decision: a request prefers an idle process that holds its generation and
inputs. Rejected: the queue order alone, because a request then often reaches
a process that must restore and describe a generation that another idle
process holds. Rejected: the most recently used process first, because recency
only approximates the loaded state.

Decision: a request never waits for a busy process that holds its generation.
Rejected: a wait for that process, because idle slots would then stay unused
while requests wait.

Decision: the pass preference comes before the rank. Rejected: the rank first,
because base requests could then take more candidates, and fewer processes
would return to the head root before the next edit.

## Head Bundle Affinity

For a head `bundle`, the pool ranks the idle processes of the head root by
their last compile, newest first. Processes without a compile follow in the
queue order. A successful `bundle` counts as a compile unless its
[`cache` value](./mokly-timings.md#core-spans) is `memory` or `hit`. A compile
belongs to its process, so a new process in the same slot has none. The
bundle never waits for a busy process while another slot can run it.

Decision: a head `bundle` prefers the process that compiled last, so fewer
processes keep an idle compiler in memory. Rejected: the queue order, because
bundles then rotate across processes. Rejected: one remembered process,
because after a busy fallback it no longer prefers the older compiler.
